import { expect } from '@playwright/test';
import { openBook, test } from './reader-harness';

test('near and far ripples flow in opposite directions, including on reverse scroll', async ({ page }) => {
  await openBook(page);
  const stage = page.locator('#scene-14 .portrait-stage');
  await stage.scrollIntoViewIfNeeded();
  await expect(stage.locator('[data-painted-detail="farther-ripple"] > i')).toHaveCount(1);
  const positions = await stage.evaluate(async el => {
    const near = el.querySelector<HTMLElement>('[data-painted-detail="ripple-near-the-shore"] > i')!;
    const far = el.querySelector<HTMLElement>('[data-painted-detail="farther-ripple"] > i')!;
    const { top, height } = el.getBoundingClientRect();
    const start = scrollY + top - innerHeight;
    const span = height + innerHeight;
    const steps = Array.from({ length: 21 }, (_, i) => .23 + i * .027);
    const samples = [];
    for (const fraction of [...steps, ...[...steps].reverse()]) {
      scrollTo({ top: start + span * fraction, behavior: 'instant' });
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      samples.push([near, far].map(band => new DOMMatrixReadOnly(getComputedStyle(band).transform).m41));
    }
    return samples;
  });
  let moving = 0;
  for (let i = 1; i < positions.length; i++) {
    const near = positions[i][0] - positions[i - 1][0];
    const far = positions[i][1] - positions[i - 1][1];
    if (Math.max(Math.abs(near), Math.abs(far)) < .06) continue;
    moving++;
    expect(near * far, 'both bands should travel in opposite directions at step ' + i).toBeLessThan(0);
  }
  expect(moving).toBeGreaterThan(20);
  for (let i = 0; i < positions.length / 2; i++) {
    const reverse = positions[positions.length - i - 1];
    expect(reverse[0]).toBeCloseTo(positions[i][0], 2);
    expect(reverse[1]).toBeCloseTo(positions[i][1], 2);
  }
});
