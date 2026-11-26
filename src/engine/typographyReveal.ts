import type { gsap } from 'gsap'

// Keep the paragraph selectable and legible even if the reader stops mid-entry.
export function revealPassage(timeline: gsap.core.Timeline, passage: HTMLElement) {
  timeline.fromTo(passage, { y: 10, opacity: 0.84 }, {
    y: 0, opacity: 1, duration: 0.2, ease: 'power1.out',
  }, 0)
}
