import { ScrollTrigger } from 'gsap/ScrollTrigger'

type Phase = 'waiting' | 'playing' | 'complete'
type Clip = { phase: Phase; elapsed: number }
type Focus = number | readonly [number, number]
type PlaybackOptions = {
  duration: number
  focus: Focus
  focusX: Focus
  paint: (progress: number) => void
  ready?: () => boolean
}

// A very small magnified display can still frame the heart of a large subject.
function subjectFits(start: number, size: number, focus: Focus, viewStart: number, viewSize: number) {
  const [first, last] = typeof focus === 'number' ? [focus, focus] : focus
  const center = start + size * (first + last) / 2
  const radius = Math.min(size * (last - first) / 2, viewSize * .40)
  return center - radius >= viewStart && center + radius <= viewStart + viewSize
}

// The art element survives when React releases the expensive layers in a hidden
// tab. Its clock survives that pause too. A complete viewport exit starts a new visit.
const visits = new WeakMap<HTMLElement, Clip>()

export function playOnEntry(art: HTMLElement, { duration, focus, focusX, paint, ready }: PlaybackOptions) {
  const clip: Clip = visits.get(art) ?? { phase: 'waiting', elapsed: 0 }
  visits.set(art, clip)
  let frame = 0
  let lastTime: number | undefined

  function phase(value: Phase) {
    clip.phase = value
    art.dataset.playback = value
  }

  function pause() {
    cancelAnimationFrame(frame)
    frame = 0
    lastTime = undefined
  }

  function rewind() {
    pause()
    if (clip.phase !== 'waiting') {
      clip.elapsed = 0
      phase('waiting')
      paint(0)
    }
  }

  function tick(time: number) {
    frame = 0
    if (document.hidden) { pause(); return }
    if (lastTime !== undefined) clip.elapsed = Math.min(duration, clip.elapsed + Math.max(0, time - lastTime))
    lastTime = time
    paint(clip.elapsed / duration)
    if (clip.elapsed === duration) phase('complete')
    else frame = requestAnimationFrame(tick)
  }

  const viewport = window.visualViewport
  function visibleHeight(bounds: DOMRect) {
    const top = viewport?.offsetTop ?? 0
    const left = viewport?.offsetLeft ?? 0
    if (bounds.right <= left || bounds.left >= left + (viewport?.width ?? window.innerWidth)) return 0
    return Math.min(top + (viewport?.height ?? window.innerHeight), bounds.bottom) - Math.max(top, bounds.top)
  }

  function check() {
    if (document.hidden) { pause(); return }
    const bounds = art.getBoundingClientRect()
    const visible = visibleHeight(bounds)
    if (visible <= 0 || bounds.height <= 0) { rewind(); return }
    const { top, height } = bounds
    const viewTop = viewport?.offsetTop ?? 0
    const viewHeight = viewport?.height ?? window.innerHeight
    if (clip.phase === 'complete' || frame) return
    if (clip.phase === 'waiting' && (
      visible < .48 * Math.min(height, viewHeight) ||
      !subjectFits(top, height, focus, viewTop, viewHeight) ||
      !subjectFits(bounds.left, bounds.width, focusX, viewport?.offsetLeft ?? 0, viewport?.width ?? window.innerWidth) ||
      !assetsReady || (ready && !ready())
    )) return
    phase('playing')
    frame = requestAnimationFrame(tick)
  }

  // Give a newly mounted optional cut or sprite a short head start. A failed
  // optional image can never hold the whole shot or the reader's scroll.
  const pending = Array.from(art.querySelectorAll<HTMLImageElement>('.cinematic-art img, .leo-book img'))
    .filter(image => image.currentSrc || image.getAttribute('src'))
  let assetsReady = pending.length === 0
  let disposed = false
  function allowPlayback() {
    if (disposed || assetsReady) return
    assetsReady = true
    clearTimeout(grace)
    check()
  }
  const grace = assetsReady ? undefined : window.setTimeout(allowPlayback, 450)
  if (!assetsReady) void Promise.allSettled(pending.map(image => image.decode())).then(allowPlayback)

  phase(clip.phase)
  paint(clip.elapsed / duration)
  const trigger = ScrollTrigger.create({
    trigger: art, start: 'top bottom', end: 'bottom top',
    onUpdate: check, onToggle: check, onRefresh: check,
  })
  const exposure = ready ? new MutationObserver(check) : undefined
  exposure?.observe(art, { attributes: true, attributeFilter: ['data-ready'], subtree: true })
  viewport?.addEventListener('scroll', check, { passive: true })
  viewport?.addEventListener('resize', check)
  document.addEventListener('visibilitychange', check)
  check()

  return () => {
    disposed = true
    trigger.kill()
    exposure?.disconnect()
    viewport?.removeEventListener('scroll', check)
    viewport?.removeEventListener('resize', check)
    document.removeEventListener('visibilitychange', check)
    clearTimeout(grace)
    pause()
    const bounds = art.getBoundingClientRect()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        (!document.hidden && visibleHeight(bounds) <= 0)) visits.delete(art)
    delete art.dataset.playback
  }
}
