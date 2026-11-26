import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { portraitDirections } from '../data/portrait'

function between(value: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

// The stage is fixed behind native-flow text. Its view is a function of scroll
// position, so entering at a deep link and travelling backward need no replay.
export function attachPortraitTimeline(scene: HTMLElement, id: number, motion: boolean) {
  const stage = scene.querySelector<HTMLElement>('.portrait-stage')!
  const camera = scene.querySelector<HTMLElement>('.camera')!
  const direction = portraitDirections[id]
  const nextBeat = scene.querySelector<HTMLElement>('[data-beat="2"]')
  const wind = scene.querySelector<HTMLElement>('.afterglow')
  let priorY = window.scrollY
  let settle: ReturnType<typeof setTimeout> | undefined
  function update() {
    const frame = window.innerHeight
    const bounds = scene.getBoundingClientRect()
    const top = bounds.top / frame
    const bottom = bounds.bottom / frame
    const carried = between(frame - bounds.top, 0, bounds.height + frame)
    const entry = between(1 - top, .28, .72)
    // An opaque underlying plate keeps the shared ridge lit all the way
    // through the midpoint of the dissolve, in both scroll directions.
    const exit = id === 9 ? between(bottom, .28, .5) : between(bottom, .28, .72)
    const shown = motion ? Math.min(entry, exit) : Number(top <= .5 && bottom > .5)
    stage.style.opacity = String(shown)
    stage.style.visibility = shown > 0 ? 'visible' : 'hidden'
    // Between the book and the Greek hillside only the sky and mist overlap.
    // Both groups of seven must never be projected on top of one another.
    let exposure = 1
    if (motion && direction.entry) exposure = between(1 - top, .50, .77)
    if (motion && portraitDirections[id + 1]?.entry) {
      exposure = Math.min(exposure, between(bottom, .50, .77))
    }
    camera.style.opacity = String(exposure)
    if (id === 9 || id === 10) stage.style.setProperty('--ridge', String(1 - exposure))
    let approach = 0
    if (id === 8 && nextBeat) {
      const travelled = 1 - nextBeat.getBoundingClientRect().top / frame
      // Begin by following Leo toward the eyepiece. A separate, feathered iris
      // then opens from that precise point onto the denser field of stars.
      const reveal = motion ? between(travelled, .20, .80) : Number(travelled >= .5)
      stage.style.setProperty('--lens', String(reveal))
      stage.style.setProperty('--aperture', String(reveal * reveal))
      stage.style.setProperty('--lens-light', String(motion ? between(reveal, 0, .2) : reveal))
      if (stage.querySelector<HTMLElement>('.telescope-view')?.dataset.ready === 'true') {
        approach = .19 * between(travelled, .015, .59)
      }
    }
    if (motion) {
      const scale = direction.start + (direction.end - direction.start) * carried + approach
      const dy = direction.rise * (carried - .5) * 100
      camera.style.transform = 'translateY(' + dy.toFixed(4) + '%) scale(' + scale.toFixed(5) + ')'
    }
    if (motion && wind && Math.abs(window.scrollY - priorY) > .1) {
      clearTimeout(settle)
      wind.dataset.wind = window.scrollY > priorY ? 'up' : 'down'
      settle = setTimeout(() => { wind.dataset.wind = 'still' }, 60)
    }
    priorY = window.scrollY
  }
  const trigger = ScrollTrigger.create({
    trigger: scene, start: 'top bottom', end: 'bottom top',
    onUpdate: update, onRefresh: update,
  })
  update()
  return () => {
    trigger.kill()
    clearTimeout(settle)
    if (wind) wind.dataset.wind = 'still'
    stage.style.visibility = 'hidden'
    stage.style.removeProperty('opacity')
    stage.style.removeProperty('--lens')
    stage.style.removeProperty('--lens-light')
    stage.style.removeProperty('--aperture')
    stage.style.removeProperty('--ridge')
    camera.style.removeProperty('opacity')
    camera.style.removeProperty('transform')
  }
}
