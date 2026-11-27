import { expect } from '@playwright/test'
import { openBook, test } from './reader-harness'
import { enterPainting, waitForPose } from './playback-harness'

test('near and far ripples travel in opposite directions through the lake shot', async ({ page }) => {
  await page.clock.install()
  await openBook(page)
  const stage = await enterPainting(page, 14)
  await waitForPose(stage, .01)
  const start = await page.evaluate(() => scrollY)
  const positions: number[][] = []
  for (let step = 0; step < 40; step++) {
    await page.clock.runFor(100)
    positions.push(await stage.evaluate(el => ['ripple-near-the-shore', 'farther-ripple'].map(name => {
      const band = el.querySelector('[data-painted-detail="' + name + '"] > i')!
      return new DOMMatrixReadOnly(getComputedStyle(band).transform).m41
    })))
  }
  let moving = 0
  for (let index = 1; index < positions.length; index++) {
    const near = positions[index][0] - positions[index - 1][0]
    const far = positions[index][1] - positions[index - 1][1]
    if (Math.max(Math.abs(near), Math.abs(far)) < .06) continue
    moving++
    expect(near * far, 'opposing currents at step ' + index).toBeLessThan(0)
  }
  expect(moving).toBeGreaterThan(20)
  expect(await page.evaluate(() => scrollY)).toBe(start)
})
