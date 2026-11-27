import { between } from './sceneTransition'

// Each frame uses the painting's blue Pegasus, the same hinge and the original
// hands in front. The sixth row contains only the lit, fanned edges of the paper.
const columns = 5
const lastPose = 24
const settleDuration = 460

export function attachLeoBook(stage: HTMLElement) {
  const surface = stage.querySelector<HTMLCanvasElement>('.leo-book canvas')
  const context = surface?.getContext('2d') ?? null
  let atlas: HTMLImageElement | null = null
  let visible = false
  let position: number | undefined
  let impulse = 0
  let lastMovement = 0
  let settlingFrame = 0

  function drawPose(index: number, alpha: number) {
    if (!surface || !context || !atlas || alpha <= 0) return
    const { width, height } = surface
    const x = (index % columns) * width
    const y = Math.floor(index / columns) * height
    context.globalAlpha = alpha
    context.drawImage(atlas, x, y, width, height, 0, 0, width, height)
  }

  function remaining(time: number) {
    const elapsed = Math.max(0, time - lastMovement)
    return impulse * Math.max(0, 1 - elapsed / settleDuration) ** 2
  }

  function paint(time: number) {
    if (!visible || !surface || !context || !atlas || position === undefined) return
    context.clearRect(0, 0, surface.width, surface.height)
    if (position < 1) {
      const pose = position * lastPose
      const lower = Math.floor(pose)
      drawPose(lower, 1)
      drawPose(lower + 1, pose - lower)
    }
    // Once closed, only the lit paper edge can remain for a moment. Then the
    // overlay is clear and every visible pixel comes from the original book.
    const fan = remaining(time) * 4
    if (fan > .03) drawPose(25 + Math.ceil(fan), Math.min(fan, 1))
    context.globalAlpha = 1
  }

  function settle() {
    // Measure from the same clock as the gesture. On a delayed WebKit frame,
    // the presentation timestamp can still precede the latest scroll update.
    const now = performance.now()
    paint(now)
    settlingFrame = remaining(now) > 0 ? requestAnimationFrame(settle) : 0
  }

  function ready() {
    atlas = stage.querySelector<HTMLImageElement>('.leo-book img[data-decoded="true"]')
    paint(performance.now())
  }
  function stopSettling() {
    cancelAnimationFrame(settlingFrame)
    settlingFrame = 0
    impulse = 0
  }
  // The passage can remain visible after the small book leaves the screen.
  // Keep its scroll position, and paint that pose when its own crop re-enters.
  // Edge contact alone counts as an intersection. The positive threshold
  // notifies us again when the first painted pixels enter.
  const viewport = new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1]
    visible = entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0
    if (visible) paint(performance.now())
    else stopSettling()
  }, { threshold: Number.EPSILON })
  if (surface) viewport.observe(surface)
  stage.addEventListener('leo-book-decoded', ready)
  ready()

  return {
    update(progress: number) {
      const next = between(progress, .33, .67)
      if (next === position) return
      const time = performance.now()
      if (visible && position !== undefined && atlas?.isConnected) {
        impulse = Math.min(1, remaining(time) + Math.abs(next - position) * 5)
        lastMovement = time
        if (!settlingFrame) settlingFrame = requestAnimationFrame(settle)
      }
      position = next
      paint(time)
    },
    destroy() {
      viewport.disconnect()
      stopSettling()
      stage.removeEventListener('leo-book-decoded', ready)
      if (visible && surface && context) context.clearRect(0, 0, surface.width, surface.height)
    },
  }
}
