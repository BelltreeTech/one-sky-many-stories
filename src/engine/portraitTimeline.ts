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
  let gustFrame = 0
  let lastGust = 0
  let strength = 0
  const glide = 760

  function paintWind(time: number) {
    if (!wind) return
    const elapsed = Math.max(0, time - lastGust)
    const remaining = Math.max(0, 1 - elapsed / glide)
    // Paint the actual tip displacement directly. A transition that starts and
    // ends between two Safari paints can leave the hair motionless throughout.
    wind.style.setProperty('--gust', String(strength * remaining ** 2))
    if (remaining > 0) gustFrame = requestAnimationFrame(paintWind)
    else {
      gustFrame = 0
      wind.dataset.wind = 'still'
    }
  }
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
    if (id === 4 || id === 10) {
      // The pre-memory sky and the empty ridge share each painting's camera
      // and coordinates. Scrolling back undoes the same dissolve.
      const reveal = between(1 - bounds.top / frame, .47, .96)
      scene.style.setProperty('--background-exposure', String(1 - reveal))
    }
    if (direction.entry) {
      camera.style.opacity = String(.78 + .22 * between(frame - bounds.top, 0, frame * .60))
    }
    if (wind && bounds.bottom > 0 && bounds.top < frame && Math.abs(window.scrollY - priorY) > .1) {
      const delta = window.scrollY - priorY
      const elapsed = performance.now() - lastGust
      const residual = strength * Math.max(0, 1 - elapsed / glide) ** 2
      const push = Math.sign(delta) * Math.max(.22, Math.abs(delta) / 60)
      strength = Math.max(-1, Math.min(1, residual + push))
      lastGust = performance.now()
      wind.dataset.wind = delta > 0 ? 'up' : 'down'
      wind.style.setProperty('--gust', String(strength))
      if (!gustFrame) gustFrame = requestAnimationFrame(paintWind)
    }
    priorY = window.scrollY
  }
  const trigger = ScrollTrigger.create({
    trigger: scene, start: 'top bottom', end: 'bottom top', onUpdate: update, onRefresh: update,
  })
  update()
  return () => {
    trigger.kill()
    cancelAnimationFrame(gustFrame)
    if (wind) {
      wind.dataset.wind = 'still'
      wind.style.removeProperty('--gust')
    }
    scene.style.removeProperty('--background-exposure')
    lens?.style.removeProperty('--aperture')
    camera.style.removeProperty('opacity')
    camera.style.removeProperty('transform')
  }
}
