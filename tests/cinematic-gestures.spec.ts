import { expect, type Locator } from '@playwright/test'
import { test, openBook, expectImageFailures, deployPath } from './reader-harness'

const settle = (art: Locator) => art.evaluate(() => new Promise<void>(done =>
  requestAnimationFrame(() => requestAnimationFrame(() => done()))))

test('the hand-held lantern and foreground cherry blossoms travel with one thumb stroke and retrace it', async ({ page }) => {
  await openBook(page)
  const art = page.locator('#scene-01 .portrait-stage')
  const lantern = art.locator('.lantern-rig')
  await expect(lantern).toHaveAttribute('data-ready','true')
  const angle = () => lantern.locator('.lantern-pivot').evaluate(el => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return 180 * Math.atan2(m.b,m.a) / Math.PI
  })
  const start = await angle()
  await page.evaluate(() => scrollBy(0,215))
  await settle(art)
  expect(await angle() - start).toBeGreaterThan(37)
  await page.evaluate(() => scrollTo(0,0))
  await settle(art)
  expect(await angle()).toBeCloseTo(start,1)

  const cherry = page.locator('#scene-05 .portrait-stage')
  await cherry.evaluate(el => el.scrollIntoView({ block:'center' }))
  const petal = cherry.locator('.windborne').first()
  await expect(petal).toBeVisible()
  const point = () => petal.evaluate(el => {
    const r = el.getBoundingClientRect(), art = el.closest('.portrait-sheet')!.getBoundingClientRect()
    // Express the petal in portrait coordinates at iPhone width. Both native
    // document travel and the scale of the parent camera cancel out.
    return [(r.x-art.x)/art.width*393,(r.y-art.y)/art.width*393]
  })
  await page.evaluate(() => scrollBy(0,-107))
  await settle(cherry)
  const first = await point()
  await page.evaluate(() => scrollBy(0,215))
  await settle(cherry)
  const last = await point()
  expect(Math.hypot(last[0]-first[0],last[1]-first[1])).toBeGreaterThan(72)
  await page.evaluate(() => scrollBy(0,-215))
  await settle(cherry)
  const back = await point()
  expect(Math.hypot(back[0]-first[0],back[1]-first[1])).toBeLessThan(1)
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

test('a late mountain shot joins the next gesture without replacing a still reading position', async ({page}) => {
  let arrive!: () => void
  const held = new Promise<void>(resolve => { arrive = resolve })
  await page.route('**/cinema/veranda.webp', async route => { await held; await route.continue() })
  try {
    await page.goto('./#scene-05', {waitUntil:'domcontentloaded'})
    const stage = page.locator('#scene-05 .portrait-stage')
    await stage.evaluate(el => el.scrollIntoView({block:'center',behavior:'instant'}))
    const shot = stage.locator('.film-shot')
    await expect(shot).toHaveAttribute('data-arrival','pending')
    await page.waitForTimeout(800)
    arrive()
    await expect(shot).toHaveAttribute('data-arrival','late')
    const exposure = shot.locator('.film-exposure')
    await expect(exposure).toHaveCSS('opacity','0')
    await page.evaluate(()=>scrollBy(0,-45))
    await expect.poll(()=>exposure.evaluate(el=>Number(getComputedStyle(el).opacity))).toBeGreaterThan(.3)
    await page.evaluate(()=>scrollBy(0,-90))
    await expect(exposure).toHaveCSS('opacity','1')
  } finally { arrive() }
})

test('the final sentence reaches the entire valley on every viewport', async ({page}) => {
  await openBook(page)
  await page.evaluate(()=>scrollTo(0, document.documentElement.scrollHeight))
  const art = page.locator('#scene-20 .portrait-stage')
  await expect(art.locator('[data-film-shot="valley"]')).toHaveAttribute('data-ready','true')
  await expect.poll(()=>art.evaluate(el=>el.style.getPropertyValue('--cinematic-progress'))).toBe('1')
  await expect(page.locator('#scene-20 .beat-text')).toBeInViewport()
})
