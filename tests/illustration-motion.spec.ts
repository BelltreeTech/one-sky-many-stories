import { expect } from '@playwright/test'
import { test, openBook, oracle } from './reader-harness'
import { enterPainting, waitForPose } from './playback-harness'

test('every painting plays to completion over still, verbatim English, then yields to reduced motion', async ({ page }) => {
  await page.clock.install()
  await openBook(page)
  const signatures = new Set<string>()
  for (const { id, text } of oracle.scenes) {
    const scene = page.locator('[data-scene="' + id + '"]')
    const stage = await enterPainting(page, id, id === 7 ? .18 : id === 12 ? .65 : id === 18 ? .57 : .5)
    await waitForPose(stage, .005)
    const overlay = scene.locator('[data-illustration-motion]')
    await expect(overlay).toHaveAttribute('data-illustration-motion', String(id))
    await expect(overlay).toHaveAttribute('aria-hidden', 'true')
    expect(await scene.locator('.passage').textContent()).toBe(text)
    const geometry = () => scene.locator('.beat-text').first().evaluate(el => ({
      y: scrollY, paragraphTop: el.getBoundingClientRect().top,
    }))
    const readingPosition = await geometry()
    const details = overlay.locator('[data-painted-detail]')
    const ink = () => details.locator(':scope > i').evaluateAll(nodes => nodes.map(node => {
      const style = (node as HTMLElement).style
      return style.transform + '|' + style.opacity
    }).join('/'))
    const initial = await ink()
    if (id === 12) {
      await expect(overlay.locator('.leo-book img')).toHaveAttribute('data-decoded', 'true')
      signatures.add('leo-book')
    } else {
      const names = await details.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-painted-detail')).join('/'))
      expect(names).toBeTruthy()
      signatures.add(names)
    }
    await page.clock.fastForward(1800)
    await expect(stage).toHaveAttribute('data-playback', 'playing')
    if (id !== 12) expect(await ink(), 'A still reader sees the ink move in scene ' + id).not.toBe(initial)
    await page.clock.fastForward(5500)
    await expect(stage).toHaveAttribute('data-playback', 'complete')
    expect(await geometry(), 'Playback preserves the reader’s paragraph, scene ' + id).toEqual(readingPosition)
    expect(await page.locator('[data-illustration-motion]').count()).toBeLessThanOrEqual(4)
  }
  expect(signatures.size).toBe(20)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('[data-illustration-motion], [data-playback]')).toHaveCount(0)
  await expect(page.locator('#scene-20 .passage')).toHaveText(oracle.scenes[19].text)
})
