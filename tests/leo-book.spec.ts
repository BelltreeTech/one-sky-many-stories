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

// Observe the first paper-only frame before timing the settle. A slow browser
// can take several frames to present the closed cover after the native scroll.
async function closeBookAndSampleLight(stage: Locator, delayedTimestamp = false) {
  return stage.evaluate(async (node, delayClock) => {
    const surface = node.querySelector<HTMLCanvasElement>('.leo-book canvas')!
    const ctx = surface.getContext('2d')!
    const originalRAF = window.requestAnimationFrame
    if (delayClock) window.requestAnimationFrame = cb => originalRAF.call(window, stamp => cb(stamp - 2000))
    const nextPaint = () => new Promise<void>(done => originalRAF.call(window, () => done()))
    const painted = () => {
      const pixels = ctx.getImageData(0, 0, surface.width, surface.height).data
      let count = 0
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 16) count++
      return count
    }
    try {
      const rect = node.getBoundingClientRect()
      window.scrollBy({ top: rect.top + rect.height * .58 - innerHeight * .24, behavior: 'instant' })
      let first = 0
      const deadline = performance.now() + 2500
      do {
        await nextPaint()
        first = painted()
      } while ((first <= 8 || first >= 1600) && performance.now() < deadline)
      // Give the 460ms paper motion time to finish, then sample a presented
      // frame without competing for GPU readback throughout the animation.
      await new Promise(resolve => setTimeout(resolve, 550))
      await nextPaint()
      await nextPaint()
      return { first, last: painted() }
    } finally {
      if (delayClock) window.requestAnimationFrame = originalRAF
    }
  }, delayedTimestamp)
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
  const settled = await closeBookAndSampleLight(stage)
  expect(settled.first, 'Lit leaves briefly remain over the closed cover').toBeGreaterThan(8)
  expect(settled.first).toBeLessThan(1600)
  expect(settled.last).toBe(0)

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

test('the book stops drawing while only its passage is visible and restores the current pose on return', async ({ page }) => {
  await openBook(page)
  const stage = sceneAt(page, 12).locator('.portrait-stage')
  await placeBook(stage, .85)
  await expect(stage.locator('.leo-book img')).toHaveAttribute('data-decoded', 'true')
  await expect.poll(async () => (await visibleBookPixels(stage)).paper).toBeGreaterThan(1800)
  const open = await visibleBookPixels(stage)
  const hidden = await stage.evaluate(async node => {
    const surface = node.querySelector<HTMLCanvasElement>('.leo-book canvas')!
    const ctx = surface.getContext('2d')!
    let draws = 0
    const originalClear = ctx.clearRect
    // Every book paint begins by clearing this canvas, even a frame whose
    // last small strip of light is already transparent.
    ctx.clearRect = new Proxy(originalClear, {
      apply(target, receiver, args) { draws++; return Reflect.apply(target, receiver, args) },
    })
    try {
      // Rendering frames and native intersection notifications are separate
      // queues. Observe this same canvas leaving before counting idle paints.
      const outside = new Promise<void>(resolve => {
        const observer = new IntersectionObserver(entries => {
          const entry = entries[entries.length - 1]
          if (entry.boundingClientRect.bottom >= 0 || entry.intersectionRect.height > 0) return
          observer.disconnect()
          resolve()
        })
        observer.observe(surface)
      })
      window.scrollBy({ top: surface.getBoundingClientRect().bottom + 12, behavior: 'instant' })
      await outside
      await new Promise(requestAnimationFrame)
      const first = draws
      await new Promise(resolve => setTimeout(resolve, 550))
      const text = node.closest('section')!.querySelector('.beat-text')!.getBoundingClientRect()
      return { draws: draws - first, bottom: surface.getBoundingClientRect().bottom,
        passageVisible: text.top >= 0 && text.bottom <= innerHeight, sameCanvas: surface.isConnected }
    } finally { ctx.clearRect = originalClear }
  })
  expect(hidden.bottom).toBeLessThan(0)
  expect(hidden.passageVisible).toBe(true)
  expect(hidden.sameCanvas).toBe(true)
  expect(hidden.draws, 'The paper-edge animation releases the offscreen canvas').toBe(0)

  await placeBook(stage, .52)
  await expect.poll(async () => (await visibleBookPixels(stage)).paper).toBeLessThan(open.paper * .8)
  await expect.poll(async () => (await visibleBookPixels(stage)).paper).toBeGreaterThan(120)
})

test('a delayed frame timestamp still lets the brief paper reflection return to the original painting', async ({ page }) => {
  await openBook(page)
  const stage = sceneAt(page, 12).locator('.portrait-stage')
  await placeBook(stage, .52)
  await expect(stage.locator('.leo-book img')).toHaveAttribute('data-decoded', 'true')
  await expect.poll(async () => (await visibleBookPixels(stage)).painted).toBeGreaterThan(1600)
  const settled = await closeBookAndSampleLight(stage, true)
  expect(settled.first).toBeGreaterThan(8)
  expect(settled.first).toBeLessThan(1600)
  expect(settled.last).toBe(0)
})

