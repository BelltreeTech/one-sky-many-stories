import { expect } from '@playwright/test';
import { enterPainting, waitForPose } from './playback-harness';
import { portraitDirections } from '../src/data/portrait';
import { openBook, test, visitScene } from './reader-harness';

declare global {
  interface Window { releaseReaderFonts(): Promise<void> }
}

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
        // A busy WebKit runner can still be coasting at 550 ms. Wait for the
        // browser's last scroll event plus the toolbar debounce before reading
        // the final distance; retain the top-write observer throughout.
        const began = performance.now();
        let lastScroll = began;
        const reportsEnd = 'onscrollend' in document;
        let ended = !reportsEnd;
        const moved = () => { lastScroll = performance.now(); ended = !reportsEnd; };
        const finished = () => { ended = true; };
        document.addEventListener('scrollend', finished);
        window.addEventListener('scroll', moved, { passive: true });
        function sampleRest() {
          const now = performance.now();
          if (!ended || now - lastScroll < 220 || now - began < 550) {
            requestAnimationFrame(sampleRest);
            return;
          }
          window.removeEventListener('scroll', moved);
          document.removeEventListener('scrollend', finished);
          Reflect.deleteProperty(viewport, 'height');
          window.scrollTo = originalScrollTo;
          document.documentElement.dataset.inertiaResult = JSON.stringify({ start, end: scrollY, height: innerHeight, topWrites });
        }
        requestAnimationFrame(sampleRest);
      }, { once: true, passive: true });
    }, { once: true });
  });
  await page.keyboard.press('PageDown');
  await expect(page.locator('html')).toHaveAttribute('data-inertia-result', /topWrites/);
  const result = JSON.parse((await page.locator('html').getAttribute('data-inertia-result'))!);
  expect(result.end - result.start, 'The native PageDown travels through the page').toBeGreaterThan(result.height * .7);
  expect(result.topWrites, 'The page never commands a jump to the cover during toolbar movement').toEqual([]);
});

for (const timing of ['on PageDown', 'during its first forward movement'] as const) {
  test(`fonts finishing ${timing} preserve the native page scroll`, async ({ page }) => {
    let releaseFonts!: () => void;
    const fontsAllowed = new Promise<void>(resolve => { releaseFonts = resolve; });
    await page.route('**/*.woff2', async route => {
      await fontsAllowed;
      await route.continue();
    });
    try {
      if (timing === 'during its first forward movement') {
        // Use a different fallback from the first paint, as on a device with
        // different fonts installed. A real Lora response rewraps the text.
        await page.route('**/assets/*.css', async route => {
          const response = await route.fetch();
          await route.fulfill({ response, body: (await response.text()) + ':root { font-family: Lora, monospace; }' });
        });
      }
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
      if (timing === 'during its first forward movement') {
        await page.exposeFunction('releaseReaderFonts', releaseFonts);
        await paragraph.evaluate(element => {
          const start = element.getBoundingClientRect().top;
          function releaseWhenMoving() {
            if (element.getBoundingClientRect().top >= start) return;
            window.removeEventListener('scroll', releaseWhenMoving);
            void window.releaseReaderFonts();
          }
          document.addEventListener('keydown', event => {
            if (event.isTrusted && event.key === 'PageDown') {
              window.addEventListener('scroll', releaseWhenMoving, { passive: true });
            }
          }, { once: true });
        });
      }
      await page.keyboard.press('PageDown');
      if (timing === 'on PageDown') releaseFonts();
      await expect(page.locator('html')).toHaveAttribute('data-font-scroll-writes', '[]');
      const distance = await page.evaluate(() => innerHeight / 3);
      await expect.poll(paragraphTop, 'The native forward gesture moves the paragraph').toBeLessThan(initial - distance);
      const forward = await paragraphTop();
      await page.keyboard.press('PageUp');
      await expect.poll(paragraphTop, { message: 'The reader can bring the paragraph back' }).toBeGreaterThan(forward + distance);
    } finally {
      releaseFonts();
    }
  });
}

test('a completed camera keeps its final pose through a small viewport resize and a return scroll', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 780 });
  await page.clock.install();
  await openBook(page);
  const stage = await enterPainting(page, 12, .65);
  await waitForPose(stage, .02);
  await page.clock.fastForward(5500);
  await expect(stage).toHaveAttribute('data-playback', 'complete');
  const camera = stage.locator('.camera');
  const settled = () => camera.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).a);
  expect(await settled()).toBeCloseTo(portraitDirections[12].end, 5);
  await page.setViewportSize({ width: 393, height: 842 });
  const y = await page.evaluate(() => scrollY);
  for (const target of [y + 16, y]) {
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), target);
    await page.clock.runFor(100);
    await expect(stage).toHaveAttribute('data-playback', 'complete');
    expect(await settled()).toBeCloseTo(portraitDirections[12].end, 5);
  }
});
