import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
// A global refresh temporarily scrolls the document to zero, including when
// GSAP postpones it until scrollEnd. This book has only unpinned scene triggers.
ScrollTrigger.config({ autoRefreshEvents: 'none', ignoreMobileResize: true })

export function observeSceneLayout(strip: HTMLElement) {
  let frame = 0
  let mounted = true
  let toolbarSettled: ReturnType<typeof setTimeout> | undefined
  let width = window.innerWidth
  let height = window.innerHeight

  function queueMeasurements() {
    if (!mounted || frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      for (const trigger of ScrollTrigger.getAll()) trigger.refresh()
    })
  }

  function measureViewport() {
    const nextHeight = window.innerHeight
    clearTimeout(toolbarSettled)
    // Scene entry already observes the moving touch viewport.
    // Remeasure its resting position once after the toolbar finishes moving.
    if (window.innerWidth === width && ScrollTrigger.isTouch === 1 &&
      Math.abs(nextHeight - height) < height * .25) {
      toolbarSettled = setTimeout(queueMeasurements, 120)
      return
    }
    width = window.innerWidth
    height = nextHeight
    queueMeasurements()
  }

  const resize = new ResizeObserver(queueMeasurements)
  resize.observe(strip)
  window.addEventListener('resize', measureViewport)
  void document.fonts.ready.then(queueMeasurements)
  return () => {
    mounted = false
    resize.disconnect()
    window.removeEventListener('resize', measureViewport)
    clearTimeout(toolbarSettled)
    cancelAnimationFrame(frame)
  }
}
