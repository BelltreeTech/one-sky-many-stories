import { expect } from '@playwright/test'
import { openBook, oracle, sceneAt, test } from './reader-harness'
import { enterPainting, leavePainting, stagePose, waitForPose } from './playback-harness'

test('a painting waits at the edge, finishes without scrolling, and plays again when entered from below', async ({ page }) => {
  await page.clock.install()
  await openBook(page)
  const scene = sceneAt(page, 6)
  const stage = scene.locator('.portrait-stage')
  await stage.evaluate(el => {
    const r = el.getBoundingClientRect()
    scrollBy({ top: r.top - innerHeight + Math.min(innerHeight, r.height) * .18, behavior: 'instant' })
  })
  await expect(stage).toHaveAttribute('data-playback', 'waiting')
  await page.clock.fastForward(6000)
  expect(await stagePose(stage)).toBe(0)
  await enterPainting(page, 6)
  await waitForPose(stage, .015)
  await page.clock.fastForward(840)
  const moving = await stagePose(stage)
  expect(moving).toBeGreaterThan(.18)
  expect(moving).toBeLessThan(.75)
  // A small reverse movement within the same painting is a reading adjustment.
  await page.evaluate(() => scrollBy({ top: -35, behavior: 'instant' }))
  const y = await page.evaluate(() => scrollY)
  await page.clock.runFor(64)
  expect(await stagePose(stage)).toBeGreaterThanOrEqual(moving)
  await page.clock.fastForward(5000)
  await expect(stage).toHaveAttribute('data-playback', 'complete')
  expect(await stagePose(stage)).toBe(1)
  expect(await page.evaluate(() => scrollY)).toBe(y)
  expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[5].text)
  await leavePainting(page, 6, 'below')
  await page.clock.fastForward(6000)
  await enterPainting(page, 6)
  await waitForPose(stage, .01)
  expect(await stagePose(stage), 'Re-entry from below begins the same shot from its opening').toBeLessThan(.3)
  await page.clock.fastForward(900)
  await leavePainting(page, 6, 'above')
  await page.clock.fastForward(6000)
  await enterPainting(page, 6)
  await waitForPose(stage, .01)
  expect(await stagePose(stage), 'Leaving mid-shot also resets its clock').toBeLessThan(.3)
})

test('a hidden tab pauses its shot, and reduced motion keeps the static painting and text', async ({ page }) => {
  await page.clock.install()
  await openBook(page)
  const stage = await enterPainting(page, 14)
  await waitForPose(stage, .01)
  await page.clock.fastForward(1400)
  const before = await stagePose(stage)
  const setHidden = (value: boolean) => page.evaluate(hidden => {
    if (hidden) Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    else Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  }, value)
  await setHidden(true)
  await page.clock.runFor(64)
  // A hidden tab may retain a frozen pose or release its paint surfaces.
  const hiddenPose = () => stage.evaluate(node => node.style.getPropertyValue('--cinematic-progress'))
  const held = await hiddenPose()
  await page.clock.fastForward(15000)
  expect(await hiddenPose()).toBe(held)
  await setHidden(false)
  await expect(stage).toHaveAttribute('data-playback', 'playing')
  const restored = await stagePose(stage)
  expect(restored).toBeGreaterThanOrEqual(before)
  expect(restored).toBeLessThan(before + .12)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('[data-playback]')).toHaveCount(0)
  await expect(stage.locator('.scene-image')).toHaveAttribute('src', /portrait\/14\.webp/)
  await expect(stage.locator('.cinematic-art')).toHaveCount(0)
  expect(await sceneAt(page, 14).locator('.passage').textContent()).toBe(oracle.scenes[13].text)
})

test('a shallow landscape viewport waits for the star cluster, the book and the notebook to enter', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 320 })
  await page.clock.install()
  await openBook(page)
  // These marks come from the subjects on the upright artwork. A strip of the
  // painted subject remains above the viewport although half a screen is filled.
  for (const [id, topMark, center] of [[7, .115, .18], [12, .51, .58], [18, .448, .57]]) {
    const stage = sceneAt(page, id).locator('.portrait-stage')
    const visibleFraction = await stage.evaluate((el, mark) => {
      const r = el.getBoundingClientRect()
      scrollBy({ top: r.top + r.height * mark + 10, behavior: 'instant' })
      const actual = el.getBoundingClientRect()
      return (Math.min(innerHeight, actual.bottom) - Math.max(0, actual.top)) / Math.min(actual.height, innerHeight)
    }, topMark)
    expect(visibleFraction).toBeGreaterThan(.5)
    await expect(stage).toHaveAttribute('data-playback', 'waiting')
    await page.clock.fastForward(6000)
    expect(await stagePose(stage)).toBe(0)
    await enterPainting(page, id, center)
    await waitForPose(stage, .01)
    await page.clock.fastForward(5500)
    await expect(stage).toHaveAttribute('data-playback', 'complete')
  }
})

test('the grandmother’s memory and the final three friends remain in view when their films begin', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.clock.install()
  await openBook(page)
  // With half a portrait visible, the lamp and book in scene four can already
  // be on screen while the grandmother is above it. Approaching scene twenty
  // from the cover can likewise show only sky, before the friends enter.
  for (const { id, direction, subjects, center } of [
    { id: 4, direction: 'from below', subjects: [.15, .60], center: .375 },
    { id: 20, direction: 'from above', subjects: [.62, .76], center: .695 },
  ]) {
    const stage = sceneAt(page, id).locator('.portrait-stage')
    async function showFraction(fraction: number) {
      await stage.evaluate((el, { fraction, fromBelow }) => {
        const r = el.getBoundingClientRect()
        const exposed = Math.min(r.height, innerHeight) * fraction
        const top = fromBelow ? exposed - r.height : innerHeight - exposed
        scrollBy({ top: r.top - top, behavior: 'instant' })
      }, { fraction, fromBelow: direction === 'from below' })
    }
    const landmarks = () => stage.locator('.portrait-sheet').evaluate((sheet, marks) => {
      const r = sheet.getBoundingClientRect()
      return marks.map(mark => {
        const y = r.top + r.height * mark
        return y >= 0 && y < innerHeight
      })
    }, subjects)
    await showFraction(.12)
    await expect(stage).toHaveAttribute('data-playback', 'waiting')
    await showFraction(.50)
    await page.clock.runFor(96)
    expect(await landmarks()).toContain(false)
    await page.clock.fastForward(6000)
    await expect(stage).toHaveAttribute('data-playback', 'waiting')
    expect(await stagePose(stage)).toBe(0)

    await enterPainting(page, id, center)
    await waitForPose(stage, .01)
    expect(await landmarks()).toEqual([true, true])
    const readingPosition = await page.evaluate(() => scrollY)
    await page.clock.fastForward(5600)
    await expect(stage).toHaveAttribute('data-playback', 'complete')
    expect(await landmarks()).toEqual([true, true])
    expect(await page.evaluate(() => scrollY)).toBe(readingPosition)
  }
})
