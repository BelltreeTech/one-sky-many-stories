import { useLayoutEffect, useState, useSyncExternalStore } from 'react'

const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
function subscribe(onChange: () => void) {
  preference.addEventListener('change', onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    preference.removeEventListener('change', onChange)
    document.removeEventListener('visibilitychange', onChange)
  }
}
export function useMotionEnabled() {
  return useSyncExternalStore(subscribe, () => !preference.matches && !document.hidden)
}

type ZoomAnchor = { element: HTMLElement; progress: number; viewportFraction: number }

// Prefer a readable paragraph on screen. Between paragraphs, hold the point in
// the illustration that was passing through the center of the screen.
function captureZoomAnchor(steps: NodeListOf<HTMLElement>, index: number, height: number): ZoomAnchor {
  let element = steps[index]
  let nearest = Infinity
  for (let i = Math.max(0, index - 1); i <= Math.min(steps.length - 1, index + 1); i++) {
    const text = steps[i].querySelector<HTMLElement>('.beat-text')
    if (!text) continue
    const rect = text.getBoundingClientRect()
    const visible = Math.min(height, rect.bottom) - Math.max(0, rect.top)
    const distance = Math.abs((rect.top + rect.bottom) / 2 - height / 2)
    if (visible >= Math.min(24, rect.height / 2) && distance < nearest) { element = text; nearest = distance }
  }
  const rect = element.getBoundingClientRect()
  const point = (Math.max(0, rect.top) + Math.min(height, rect.bottom)) / 2
  return { element, progress: (point - rect.top) / Math.max(1, rect.height), viewportFraction: point / height }
}

// Follow the part of the strip passing through the viewport center.
export function useScrollController() {
  const [place, setPlace] = useState({ scene: 1, beat: 1 })
  useLayoutEffect(() => {
    const strip = document.querySelector<HTMLElement>('main.portrait-reader')!
    const steps = strip.querySelectorAll<HTMLElement>('[data-beat]')
    let frame = 0
    const viewport = window.visualViewport
    let previous: { width: number; stripWidth: number; y: number; anchor: ZoomAnchor } | undefined
    function locate() {
      frame = 0
      if (!steps.length) return
      const height = window.innerHeight
      const middle = height / 2
      const width = document.documentElement.clientWidth
      const stripWidth = strip.clientWidth
      // A rotation, split view, or Safari Page Zoom reflows the same strip.
      // Preserve the text or illustration point the reader was looking at.
      // A pinch changes the visual viewport only; let Safari own that motion.
      const settled = !viewport || Math.abs(viewport.width - width) < 2
      if (settled && previous && previous.y > 0 && (width !== previous.width || stripWidth !== previous.stripWidth)) {
        const { element, progress, viewportFraction } = previous.anchor
        const bounds = element.getBoundingClientRect()
        window.scrollBy({ top: bounds.top + bounds.height * progress - height * viewportFraction, behavior: 'instant' })
      }
      let lo = 0
      let hi = steps.length - 1
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (steps[mid].getBoundingClientRect().bottom <= middle) lo = mid + 1
        else hi = mid
      }
      if (settled) previous = { width, stripWidth, y: window.scrollY, anchor: captureZoomAnchor(steps, lo, height) }
      const step = steps[lo]
      const section = step.closest<HTMLElement>('[data-scene]')!
      const scene = Number(section.dataset.scene)
      const beat = Number(step.dataset.beat ?? 1)
      setPlace(old => old.scene === scene && old.beat === beat ? old : { scene, beat })
    }
    function queue() {
      if (!frame) frame = requestAnimationFrame(locate)
    }
    const resize = new ResizeObserver(queue)
    steps.forEach(step => resize.observe(step))
    window.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', queue)
    viewport?.addEventListener('resize', queue)
    locate()
    return () => {
      resize.disconnect()
      window.removeEventListener('scroll', queue)
      window.removeEventListener('resize', queue)
      viewport?.removeEventListener('resize', queue)
      cancelAnimationFrame(frame)
    }
  }, [])
  return place
}
