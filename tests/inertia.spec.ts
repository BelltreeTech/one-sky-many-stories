import { expect } from '@playwright/test';
import { openBook, test, visitScene } from './reader-harness';

test('a changing Safari toolbar leaves a native page scroll in control', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await openBook(page);
  const scene = await visitScene(page, 5);
  await scene.locator('.scene-image').evaluate((image: HTMLImageElement) => image.decode());
  // Font loading queues its own post-scroll layout measurement. Let this
  // settle before isolating a toolbar change in an already open chapter.
  await page.waitForTimeout(800);

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
