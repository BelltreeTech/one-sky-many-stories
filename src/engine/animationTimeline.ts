import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
ScrollTrigger.config({ ignoreMobileResize: false })

export function refreshScenes() {
  ScrollTrigger.refresh()
  ScrollTrigger.update()
}
