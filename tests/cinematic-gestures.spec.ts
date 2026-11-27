import { expect } from '@playwright/test'
import { test, openBook, expectImageFailures, deployPath } from './reader-harness'

import { enterPainting, leavePainting, waitForPose } from './playback-harness'

test('the lantern swings and the cherry blossoms travel while the reader rests', async ({ page }) => {
  await openBook(page)
  // Starting a fresh visit also makes this independent of how long the fonts
  // took to load while the original cover was already on screen.
  await leavePainting(page, 1, 'below')
  const art = await enterPainting(page, 1)
  const lantern = art.locator('.lantern-rig')
  await expect(lantern).toHaveAttribute('data-ready','true')
  const angle = () => lantern.locator('.lantern-pivot').evaluate(el => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return 180 * Math.atan2(m.b,m.a) / Math.PI
  })
  const start = await angle()
  const still = await page.evaluate(() => scrollY)
  await waitForPose(art, .82)
  expect(await angle() - start).toBeGreaterThan(37)
  expect(await page.evaluate(() => scrollY)).toBe(still)

  const cherry = await enterPainting(page, 5)
  const petal = cherry.locator('.windborne').first()
  const point = () => petal.evaluate(el => {
    const r = el.getBoundingClientRect(), art = el.closest('.portrait-sheet')!.getBoundingClientRect()
    // Measure the blossom in the painting, independently of its moving camera.
    return [(r.x-art.x)/art.width*393,(r.y-art.y)/art.width*393]
  })
  const first = await point()
  const readingAt = await page.evaluate(() => scrollY)
  await waitForPose(cherry, .87)
  const last = await point()
  expect(Math.hypot(last[0]-first[0],last[1]-first[1])).toBeGreaterThan(72)
  expect(await page.evaluate(() => scrollY)).toBe(readingAt)
  await page.emulateMedia({reducedMotion:'reduce'})
  await expect(page.locator('.cinematic-art')).toHaveCount(0)
})

test('the painted lantern stays on the original portrait if its separate animation artwork fails', async ({page,baseURL}) => {
  const broken = new URL(deployPath + 'motion/hill-lantern.webp',baseURL).href
  expectImageFailures(page,[broken])
  await page.route(broken,route => route.abort())
  await openBook(page)
  await expect(page.locator('#scene-01 .lantern-rig')).toHaveAttribute('data-ready','false')
  await expect(page.locator('#scene-01 [data-painted-detail="lantern-swing"]')).toBeVisible()
  await expect(page.locator('#scene-01 .scene-image')).toBeVisible()
})

test('a late mountain shot develops gently without changing the reading position', async ({page}) => {
  let arrive!: () => void
  const held = new Promise<void>(resolve => { arrive = resolve })
  await page.route('**/cinema/veranda.webp', async route => { await held; await route.continue() })
  try {
    await page.goto('./#scene-05', {waitUntil:'domcontentloaded'})
    const stage = await enterPainting(page, 5)
    const shot = stage.locator('.film-shot')
    await expect(shot).toHaveAttribute('data-arrival','pending')
    // The complete original can already play while its wide shot is delayed.
    await waitForPose(stage, .19)
    const readingAt = await page.evaluate(() => scrollY)
    const exposure = shot.locator('.film-exposure')
    const sampling = exposure.evaluate(async el => {
      const samples: number[] = []
      const deadline = performance.now() + 4000
      while (performance.now() < deadline) {
        await new Promise(requestAnimationFrame)
        if (el.parentElement!.dataset.arrival !== 'late') continue
        const opacity = Number(getComputedStyle(el).opacity)
        samples.push(opacity)
        if (opacity >= 1) break
      }
      return samples
    })
    arrive()
    const samples = await sampling
    expect(samples.some(alpha => alpha > 0 && alpha < 1)).toBe(true)
    expect(samples.at(-1)).toBe(1)
    expect(await page.evaluate(() => scrollY)).toBe(readingAt)
  } finally { arrive() }
})

test('the last painting opens out to the entire valley before the reader leaves its final sentence', async ({page}) => {
  await openBook(page)
  const art = await enterPainting(page, 20, .76)
  await expect(art.locator('[data-film-shot="valley"]')).toHaveAttribute('data-ready','true')
  await waitForPose(art, 1)
  await expect(art).toHaveAttribute('data-playback','complete')
  await page.evaluate(()=>scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.locator('#scene-20 .beat-text')).toBeInViewport()
})
