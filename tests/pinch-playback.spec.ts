import { expect, type CDPSession } from '@playwright/test'
import { openBook, sceneAt, test } from './reader-harness'
import { stagePose, waitForPose } from './playback-harness'

test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Optical zoom and native touch panning use the Chromium device protocol.')
  await page.clock.install()
  await openBook(page)
})

function pan(device: CDPSession, xDistance: number, yDistance: number) {
  return device.send('Input.synthesizeScrollGesture', {
    x: 80, y: 200, xDistance, yDistance, speed: 900, preventFling: true, gestureSourceType: 'touch',
  })
}

test('optical zoom starts and resets the shot when the reader pans the visible viewport', async ({ page }) => {
  const device = await page.context().newCDPSession(page)
  await device.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
  // Center the horizontal view so only the later vertical pan reveals the scene.
  await pan(device, -96, 0)
  const stage = sceneAt(page, 17).locator('.portrait-stage')
  // Just below the magnified display, but halfway inside the layout viewport.
  const layoutY = await stage.evaluate(art => {
    const screen = window.visualViewport!
    scrollBy({ top: art.getBoundingClientRect().top - screen.height - 16, behavior: 'instant' })
    return scrollY
  })
  const visibleHeight = () => stage.evaluate(art => {
    const screen = window.visualViewport!
    const bounds = art.getBoundingClientRect()
    return Math.max(0, Math.min(screen.offsetTop + screen.height, bounds.bottom) - Math.max(screen.offsetTop, bounds.top))
  })
  await expect(stage.locator('.film-shot')).toHaveAttribute('data-ready', 'true')
  expect(await visibleHeight()).toBe(0)
  await page.clock.fastForward(5500)
  await expect(stage).toHaveAttribute('data-playback', 'waiting')
  expect(await stagePose(stage)).toBe(0)

  await pan(device, 0, -405)
  expect(await page.evaluate(() => scrollY)).toBe(layoutY)
  expect(await visibleHeight()).toBeGreaterThan(300)
  await expect(stage).toHaveAttribute('data-playback', 'playing')
  await waitForPose(stage, .02)

  await pan(device, 0, 430)
  expect(await visibleHeight()).toBe(0)
  await expect(stage).toHaveAttribute('data-playback', 'waiting')
  expect(await stagePose(stage)).toBe(0)
  await device.detach()
})

test('the book stays open until horizontal panning brings it into the magnified view', async ({ page }) => {
  const device = await page.context().newCDPSession(page)
  await device.send('Emulation.setPageScaleFactor', { pageScaleFactor: 3 })
  const stage = sceneAt(page, 12).locator('.portrait-stage')
  const layoutY = await stage.evaluate(art => {
    const bounds = art.getBoundingClientRect()
    scrollBy({ top: bounds.top + bounds.height * .58 - window.visualViewport!.height / 2, behavior: 'instant' })
    return scrollY
  })
  const book = stage.locator('.leo-book')
  await expect(book.locator('img')).toHaveAttribute('data-decoded', 'true')
  const framing = () => book.evaluate(el => {
    const rect = el.getBoundingClientRect()
    const view = window.visualViewport!
    return {
      verticallyInView: rect.top >= view.offsetTop && rect.bottom <= view.offsetTop + view.height,
      outsideRight: rect.left >= view.offsetLeft + view.width,
      fullyInView: rect.left >= view.offsetLeft && rect.right <= view.offsetLeft + view.width,
    }
  })
  expect(await framing()).toEqual({ verticallyInView: true, outsideRight: true, fullyInView: false })
  await page.clock.fastForward(5500)
  await expect(stage).toHaveAttribute('data-playback', 'waiting')
  expect(await stagePose(stage)).toBe(0)

  await pan(device, -155, 0)
  expect(await page.evaluate(() => scrollY)).toBe(layoutY)
  expect(await framing()).toEqual({ verticallyInView: true, outsideRight: false, fullyInView: true })
  await expect(stage).toHaveAttribute('data-playback', 'playing')
  await waitForPose(stage, .02)
  await page.clock.fastForward(5500)
  await expect(stage).toHaveAttribute('data-playback', 'complete')
  await device.detach()
})
