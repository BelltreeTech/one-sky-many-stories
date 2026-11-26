import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { revealPassage } from './typographyReveal'
import { blendScene } from './sceneTransition'

gsap.registerPlugin(ScrollTrigger)
ScrollTrigger.config({ ignoreMobileResize: false })

type SceneEffect = (timeline: gsap.core.Timeline, camera: HTMLElement) => void
const gentlePush: SceneEffect = (timeline, camera) => {
  timeline.fromTo(camera, { scale: 0.984, yPercent: 0.6 },
    { scale: 1, yPercent: 0, duration: 1 }, 0)
}
const gentlePull: SceneEffect = (timeline, camera) => {
  timeline.fromTo(camera, { scale: 1, yPercent: 0 },
    { scale: 0.981, yPercent: -0.5, duration: 1 }, 0)
}
// Each entry can author cues on a single master timeline with one scroll trigger.
const sceneEffects: Partial<Record<number, SceneEffect>> = { 11: gentlePull, 14: gentlePull, 20: gentlePull }

export function attachTimeline(scene: HTMLElement, id: number) {
  const camera = scene.querySelector<HTMLElement>('.camera')!
  const passage = scene.querySelector<HTMLElement>('.passage')!
  const veil = scene.querySelector<HTMLElement>('.scene-veil')!
  const context = gsap.context(() => {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom top', scrub: true },
    })
    const animateCamera = sceneEffects[id] ?? gentlePush
    animateCamera(tl, camera)
    blendScene(tl, veil)
    revealPassage(tl, passage)
  }, scene)
  return () => context.revert()
}

export function refreshScenes() {
  ScrollTrigger.refresh()
  ScrollTrigger.update()
}
