import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { portraitDirections } from '../data/portrait'

function between(value: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

// The artwork and narration already travel together in document flow. These
// local effects only follow the reader through the illustration's own frame.
export function attachPortraitTimeline(scene: HTMLElement, id: number, motion: boolean) {
  if (!motion) return
  const camera = scene.querySelector<HTMLElement>('.camera')!
  const stage = scene.querySelector<HTMLElement>('.portrait-stage')!
  const direction = portraitDirections[id]
  const lens = scene.querySelector<HTMLElement>('.lens-field')
  const wind = scene.querySelector<HTMLElement>('.afterglow')
  let priorY = window.scrollY
  let settle: ReturnType<typeof setTimeout> | undefined
  function update() {
    const frame = window.innerHeight
    const bounds = stage.getBoundingClientRect()
    const progress = between(frame - bounds.top, 0, bounds.height + frame)
    let scale = direction.start + (direction.end - direction.start) * progress
    const dy = direction.rise * (progress - .5) * 100
    if (lens) {
      const reveal = between(1 - lens.getBoundingClientRect().top / frame, .01, .58)
      lens.style.setProperty('--aperture', String(reveal))
      // The hillside stays where it was drawn while the optical field below
      // it comes into view. A modest push follows the eye to the eyepiece.
      scale += .048 * between(progress, .3, .82)
    }
    camera.style.transform = 'translateY(' + dy.toFixed(4) + '%) scale(' + scale.toFixed(5) + ')'
    if (direction.entry) {
      camera.style.opacity = String(.78 + .22 * between(frame - bounds.top, 0, frame * .60))
    }
    if (wind && bounds.bottom > 0 && bounds.top < frame && Math.abs(window.scrollY - priorY) > .1) {
      clearTimeout(settle)
      wind.dataset.wind = window.scrollY > priorY ? 'up' : 'down'
      settle = setTimeout(() => { wind.dataset.wind = 'still' }, 60)
    }
    priorY = window.scrollY
  }
  const trigger = ScrollTrigger.create({
    trigger: scene, start: 'top bottom', end: 'bottom top', onUpdate: update, onRefresh: update,
  })
  update()
  return () => {
    trigger.kill()
    clearTimeout(settle)
    if (wind) wind.dataset.wind = 'still'
    lens?.style.removeProperty('--aperture')
    camera.style.removeProperty('opacity')
    camera.style.removeProperty('transform')
  }
}
