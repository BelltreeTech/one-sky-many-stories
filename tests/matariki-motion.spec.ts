import { expect, type Locator } from '@playwright/test'
import { openBook, sceneAt, test } from './reader-harness'

function currentPose(stage: Locator) {
  return stage.evaluate(node => Number(getComputedStyle(node).getPropertyValue('--cinematic-progress')))
}

async function waitForFirstPose(stage: Locator) {
  await expect.poll(async () => {
    const pose = await currentPose(stage)
    return pose > .04 && pose < .4
  }).toBe(true)
}

async function leafEdge(stage: Locator) {
  return stage.locator('.notebook-strip').last().evaluate(element => {
    const edge = element.getBoundingClientRect()
    const sheet = element.closest('.portrait-sheet')!.getBoundingClientRect()
    return (edge.left + edge.width / 2 - sheet.left) / sheet.width
  })
}

async function centerWithOffset(stage: Locator, offset: number) {
  await stage.evaluate((element, distance) => {
    const bounds = element.getBoundingClientRect()
    window.scrollBy({ top: bounds.top + bounds.height / 2 - innerHeight / 2 + distance, behavior: 'instant' })
  }, offset)
}

// Sample a physical point on the moving layer, in CSS pixels relative to the
// plate, rather than counting the movement of the whole page during scroll.
async function paintedPoint(layer: Locator, x: number, y: number) {
  return layer.evaluate((element, point) => {
    const ink = element as HTMLElement
    const style = getComputedStyle(ink)
    const [ox, oy] = style.transformOrigin.split(' ').map(parseFloat)
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform)
    const p = matrix.transformPoint({ x: ink.offsetWidth * point.x - ox, y: ink.offsetHeight * point.y - oy })
    return { x: p.x + ox, y: p.y + oy }
  }, { x, y })
}

test('the painted lake, mantle, frond and farewell move visibly through an ordinary stroke', async ({ page }) => {
  await openBook(page)
  const scenes = [
    { id: 13, detail: 'memory-cloud', x: .6, y: .6 },
    { id: 14, detail: 'breaking-water', x: .85, y: .9 },
    { id: 15, detail: 'outer-mantle', x: .86, y: .55 },
    { id: 16, detail: 'new-frond', x: .7, y: .16 },
    { id: 20, detail: 'far-cloud', x: .6, y: .6 },
  ]
  for (const { id, detail, x, y } of scenes) {
    const stage = sceneAt(page, id).locator('.portrait-stage')
    const layer = stage.locator('[data-detail="' + detail + '"]')
    await centerWithOffset(stage, -105)
    await expect(layer).toBeVisible()
    await waitForFirstPose(stage)
    const first = await paintedPoint(layer, x, y)
    await centerWithOffset(stage, 105)
    await expect.poll(() => currentPose(stage)).toBeGreaterThan(.6)
    const second = await paintedPoint(layer, x, y)
    expect(Math.hypot(second.x - first.x, second.y - first.y), detail + ' travels in illustration space').toBeGreaterThan(20)
    await centerWithOffset(stage, -105)
    await expect.poll(async () => {
      const back = await paintedPoint(layer, x, y)
      return Math.hypot(back.x - first.x, back.y - first.y)
    }).toBeLessThan(2)
  }
})

test('the steam stays on its bowl, the notebook reveals its graphite, and light follows the path', async ({ page }) => {
  const requests: string[] = []
  page.on('request', req => { if (req.url().endsWith('/motion/matariki-paint.webp')) requests.push(req.url()) })
  await openBook(page)
  expect(requests, 'The later chapter painting is not requested at the cover').toHaveLength(0)
  const stage = sceneAt(page, 17).locator('.portrait-stage')
  const plume = stage.locator('[data-detail="bowl-steam"]')
  await centerWithOffset(stage, -105)
  await expect(plume).toBeVisible()
  await waitForFirstPose(stage)
  const tip = await paintedPoint(plume, .5, .16)
  const base = await paintedPoint(plume, .5, 1)
  await centerWithOffset(stage, 105)
  await expect.poll(async () => {
    const next = await paintedPoint(plume, .5, .16)
    return Math.hypot(next.x - tip.x, next.y - tip.y)
  }).toBeGreaterThan(24)
  const rim = await paintedPoint(plume, .5, 1)
  expect(Math.hypot(rim.x - base.x, rim.y - base.y)).toBeLessThan(2)
  for (const [id, detail] of [[18, 'undrawn-paper'], [19, 'path-light']] as const) {
    const stage = sceneAt(page, id).locator('.portrait-stage')
    const layer = stage.locator('[data-detail="' + detail + '"]')
    await centerWithOffset(stage, -105)
    await expect(layer).toBeVisible()
    const mask = () => layer.evaluate(el => getComputedStyle(el).maskImage)
    await waitForFirstPose(stage)
    const start = await mask()
    const firstEdge = id === 18 ? await leafEdge(stage) : undefined
    expect(start).toContain('linear-gradient')
    await centerWithOffset(stage, 105)
    await expect.poll(mask).not.toBe(start)
    await expect.poll(() => currentPose(stage)).toBeGreaterThan(.6)
    if (firstEdge !== undefined) {
      expect(firstEdge - await leafEdge(stage), 'The page crosses the gutter to the other side').toBeGreaterThan(.17)
    }
    await centerWithOffset(stage, -105)
    await expect.poll(mask).toBe(start)
  }
  expect(requests.length).toBeGreaterThan(0)
})
