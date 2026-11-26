import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

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

const portraitScreen = window.matchMedia('(orientation: portrait)')

export function usePortraitScreen() {
  return useSyncExternalStore(
    subscribePortrait, () => portraitScreen.matches,
  )
}

function subscribePortrait(notify: () => void) {
  portraitScreen.addEventListener('change', notify)
  return () => portraitScreen.removeEventListener('change', notify)
}

type ZoomAnchor = { element: HTMLElement; progress: number; viewportFraction: number }

// Prefer a readable paragraph on screen. Between paragraphs, hold the point in
// the illustration that was passing through the center of the screen.
function captureZoomAnchor(steps: NodeListOf<HTMLElement>, index: number, height: number): ZoomAnchor {
  let element = steps[index]
  let nearest = Infinity
  for (let i = Math.max(0, index - 1); i <= Math.min(steps.length - 1, index + 1); i++) {
    const text = steps[i].querySelector<HTMLElement>('.beat-text, .narration .passage')
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
export function useScrollController(portrait: boolean) {
  const [place, setPlace] = useState({ scene: 1, beat: 1 })
  const location = useRef({ ...place, fraction: .5, sceneFraction: .5 })
  const lastPortrait = useRef<typeof location.current | null>(null)
  const previousOrientation = useRef(portrait)
  useLayoutEffect(() => {
    if (previousOrientation.current !== portrait) {
      // The two layouts have different physical heights. Restore the logical
      // reading position before a resize observer can reinterpret the old y.
      const saved = location.current
      const section = document.getElementById('scene-' + String(saved.scene).padStart(2, '0'))
      const anchor = portrait && lastPortrait.current?.scene === saved.scene ? lastPortrait.current : null
      const target = anchor ? section?.querySelector('[data-beat="' + anchor.beat + '"]') : section
      if (target) {
        const bounds = target.getBoundingClientRect()
        const fraction = anchor?.fraction ?? saved.sceneFraction
        // A short answer might be only three lines tall. Bringing its top to
        // the top edge would put the viewport center in the following scene.
        window.scrollTo({ top: scrollY + bounds.top + bounds.height * fraction - innerHeight / 2, behavior: 'instant' })
      }
      previousOrientation.current = portrait
    }
    const steps = document.querySelectorAll<HTMLElement>(portrait ? '[data-beat]' : '[data-scene]')
    let frame = 0
    const viewport = window.visualViewport
    let zoom: { width: number; scale: number; outer: number; anchor: ZoomAnchor } | undefined
    function locate() {
      frame = 0
      if (!steps.length || portraitScreen.matches !== portrait) return
      const height = window.innerHeight
      const middle = height / 2
      const width = document.documentElement.clientWidth
      // Safari Page Zoom changes *both* layout width and viewport scale in a
      // fixed window. Pinching changes only the visual viewport. During a menu
      // step Safari can emit a scroll with the new CSS width but the old scale.
      const settled = viewport && Math.abs(viewport.width - width) < 2
      if (settled && zoom && width !== zoom.width && Math.abs(viewport.scale - zoom.scale) > .01
          && Math.abs(window.outerWidth - zoom.outer) < 2 && Math.abs(width * viewport.scale - zoom.width * zoom.scale) < 3) {
        const { element, progress, viewportFraction } = zoom.anchor
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
      if (settled) zoom = { width, scale: viewport.scale, outer: window.outerWidth, anchor: captureZoomAnchor(steps, lo, height) }
      const step = steps[lo]
      const section = step.closest<HTMLElement>('[data-scene]')!
      const scene = Number(section.dataset.scene)
      const beat = Number(step.dataset.beat ?? 1)
      const positionWithin = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect()
        return Math.max(.01, Math.min(.99, (middle - bounds.top) / Math.max(1, bounds.height)))
      }
      location.current = { scene, beat, fraction: positionWithin(step), sceneFraction: positionWithin(section) }
      if (portrait) lastPortrait.current = location.current
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
  }, [portrait])
  return place
}
