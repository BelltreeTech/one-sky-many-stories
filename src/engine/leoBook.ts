import { between } from './sceneTransition'

// Each frame uses the painting's blue Pegasus, the same hinge and the original
// hands in front. The sixth row contains only the lit, fanned edges of the paper.
const columns = 5
const lastPose = 24
const hingeClosed = .72
const reflectionEnd = .82
const edgeAtClosure = 1 - between(hingeClosed, .66, reflectionEnd)

export function attachLeoBook(stage: HTMLElement) {
  const surface = stage.querySelector<HTMLCanvasElement>('.leo-book canvas')
  const context = surface?.getContext('2d') ?? null
  let atlas: HTMLImageElement | null = null
  let visible = false
  let position: number | undefined
  let reflection = 0
  let settleFrame = 0
  let settleStart = 0

  function drawPose(index: number, alpha: number) {
    if (!surface || !context || !atlas || alpha <= 0) return
    const { width, height } = surface
    const x = (index % columns) * width
    const y = Math.floor(index / columns) * height
    context.globalAlpha = alpha
    context.drawImage(atlas, x, y, width, height, 0, 0, width, height)
  }

  function paint(paperEdge = reflection) {
    if (!visible || !surface || !context || !atlas || position === undefined) return
    context.clearRect(0, 0, surface.width, surface.height)
    if (position < 1) {
      const pose = position * lastPose
      const lower = Math.floor(pose)
      drawPose(lower, 1)
      drawPose(lower + 1, pose - lower)
    }
    // After the hinge has closed, only the lit paper edge is left. Once that
    // has settled, every pixel comes from the original painting again.
    const fan = paperEdge * 4
    if (fan > .03) drawPose(25 + Math.ceil(fan), Math.min(fan, 1))
    context.globalAlpha = 1
  }

  function ready() {
    atlas = stage.querySelector<HTMLImageElement>('.leo-book img[data-decoded="true"]')
    paint()
  }
  function stopSettling() {
    cancelAnimationFrame(settleFrame)
    settleFrame = 0
  }
  // Use presentation time here: the timestamp supplied to an overdue RAF can
  // predate the frame on which the lit edge first reached the reader.
  function settle() {
    settleFrame = 0
    if (!visible || document.hidden) return
    const fade = 1 - between(performance.now() - settleStart, 0, 140)
    paint(Math.max(reflection, edgeAtClosure * fade))
    if (fade > 0) settleFrame = requestAnimationFrame(settle)
  }
  // The passage can remain visible after the small book leaves the screen.
  // Keep its film time, and paint that pose when its own crop re-enters.
  // Edge contact alone counts as an intersection. The positive threshold
  // notifies us again when the first painted pixels enter.
  const viewport = new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1]
    visible = entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0
    if (visible) paint()
    else stopSettling()
  }, { threshold: Number.EPSILON })
  if (surface) viewport.observe(surface)
  stage.addEventListener('leo-book-decoded', ready)
  ready()

  return {
    update(progress: number) {
      const next = between(progress, .18, hingeClosed)
      const edge = between(progress, .30, .60) * (1 - between(progress, .66, reflectionEnd))
      if (next === position && edge === reflection) return
      // A long frame can jump from a moving cover past the entire reflection.
      // Give the closed hinge its brief lit edge, even on the final tick.
      const missedEdge = visible && atlas && position !== undefined && position < 1 && next === 1 && edge < .25
      position = next
      reflection = edge
      if (next < 1 && settleFrame) stopSettling()
      if (missedEdge && !document.hidden) {
        settleStart = performance.now()
        settle()
      } else if (!settleFrame) paint()
    },
    destroy() {
      stopSettling()
      viewport.disconnect()
      stage.removeEventListener('leo-book-decoded', ready)
      if (visible && surface && context) context.clearRect(0, 0, surface.width, surface.height)
    },
  }
}
