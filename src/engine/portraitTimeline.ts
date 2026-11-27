import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { portraitDirections } from '../data/portrait'
import { positionPainting } from './illustrationMotion'
import { between } from './sceneTransition'

// The telescope is a separate image with its own loading and retry lifecycle.
export function attachTelescopeAperture(lens: HTMLElement) {
  const update = () => {
    const reveal = between(1 - lens.getBoundingClientRect().top / window.innerHeight, .01, .58)
    lens.style.setProperty('--aperture', String(reveal))
  }
  const trigger = ScrollTrigger.create({
    trigger: lens, start: 'top bottom', end: 'bottom top', onUpdate: update, onRefresh: update,
  })
  update()
  return () => {
    trigger.kill()
    lens.style.removeProperty('--aperture')
  }
}

// The artwork and narration already travel together in document flow. These
// local effects only follow the reader through the illustration's own frame.
export function attachPortraitTimeline(scene: HTMLElement, id: number, motion: boolean) {
  if (!motion) return
  const camera = scene.querySelector<HTMLElement>('.camera')!
  const stage = scene.querySelector<HTMLElement>('.portrait-stage')!
  const direction = portraitDirections[id]
  const wind = scene.querySelector<HTMLElement>('.afterglow')
  let lastCinematicPose = -1
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
    // A thumb stroke traverses the main action while the picture is in view.
    // Bound the stroke in CSS pixels on a wide iPad as well as a short phone.
    const stroke = Math.max(255, Math.min(455, frame * .53))
    const centered = frame * .5 - (bounds.top + bounds.height * .5)
    let action = between(centered, -stroke * .5, stroke * .5)
    if (id === 1) action = between(window.scrollY, 0, stroke * .74)
    if (id === 20) {
      // The last page can run out of scroll before the artwork crosses the
      // screen center. The final sentence and the final wide shot land together.
      const remaining = scene.getBoundingClientRect().bottom - frame
      action = Math.max(action, 1 - between(remaining, 0, stroke * .67))
    }
    const pose = Math.round(10000 * action)
    if (pose !== lastCinematicPose) {
      stage.style.setProperty('--cinematic-progress', String(pose / 10000))
      lastCinematicPose = pose
    }
    let scale = direction.start + (direction.end - direction.start) * progress
    const dy = direction.rise * (progress - .5) * 100
    if (id === 8) {
      // The hillside stays where it was drawn while the optical field below
      // it comes into view. A modest push follows the eye to the eyepiece.
      scale += .048 * between(progress, .3, .82)
    }
    positionPainting(stage, progress)
    camera.style.transform = 'translateY(' + dy.toFixed(4) + '%) scale(' + scale.toFixed(5) + ')'
    if (id === 4 || id === 10) {
      // The pre-memory sky and the empty ridge share each painting's camera
      // and coordinates. Scrolling back undoes the same dissolve.
      // In the Japanese memory Leo's book sits below the middle of the
      // painting. On a broad iPad it must enter before his story appears.
      const enter = id === 4 ? Math.max(frame * .47, bounds.height * .60 + 12) : frame * .47
      const end = Math.max(frame * .96, enter + frame * .22)
      const reveal = between(frame - bounds.top, enter, end)
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
    stage.style.removeProperty('--cinematic-progress')
    scene.style.removeProperty('--background-exposure')
    camera.style.removeProperty('opacity')
    camera.style.removeProperty('transform')
  }
}
