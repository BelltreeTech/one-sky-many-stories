import { expect, type CDPSession, type Page } from '@playwright/test'
import { openBook, sceneAt, test } from './reader-harness'
import { stagePose, waitForPose } from './playback-harness'

test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Optical zoom and native touch panning use the Chromium device protocol.')
  await openBook(page)
})

async function drag(page: Page, device: CDPSession, x: number, y: number, dx: number, dy: number) {
  await device.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 6; i++) {
    await device.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x + dx * i / 6, y: y + dy * i / 6 }],
    })
    await page.waitForTimeout(20)
  }
  // Lift a stationary finger so browser momentum cannot carry the layout viewport away.
  await page.waitForTimeout(160)
  await device.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('optical zoom starts and resets the shot when the reader pans the visible viewport', async ({ page }) => {
  const device = await page.context().newCDPSession(page)
  await device.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
  // Center the horizontal view so only the later vertical pan reveals the scene.
  await drag(page, device, 162, 190, -105, 0)
  await expect.poll(() => page.evaluate(() => window.visualViewport!.offsetLeft)).toBeGreaterThan(60)
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
  // A whole 3.6-second shot could have finished while it was still outside.
  await page.waitForTimeout(3800)
  await expect(stage).toHaveAttribute('data-playback', 'waiting')
  expect(await stagePose(stage)).toBe(0)

  // Keep each stroke within the magnified phone's visible area.
  for (let i = 0; i < 2; i++) await drag(page, device, 96, 320, 0, -208)
  await expect.poll(visibleHeight).toBeGreaterThan(300)
  expect(await page.evaluate(() => scrollY)).toBe(layoutY)
  await expect(stage).toHaveAttribute('data-playback', 'playing')
  await waitForPose(stage, .02)

  for (let i = 0; i < 2; i++) await drag(page, device, 96, 70, 0, 215)
  await expect.poll(visibleHeight).toBe(0)
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
  await page.waitForTimeout(4800) // The 4.6-second book shot must still be waiting.
  await expect(stage).toHaveAttribute('data-playback', 'waiting')
  expect(await stagePose(stage)).toBe(0)

  for (let i = 0; i < 2; i++) await drag(page, device, 112, 120, -88, 0)
  await expect.poll(framing).toEqual({ verticallyInView: true, outsideRight: false, fullyInView: true })
  expect(await page.evaluate(() => scrollY)).toBe(layoutY)
  await expect(stage).toHaveAttribute('data-playback', 'playing')
  await waitForPose(stage, .02)
  await expect(stage).toHaveAttribute('data-playback', 'complete')
  await device.detach()
})
