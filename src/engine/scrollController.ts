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

// The same center line drives the folio, navigation and spoken passage.
export function useScrollController(portrait: boolean) {
  const [place, setPlace] = useState({ scene: 1, beat: 1 })
  const location = useRef(place)
  const lastPortrait = useRef(place)
  const previousOrientation = useRef(portrait)
  useLayoutEffect(() => {
    if (previousOrientation.current !== portrait) {
      // The two layouts have different physical heights. Restore the logical
      // reading position before a resize observer can reinterpret the old y.
      const saved = location.current
      const section = document.getElementById('scene-' + String(saved.scene).padStart(2, '0'))
      const savedBeat = lastPortrait.current.scene === saved.scene ? lastPortrait.current.beat : 1
      const target = portrait ? section?.querySelector('[data-beat="' + savedBeat + '"]') : section
      target?.scrollIntoView({ block: 'start', behavior: 'instant' })
      previousOrientation.current = portrait
    }
    const steps = document.querySelectorAll<HTMLElement>(portrait ? '[data-beat]' : '[data-scene]')
    let frame = 0
    function locate() {
      frame = 0
      if (!steps.length || portraitScreen.matches !== portrait) return
      const middle = window.innerHeight / 2
      let lo = 0
      let hi = steps.length - 1
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (steps[mid].getBoundingClientRect().bottom <= middle) lo = mid + 1
        else hi = mid
      }
      const step = steps[lo]
      const scene = Number(step.closest<HTMLElement>('[data-scene]')?.dataset.scene)
      const beat = Number(step.dataset.beat ?? 1)
      location.current = { scene, beat }
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
    locate()
    return () => {
      resize.disconnect()
      window.removeEventListener('scroll', queue)
      window.removeEventListener('resize', queue)
      cancelAnimationFrame(frame)
    }
  }, [portrait])
  return place
}
