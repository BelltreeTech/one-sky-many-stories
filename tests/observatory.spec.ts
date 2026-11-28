import { expect } from '@playwright/test';
import { openBook, sceneAt, test } from './reader-harness';
import { changedPixels } from './visible-pixels';

test('one entry takes the reader through the eyepiece and the dust, then leaves the original star field clear', async ({ page }) => {
  await page.clock.install({ time: new Date('2025-02-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2025-02-01T00:10:00Z'));
  await openBook(page);
  const scene = sceneAt(page, 8);
  const lens = scene.locator('.lens-field');
  await lens.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const original = lens.locator('.telescope-view');
  await expect(original).toHaveAttribute('data-ready', 'true');
  for (const layer of ['.observatory-eyepiece', '.observatory-dust']) {
    await expect(lens.locator(layer + ' img')).toHaveAttribute('data-arrival', 'ready');
  }
  const restingY = await page.evaluate(() => scrollY);
  const bounds = await lens.boundingBox();
  if (!bounds) throw Error('The telescope must be visible');
  const viewport = page.viewportSize()!;
  const x = Math.max(0, Math.ceil(bounds.x));
  const y = Math.max(0, Math.ceil(bounds.y));
  const width = Math.min(viewport.width, Math.floor(bounds.x + bounds.width)) - x;
  const height = Math.min(viewport.height, Math.floor(bounds.y + bounds.height)) - y;
  const frame = () => page.screenshot({ clip: { x, y, width, height }, scale: 'css' });
  for (const { at, selector } of [
    { at: .12, selector: '.observatory-eyepiece' },
    { at: .60, selector: '.observatory-dust' },
    { at: 1, selector: '.observatory' },
  ]) {
    await test.step('Optical time ' + at, async () => {
      const time = () => lens.evaluate(el => Number(el.style.getPropertyValue('--optical-time')));
      await expect.poll(async () => {
        const remaining = at - await time();
        if (remaining > 0) await page.clock.runFor(Math.max(16, Math.min(240, Math.floor(remaining * 4200))));
        return time();
      }, { intervals: [0] }).toBeGreaterThanOrEqual(at);
      // Both exposures see the same frozen frame. Comparing composited pixels
      // catches a moving layer that is accidentally hidden behind the painting.
      const painted = await frame();
      const sheet = await page.addStyleTag({ content: '#scene-08 ' + selector + '{display:none!important}' });
      let uncovered: Buffer;
      try {
        uncovered = await frame();
      } finally {
        await sheet.evaluate(el => el.remove());
      }
      const difference = await changedPixels(page, painted, uncovered, at < 1 ? 12 : 0);
      if (at < 1) {
        expect(difference / (width * height), selector + ' reaches the visible glass').toBeGreaterThan(.003);
      } else {
        expect(difference, 'The original stars are clear once the optical journey settles').toBe(0);
      }
      expect(await page.evaluate(() => scrollY)).toBe(restingY);
    });
  }
  await expect(lens).toHaveAttribute('data-playback', 'complete');
  await expect(original).toBeVisible();
  await expect(scene.locator('.beat-text').last()).toContainText('more can be seen through a telescope.');
});
