import { useEffect, useState, useSyncExternalStore } from 'react'

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

// The center line defines the scene number, independently of the animation clock.
export function useScrollController() {
  const [current, setCurrent] = useState(1)
  useEffect(() => {
    const scenes = document.querySelectorAll<HTMLElement>('[data-scene]')
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) setCurrent(Number((entry.target as HTMLElement).dataset.scene))
      }
    }, { rootMargin: '-49.9% 0px -49.9% 0px' })
    scenes.forEach(scene => observer.observe(scene))
    return () => observer.disconnect()
  }, [])
  return current
}
