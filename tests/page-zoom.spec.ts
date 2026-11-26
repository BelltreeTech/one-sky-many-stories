import { expect, type Page } from '@playwright/test';
import { openBook, sceneAt, test } from './reader-harness';

// A headless browser cannot operate iPadOS Safari’s Page Menu. Replay the
// layout-width/scale sequence captured in Mobile Safari, while the browser
// itself lays out the real strip at each size.
async function installViewportControls(page: Page) {
  await page.addInitScript(() => {
    const viewport = window.visualViewport!;
    let scale = 1;
    let pinch = 1;
    let width = innerWidth;
    Object.defineProperty(viewport, 'scale', { get: () => scale * pinch });
    Object.defineProperty(viewport, 'width', { get: () => width / pinch });
    Object.defineProperty(window, 'outerWidth', { get: () => 820 });
    window.addEventListener('test-viewport', event => {
      ({ scale, pinch } = (event as CustomEvent).detail);
      width = innerWidth;
      viewport.dispatchEvent(new Event('resize'));
    });
  });
}

async function setPageZoom(page: Page, scale: number, pinch = 1) {
  await page.setViewportSize({ width: Math.round(820 / scale), height: Math.round(1048 / scale) });
  await page.evaluate(detail => window.dispatchEvent(new CustomEvent('test-viewport', { detail })), { scale, pinch });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('page zoom keeps the visible paragraph and optical pinch leaves native scrolling alone', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1048 });
  await installViewportControls(page);
  await openBook(page);
  await setPageZoom(page, 1);
  const text = sceneAt(page, 17).locator('.beat-text');
  await text.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '17');
  const center = () => text.evaluate(el => { const box = el.getBoundingClientRect(); return (box.top + box.height / 2) / innerHeight; });
  const readingCenter = await center();
  for (const scale of [1.15, 1.25, 1.5, 1.75, 2, 1.75, 1.5, 1.25, 1.15, 1]) {
    await setPageZoom(page, scale);
    await expect.poll(async () => Math.abs(await center() - readingCenter)).toBeLessThan(.035);
  }
  const location = await page.evaluate(() => scrollY);
  await setPageZoom(page, 1, 1.5);
  expect(await page.evaluate(() => scrollY)).toBe(location);
  await page.evaluate(() => scrollBy({ top: 140, behavior: 'instant' }));
  await setPageZoom(page, 1);
  expect(await page.evaluate(() => scrollY)).toBe(location + 140);
});

test('a zoom wheel event lets a simultaneous column reflow preserve the reading position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openBook(page);
  const passage = sceneAt(page, 17).locator('.beat-text');
  await passage.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '17');
  // Replay the event and layout change together. Headless browsers do not
  // expose the platform's actual page zoom via a Ctrl+wheel command.
  const drift = await passage.evaluate(async el => {
    const frame = () => new Promise<void>(done => requestAnimationFrame(() => done()));
    const center = () => { const rect = el.getBoundingClientRect(); return (rect.top + rect.bottom) / 2; };
    await frame(); await frame();
    const before = center();
    window.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true }));
    document.documentElement.style.setProperty('--strip-width', 'calc(54svh + 9px)');
    await frame(); await frame(); await frame();
    return Math.abs(center() - before);
  });
  expect(drift).toBeLessThan(3);
});
