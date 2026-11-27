import { expect, type Locator } from '@playwright/test'
import { test, openBook } from './reader-harness'
import { enterPainting, leavePainting, stagePose, waitForPose } from './playback-harness'

function translation(image: Locator) {
  return image.evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return [matrix.m41, matrix.m42]
  })
}

test('the seven sisters run and rise against their own landscapes without another swipe', async ({ page }) => {
  await openBook(page)
  for (const [id, layer] of [[10, '.ridge-runners'], [11, '.ascent-figures']] as const) {
    const stage = await enterPainting(page, id)
    await expect(stage.locator('.registered-pair')).toHaveAttribute('data-ready', 'true')
    const actors = stage.locator(layer)
    const before = await translation(actors)
    const readingAt = await page.evaluate(() => scrollY)
    await waitForPose(stage, .85)
    const after = await translation(actors)
    expect(before[1] - after[1]).toBeGreaterThan(id === 10 ? 12 : 56)
    if (id === 10) {
      expect(after[0] - before[0]).toBeGreaterThan(19)
      await expect(stage.locator('.distant-orion')).toHaveCSS('transform', 'none')
    }
    expect(await translation(stage.locator('.registered-pair > img').first())).toEqual([0, 0])
    expect(await page.evaluate(() => scrollY)).toBe(readingAt)
    // A small reverse scroll keeps this visit. A full exit and re-entry is
    // what starts the performance from its opening again.
    await page.evaluate(() => scrollBy({ top: -32, behavior: 'instant' }))
    expect(await stagePose(stage)).toBeGreaterThanOrEqual(.85)
    await leavePainting(page, id)
    await enterPainting(page, id)
    expect(await stagePose(stage)).toBeLessThan(.33)
  }
})

test('the original seven remain together while one registered layer is still unavailable', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/motion/sisters-ascent.webp', async route => { await pending; await route.continue() })
  try {
    await openBook(page)
    const stage = await enterPainting(page, 11)
    const group = stage.locator('.sisters-ascent')
    await expect(group).toHaveAttribute('data-ready', 'false')
    await group.locator('.ascent-landscape').evaluate((img: HTMLImageElement) => img.decode())
    await expect(group).toBeHidden()
    await expect(stage.locator('.scene-image')).toBeVisible()
    release()
    await expect(group).toBeVisible()
    const alpha = await group.locator('.ascent-figures').evaluate((sprite: HTMLImageElement) => {
      const canvas = document.createElement('canvas')
      canvas.width = 422; canvas.height = 750
      const paint = canvas.getContext('2d')!
      paint.drawImage(sprite, 0, 0, canvas.width, canvas.height)
      // Samples fall on the seven painted cheeks, then the mountain and Zeus.
      return [[110,109],[150,179],[124,256],[127,352],[276,263],[361,263],[324,320],[200,667],[249,29]]
        .map(([x,y]) => paint.getImageData(x,y,1,1).data[3])
    })
    expect(alpha).toEqual([255,255,255,255,255,255,255,0,0])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(group).toHaveCount(0)
    await expect(stage.locator('.scene-image')).toBeVisible()
  } finally { release() }
})
