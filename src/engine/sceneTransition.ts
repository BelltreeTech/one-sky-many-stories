import type { gsap } from 'gsap'

export function blendScene(timeline: gsap.core.Timeline, veil: HTMLElement) {
  timeline.fromTo(veil, { opacity: 0.52 }, { opacity: 0, duration: 0.28 }, 0)
  timeline.to(veil, { opacity: 0.42, duration: 0.18 }, 0.82)
}
