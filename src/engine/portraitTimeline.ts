import { portraitDirections } from '../data/portrait'
import { positionPainting } from './illustrationMotion'
import { between } from './sceneTransition'
import { playOnEntry } from './scenePlayback'

// These subjects sit away from the camera's optical centre. Bring both the
// question's stars and the books in the lower half of their paintings on screen.
const subjectHeight: Partial<Record<number, number | readonly [number, number]>> = {
  4: [.10, .65], 5: [.37, .76], 7: [.115, .25],
  12: [.51, .65], 18: [.448, .69], 20: [.59, .80],
}
const subjectWidth: Partial<Record<number, readonly [number, number]>> = {
  7: [.39, .65], 12: [.467, .678], 18: [.30, .75],
}
const shotLength: Partial<Record<number, number>> = {
  1: 5200, 4: 4600, 5: 4800, 7: 5000, 9: 4600, 10: 4600,
  11: 5200, 12: 4600, 13: 4800, 14: 4600, 15: 4600, 18: 4600, 20: 5200,
}

export function attachTelescopeAperture(lens: HTMLElement) {
  const stop = playOnEntry(lens, {
    duration: 2600, focus: .5, focusX: .46,
    ready: () => lens.querySelector('.telescope-view')?.getAttribute('data-ready') === 'true',
    paint: progress => lens.style.setProperty('--aperture', String(between(progress, 0, 1))),
  })
  return () => { stop(); lens.style.removeProperty('--aperture') }
}

export function attachPortraitTimeline(scene: HTMLElement, id: number) {
  const camera = scene.querySelector<HTMLElement>('.camera')!
  const stage = scene.querySelector<HTMLElement>('.portrait-stage')!
  const direction = portraitDirections[id]
  const wind = scene.querySelector<HTMLElement>('.afterglow')
  const stop = playOnEntry(stage, {
    duration: shotLength[id] ?? 3600,
    focusX: subjectWidth[id] ?? parseFloat(direction.focus) / 100,
    focus: subjectHeight[id] ?? parseFloat(direction.focus.split(' ')[1]) / 100,
    paint(progress) {
      // The sisters reach their mark first. Hair, sleeves and the last curl of
      // cloud have the remaining beat to settle while all seven faces stay still.
      const action = id === 11 ? Math.min(1, progress / .84) : progress
      const eased = between(action, 0, 1)
      stage.style.setProperty('--cinematic-progress', String(+action.toFixed(5)))
      let scale = direction.start + (direction.end - direction.start) * eased
      if (id === 8) scale += .048 * between(action, .3, .82)
      const dy = direction.rise * (eased - .5) * 100
      camera.style.transform = 'translateY(' + dy.toFixed(4) + '%) scale(' + scale.toFixed(5) + ')'
      positionPainting(stage, action)
      if (id === 4 || id === 10) scene.style.setProperty('--background-exposure', String(1 - between(action, .12, .84)))
      if (direction.entry) camera.style.opacity = String(.78 + .22 * between(action, 0, .4))
      if (wind) {
        const gust = between(progress, .04, .28) * (1 - between(progress, .84, 1))
        wind.style.setProperty('--gust', String(+gust.toFixed(5)))
        const state = gust > 0 ? 'up' : 'still'
        if (wind.dataset.wind !== state) wind.dataset.wind = state
      }
    },
  })
  return () => {
    stop()
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
