import { expect, type Locator } from '@playwright/test'
import { test, openBook, sceneAt } from './reader-harness'

// This is the position of the painted book on Leo's portrait. Move that point
// to a real part of the viewport, as a reader would while advancing the strip.
async function placeBook(stage: Locator, viewportFraction: number) {
  await stage.evaluate((node, fraction) => {
    const rect = node.getBoundingClientRect()
    window.scrollBy({ top: rect.top + rect.height * .58 - innerHeight * fraction, behavior: 'instant' })
  }, viewportFraction)
}

async function visibleBookPixels(stage: Locator) {
  return stage.evaluate(node => {
    const surface = node.querySelector<HTMLCanvasElement>('.leo-book canvas')!
    const atlasPixels = surface.getContext('2d')!.getImageData(0, 0, surface.width, surface.height).data
    const source = document.createElement('canvas')
    source.width = surface.width
    source.height = surface.height
    const original = source.getContext('2d')!
    original.drawImage(node.querySelector<HTMLImageElement>('.scene-image')!,
      494, 765, surface.width, surface.height, 0, 0, surface.width, surface.height)
    const basePixels = original.getImageData(0, 0, surface.width, surface.height).data
    let different = 0, paper = 0, painted = 0
    for (let i = 0; i < atlasPixels.length; i += 4) {
      const alpha = atlasPixels[i + 3] / 255
      if (alpha > 0) painted++
      if (alpha * Math.abs(atlasPixels[i] - basePixels[i]) > 32) {
        different++
        if (atlasPixels[i] - atlasPixels[i + 2] > 65 && basePixels[i] < 105) paper++
      }
    }
    // These pixels sit inside the upper fingers and lower palm that cover
    // the book. An atlas that moves the hands with the cover fails here.
    let handError = 0
    for (const [x, y] of [[552, 792], [579, 787], [612, 794], [621, 935], [652, 927]]) {
      const offset = 4 * ((y - 765) * surface.width + x - 494)
      for (let channel = 0; channel < 3; channel++) {
        handError = Math.max(handError, atlasPixels[offset + 3] / 255 *
          Math.abs(atlasPixels[offset + channel] - basePixels[offset + channel]))
      }
    }
    return { different, paper, painted, handError }
  })
}

test('Leo closes the Pegasus book over the painted pages and can open it in reverse', async ({ page }) => {
  const requests: string[] = []
  page.on('request', req => { if (req.url().endsWith('/motion/leo-book.webp')) requests.push(req.url()) })
  await openBook(page)
  expect(requests).toHaveLength(0)

  const stage = sceneAt(page, 12).locator('.portrait-stage')
  await placeBook(stage, .85)
  await expect(stage.locator('.leo-book img')).toHaveAttribute('data-decoded', 'true')
  await expect.poll(async () => (await visibleBookPixels(stage)).paper).toBeGreaterThan(1800)
  const open = await visibleBookPixels(stage)
  expect(open.handError).toBe(0)
  await placeBook(stage, .52)
  await expect.poll(async () => (await visibleBookPixels(stage)).paper).toBeLessThan(open.paper * .8)
  const middle = await visibleBookPixels(stage)
  expect(middle.paper).toBeGreaterThan(120)
  expect(middle.handError).toBe(0)
  await placeBook(stage, .24)
  // At the end of the movement, the cover is the original painting. A few
  // illuminated paper edges settle independently while the reader stays put.
  const settled = await stage.evaluate(async node => {
    const surface = node.querySelector<HTMLCanvasElement>('.leo-book canvas')!
    const ctx = surface.getContext('2d')!
    const values: number[] = []
    const stop = performance.now() + 750
    while (performance.now() < stop) {
      await new Promise(requestAnimationFrame)
      const pixels = ctx.getImageData(0, 0, surface.width, surface.height).data
      let count = 0
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 16) count++
      values.push(count)
    }
    return values
  })
  expect(settled.some(n => n > 8 && n < 1600), 'Lit leaves briefly remain over the closed cover').toBe(true)
  expect(settled.at(-1)).toBe(0)

  await placeBook(stage, .85)
  await expect.poll(async () => (await visibleBookPixels(stage)).paper).toBeGreaterThan(open.paper * .97)
  expect(requests).toHaveLength(1)
})

test('the original book stays readable in reduced motion and when its optional painting cannot decode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let requests = 0
  await page.route('**/motion/leo-book.webp', async route => {
    requests++
    await route.fulfill({ contentType: 'image/webp', body: 'unavailable' })
  })
  await openBook(page)
  const scene = sceneAt(page, 12)
  const stage = scene.locator('.portrait-stage')
  await placeBook(stage, .59)
  await expect.poll(() => stage.locator('.scene-image').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(1051)
  expect(requests).toBe(0)
  await expect(stage.locator('.leo-book')).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(() => requests).toBe(1)
  await expect.poll(() => stage.locator('.leo-book img').evaluate(img => (img as HTMLImageElement).complete)).toBe(true)
  expect(await visibleBookPixels(stage)).toEqual({ different: 0, paper: 0, painted: 0, handError: 0 })
  await expect(scene.locator('.beat-text')).toContainText('I’m glad the sisters are safe.')

  // A new document with an unreadable full-size plate uses the registered
  // story preview. It should not fetch or display the separate animated crop.
  await page.route('**/portrait/12.webp', route => route.fulfill({ contentType: 'image/webp', body: 'unavailable' }))
  await page.goto('about:blank')
  await openBook(page)
  await placeBook(stage, .59)
  await expect(stage.locator('.scene-image')).toHaveAttribute('data-fallback', 'true')
  await expect.poll(() => stage.locator('.scene-image').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(stage.locator('.leo-book')).toHaveCount(0)
  expect(requests).toBe(1)
})
