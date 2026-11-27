import { expect } from '@playwright/test';
import { openBook, test } from './reader-harness';

for (const viewport of [{ width: 393, height: 852 }, { width: 1280, height: 320 }]) {
  test(`all six stars reach peak brightness in view and in order at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openBook(page);
    const stage = page.locator('#scene-07 .portrait-stage');
    await stage.scrollIntoViewIfNeeded();
    const lights = stage.locator('[data-painted-detail^="counted-star-"] > i');
    await expect(lights).toHaveCount(6);
    const peaks = await stage.evaluate(async el => {
      const glows = Array.from(el.querySelectorAll<HTMLElement>('[data-painted-detail^="counted-star-"] > i'));
      const maxima = glows.map(() => ({ opacity: -1, y: 0, top: 0, bottom: 0 }));
      const { top, height } = el.getBoundingClientRect();
      const start = scrollY + top - innerHeight;
      const span = height + innerHeight;
      for (let step = 0; step <= 90; step++) {
        scrollTo({ top: start + step * span / 90, behavior: 'instant' });
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        glows.forEach((glow, index) => {
          const opacity = Number(getComputedStyle(glow).opacity);
          if (opacity > maxima[index].opacity) {
            const { top, bottom } = glow.getBoundingClientRect();
            maxima[index] = { opacity, y: scrollY, top, bottom };
          }
        });
      }
      return maxima;
    });
    for (const [index, peak] of peaks.entries()) {
      const label = 'star ' + (index + 1);
      expect(peak.opacity, label + ' should light up').toBeGreaterThan(.60);
      expect(peak.top, label + ' should peak below the top edge').toBeGreaterThanOrEqual(0);
      expect(peak.bottom, label + ' should peak above the bottom edge').toBeLessThanOrEqual(viewport.height);
      if (index) expect(peak.y, label + ' should follow the previous star').toBeGreaterThan(peaks[index - 1].y);
    }
  });
}
