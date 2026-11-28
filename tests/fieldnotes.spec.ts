import { expect } from '@playwright/test'
import { openBook, oracle, sceneAt, test } from './reader-harness'
import { stagePose } from './playback-harness'

test('late watercolours develop on the notebook without changing its framing or reading position', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/cinema/notebook-memories.webp', async route => {
    await held
    await route.continue()
  })
  try {
    await page.clock.install({ time: new Date('2025-03-01T00:00:00Z') })
    await page.clock.pauseAt(new Date('2025-03-01T00:10:00Z'))
    await openBook(page)
    const scene = sceneAt(page, 18)
    const stage = scene.locator('.portrait-stage')
    const exposure = stage.locator('[data-field-notes="three-skies"]')
    await stage.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await expect.poll(async () => {
      await page.clock.runFor(32)
      return stage.getAttribute('data-playback')
    }, { intervals: [16] }).toBe('playing')
    await expect.poll(async () => {
      const remaining = .31 - await stagePose(stage)
      if (remaining > 0) await page.clock.runFor(Math.max(16, Math.ceil(remaining * 4600)))
      return stagePose(stage)
    }, { intervals: [16] }).toBeGreaterThanOrEqual(.31)
    expect(await stagePose(stage)).toBeLessThan(.32)
    const framing = () => scene.evaluate(section => ({
      camera: getComputedStyle(section.querySelector('.portrait-sheet')!).transform,
      scroll: scrollY,
      english: [...section.querySelectorAll('.beat-text')].map(p => p.textContent).join(''),
    }))
    await expect(exposure).toHaveAttribute('data-ready', 'false')
    const before = await framing()
    expect(before.english).toBe(oracle.scenes[17].text)
    release()
    // The scene clock stays frozen while the independent image decoder finishes.
    await expect(exposure).toHaveAttribute('data-ready', 'true')
    expect(await framing()).toEqual(before)
  } finally { release() }
})
