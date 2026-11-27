import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
// On touch devices, the address bar changes the visible height while the
// document is still gliding. GSAP still refreshes on width or large height changes.
ScrollTrigger.config({ ignoreMobileResize: true })

export function scheduleSceneRefresh() {
  // The safe refresh coalesces measurements and waits for scrolling to end.
  ScrollTrigger.refresh(true)
}
