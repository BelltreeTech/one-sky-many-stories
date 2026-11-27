import { expect, type Locator, type Page } from '@playwright/test'
import { sceneAt } from './reader-harness'

export function stagePose(stage: Locator) {
  return stage.evaluate(art => Number.parseFloat(getComputedStyle(art).getPropertyValue('--cinematic-progress')))
}

export async function waitForPose(stage: Locator, minimum: number) {
  await expect.poll(() => stagePose(stage), { intervals: [16, 32, 50] }).toBeGreaterThanOrEqual(minimum)
}

export async function enterPainting(page: Page, id: number, focusY = .5) {
  const stage = sceneAt(page, id).locator('.portrait-stage')
  await stage.evaluate((art, focus) => {
    const bounds = art.getBoundingClientRect()
    scrollBy({ top: bounds.top + bounds.height * focus - innerHeight / 2, behavior: 'instant' })
  }, focusY)
  await expect(stage).toHaveAttribute('data-playback', /^(playing|complete)$/)
  return stage
}

export async function leavePainting(page: Page, id: number, side?: 'above' | 'below') {
  const stage = sceneAt(page, id).locator('.portrait-stage')
  await stage.evaluate((art, side) => {
    const bounds = art.getBoundingClientRect()
    const before = scrollY + bounds.top - innerHeight - 8
    const after = scrollY + bounds.bottom + 8
    scrollTo({ top: side === 'below' || (side !== 'above' && before < 0) ? after : before, behavior: 'instant' })
  }, side)
  await expect.poll(() => stage.evaluate(art => {
    const bounds = art.getBoundingClientRect()
    return (bounds.bottom <= 0 || bounds.top >= innerHeight) && (art.getAttribute('data-playback') ?? 'waiting') === 'waiting'
  })).toBe(true)
}
