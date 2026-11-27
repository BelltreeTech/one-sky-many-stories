import { expect } from '@playwright/test';
import { portraitDirections } from '../src/data/portrait';
import { openBook, test, visitScene } from './reader-harness';

test('a changing Safari toolbar leaves a native page scroll in control', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await openBook(page);
  const scene = await visitScene(page, 5);
  await scene.locator('.scene-image').evaluate((image: HTMLImageElement) => image.decode());
  // Isolate a toolbar change after the chapter and its text have loaded.

  // Keep the layout width and the reading column fixed. Mobile Safari can
  // resize just its visual viewport as the address bar moves. Playwright has
  // no address bar, so replay those notifications during a native PageDown.
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    const initialHeight = viewport.height;
    const topWrites: number[] = [];
    const originalScrollTo = window.scrollTo;
    let height = initialHeight;
    let active = false;
    window.scrollTo = new Proxy(originalScrollTo, {
      apply(target, receiver, args) {
        const top = typeof args[0] === 'object' ? args[0]?.top : args[1];
        if (active && top === 0 && scrollY > innerHeight) topWrites.push(scrollY);
        return Reflect.apply(target, receiver, args);
      },
    });
    document.addEventListener('keydown', () => {
      const start = scrollY;
      window.addEventListener('scroll', () => {
        active = true;
        Object.defineProperty(viewport, 'height', { configurable: true, get: () => height });
        for (const [index, delay] of [0, 28, 56].entries()) {
          setTimeout(() => {
            height = initialHeight + (index + 1) * 12;
            viewport.dispatchEvent(new Event('resize'));
          }, delay);
        }
        // Include the resize debounce and the end of the native key scroll.
        setTimeout(() => {
          Reflect.deleteProperty(viewport, 'height');
          window.scrollTo = originalScrollTo;
          document.documentElement.dataset.inertiaResult = JSON.stringify({ start, end: scrollY, height: innerHeight, topWrites });
        }, 550);
      }, { once: true, passive: true });
    }, { once: true });
  });
  await page.keyboard.press('PageDown');
  await expect(page.locator('html')).toHaveAttribute('data-inertia-result', /topWrites/);
  const result = JSON.parse((await page.locator('html').getAttribute('data-inertia-result'))!);
  expect(result.end - result.start, 'The native PageDown travels through the page').toBeGreaterThan(result.height * .7);
  expect(result.topWrites, 'The page never commands a jump to the cover during toolbar movement').toEqual([]);
});

test('fonts finishing while the reader advances do not reset the scroll position', async ({ page }) => {
  let releaseFonts!: () => void;
  const fontsAllowed = new Promise<void>(resolve => { releaseFonts = resolve; });
  await page.route('**/*.woff2', async route => {
    await fontsAllowed;
    await route.continue();
  });
  try {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');
    const chapter = await visitScene(page, 6);
    const paragraph = chapter.locator('.beat-text');
    const paragraphTop = () => paragraph.evaluate(el => el.getBoundingClientRect().top);
    const initial = await paragraphTop();
    await page.evaluate(() => {
      const writes: number[] = [];
      window.scrollTo = new Proxy(window.scrollTo, {
        apply(target, receiver, args) {
          const top = typeof args[0] === 'object' ? args[0]?.top : args[1];
          if (top === 0 && scrollY > innerHeight) writes.push(scrollY);
          return Reflect.apply(target, receiver, args);
        },
      });
      document.fonts.ready.then(() => {
        setTimeout(() => { document.documentElement.dataset.fontScrollWrites = JSON.stringify(writes); }, 1000);
      });
    });
    await page.keyboard.press('PageDown');
    releaseFonts();
    await expect(page.locator('html')).toHaveAttribute('data-font-scroll-writes', '[]');
    const forward = await paragraphTop();
    const distance = await page.evaluate(() => innerHeight / 3);
    expect(initial - forward, 'The native forward gesture moves the paragraph').toBeGreaterThan(distance);
    await page.keyboard.press('PageUp');
    await expect.poll(paragraphTop, { message: 'The reader can bring the paragraph back' }).toBeGreaterThan(forward + distance);
  } finally {
    releaseFonts();
  }
});

test('an idle illustration takes the same pose after a small viewport resize and a return scroll', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 780 });
  await openBook(page);
  const scene = await visitScene(page, 12);
  const art = scene.locator('.portrait-stage');
  await art.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await expect(art.locator('.leo-book img')).toHaveAttribute('data-decoded', 'true');
  // Use the chapter's actual position and declared camera endpoints as the
  // oracle, so a stale first frame cannot be mistaken for the resting pose.
  const geometry = () => art.evaluate((el, direction) => {
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight + r.height)));
    const expected = direction.start + t * t * (3 - 2 * t) * (direction.end - direction.start);
    const transform = getComputedStyle(el.querySelector('.camera')!).transform;
    return { y: scrollY, scale: new DOMMatrixReadOnly(transform === 'none' ? undefined : transform).a, expected };
  }, portraitDirections[12]);
  const error = async () => {
    const { scale, expected } = await geometry();
    return Math.abs(scale - expected);
  };
  await expect.poll(error).toBeLessThan(.00002);
  const before = await geometry();
  await page.setViewportSize({ width: 393, height: 842 });
  await expect.poll(async () => Math.abs((await geometry()).expected - before.expected)).toBeGreaterThan(.0002);
  await expect.poll(error).toBeLessThan(.00002);
  const atRest = await geometry();
  await page.evaluate(y => scrollTo(0, y + 16), atRest.y);
  await expect.poll(async () => Math.abs((await geometry()).scale - atRest.scale)).toBeGreaterThan(.0001);
  await page.evaluate(y => scrollTo(0, y), atRest.y);
  await expect.poll(async () => Math.abs((await geometry()).scale - atRest.scale)).toBeLessThan(.00002);
});
