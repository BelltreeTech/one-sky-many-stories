import { between } from './sceneTransition'
import type { PaintedLayer } from '../data/illustrationMotion'

type Paint = (progress: number) => void
// The scene camera and its ink layers must see exactly the same position. Keep
// the last pose for art that finishes loading halfway through a scroll.
const progressByStage = new WeakMap<HTMLElement, number>()
const painters = new WeakMap<HTMLElement, Paint>()

export function followPainting(stage: HTMLElement, paint: Paint) {
  painters.set(stage, paint)
  paint(progressByStage.get(stage) ?? 0)
  return () => { if (painters.get(stage) === paint) painters.delete(stage) }
}

export function positionPainting(stage: HTMLElement, progress: number) {
  progressByStage.set(stage, progress)
  painters.get(stage)?.(progress)
}

export function bindInk(root: HTMLElement, layers: readonly PaintedLayer[]): Paint {
  const surfaces = Array.from(root.querySelectorAll<HTMLElement>('[data-painted-detail]'))
  const sprites = surfaces.map(el => el.firstElementChild as HTMLElement)
  const previous = new Float64Array(layers.length).fill(-1)
  return progress => {
    layers.forEach((layer, i) => {
      const phase = between(progress, layer.from ?? .16, layer.to ?? .84)
      if (phase === previous[i]) return
      previous[i] = phase
      const sprite = sprites[i]
      if (layer.kind === 'petal') {
        const side = layer.reverse ? -1 : 1
        const arc = Math.sin(phase * Math.PI)
        sprite.style.transform = 'translate(' + (side * (32 * arc + 16 * phase)).toFixed(2) + '%,' + (phase * 90).toFixed(2) + '%)'
        sprite.style.opacity = String(Math.min(1, arc * 2))
        const leaf = sprite.firstElementChild as HTMLElement
        leaf.style.transform = 'rotate(' + (side * (phase * 185 - 20)).toFixed(2) + 'deg) scaleX(' + (.4 + .6 * Math.abs(Math.cos(phase * Math.PI))).toFixed(3) + ')'
        return
      }
      const travel = layer.sway ? Math.sin(phase * 2 * Math.PI) : (2 * phase - 1)
      const dx = (travel * (layer.x ?? 0)).toFixed(3)
      const dy = (travel * (layer.y ?? 0)).toFixed(3)
      const angle = ((layer.turn ?? 0) * (layer.kind === 'light' ? 1 : travel)).toFixed(3)
      sprite.style.transform = 'translate(' + dx + '%,' + dy + '%) rotate(' + angle + 'deg)'
      if (layer.kind === 'light') sprite.style.opacity = String(layer.opacity * Math.sin(phase * Math.PI))
    })
  }
}