test('the book appears when an edge-touching canvas first gains visible area', async ({ page }) => {
  // Position the book outside the viewport before its canvas is created.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openBook(page)
  const stage = sceneAt(page, 12).locator('.portrait-stage')
  await placeBook(stage, .85)
  // Keep fractional model-specific camera scales from rounding the exact
  // boundary. Only the geometry of the observer target matters to this test.
  await page.addStyleTag({ content: '#scene-12 .portrait-camera { transform: none !important; }' })
  await stage.evaluate(el => { el.style.transform = 'translateY(50vh)' })
  // Exercise coalesced notifications with records supplied by the browser
  // for the same real canvas. Other observers and ordinary deliveries pass through.
  const batches = await page.evaluateHandle(() => {
    const Native = window.IntersectionObserver
    let queued: IntersectionObserverEntry[] | null = null
    let deliver: IntersectionObserverCallback | undefined
    let owner: IntersectionObserver | undefined
    let latestHeight: number | undefined
    window.IntersectionObserver = class extends Native {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super((entries, observer) => {
          if (entries[0].target.matches('.leo-book canvas')) {
            const last = entries[entries.length - 1]
            latestHeight = last.isIntersecting ? last.intersectionRect.height : -1
            if (queued) {
              queued.push(...entries)
              deliver = callback
              owner = observer
              return
            }
          }
          callback(entries, observer)
        }, options)
      }
    }
    return {
      hold() { queued = [] },
      count() { return queued?.length ?? 0 },
      height() { return latestHeight },
      flush() {
        const entries = queued!
        queued = null
        const canvas = entries[0].target as HTMLCanvasElement
        const ctx = canvas.getContext('2d')!
        const clear = ctx.clearRect
        let draws = 0
        ctx.clearRect = new Proxy(clear, { apply(fn, dest, args) { draws++; return Reflect.apply(fn, dest, args) } })
        try { deliver!(entries, owner!) } finally { ctx.clearRect = clear }
        return { draws, heights: entries.map(e => e.intersectionRect.height) }
      },
      restore() { queued = null; window.IntersectionObserver = Native },
    }
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(stage.locator('.leo-book img')).toHaveAttribute('data-decoded', 'true')

  const enter = (gap: number) => stage.evaluate(async (element, offset) => {
    const canvas = element.querySelector<HTMLCanvasElement>('.leo-book canvas')!
    const shift = new DOMMatrix(getComputedStyle(element).transform).m42
    const edge = shift + innerHeight - canvas.getBoundingClientRect().top
    element.style.transform = 'translateY(' + (edge + offset) + 'px)'
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    const rect = canvas.getBoundingClientRect()
    return Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))
  }, gap)
  try {
    expect(await enter(6)).toBe(0)
    expect(await enter(0)).toBe(0)
    expect((await visibleBookPixels(stage)).painted).toBe(0)
    expect(await enter(-8)).toBeCloseTo(8, 2)
    await expect.poll(async () => (await visibleBookPixels(stage)).paper).toBeGreaterThan(1800)
    const paintedAfterBatch: boolean[] = []
    for (const gaps of [[0, -8], [-8, 0]]) {
      // Cross the positive threshold both ways so each delivery contains
      // two genuine records even on engines that omit a zero-area first contact.
      const start = gaps[0] === 0 ? -8 : 6
      await enter(start)
      await expect.poll(() => batches.evaluate(b => b.height())).toBeCloseTo(start < 0 ? 8 : -1, 2)
      await batches.evaluate(b => b.hold())
      await enter(gaps[0])
      await expect.poll(() => batches.evaluate(b => b.count())).toBe(1)
      await enter(gaps[1])
      await expect.poll(() => batches.evaluate(b => b.count())).toBe(2)
      const result = await batches.evaluate(b => b.flush())
      for (const [index, height] of result.heights.entries()) {
        if (gaps[index] === 0) expect(height).toBe(0)
        else expect(height).toBeCloseTo(8, 2)
      }
      paintedAfterBatch.push(result.draws > 0)
    }
    expect(paintedAfterBatch, 'Only the latest record determines whether the canvas paints').toEqual([true, false])
  } finally {
    await batches.evaluate(b => b.restore())
    await batches.dispose()
  }
  // The last batch ended at the edge. An ordinary native entry must fill
  // the canvas again, even if the compositor discarded its old backing store.
  await stage.locator('.leo-book canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  })
  expect(await enter(-8)).toBeCloseTo(8, 2)
  await expect.poll(async () => (await visibleBookPixels(stage)).paper).toBeGreaterThan(1800)
})
