import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { chapters, type Scene } from '../data/edition'
import { attachPortraitTimeline } from '../engine/portraitTimeline'
import { PortraitScene } from './PortraitScene'

export const SceneRenderer = memo(function SceneRenderer({ scene, motion, prefetch }: { scene: Scene; motion: boolean; prefetch: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const first = scene.id === 1
  const [nearby, setNear] = useState(first)
  const near = prefetch && nearby
  const [visible, setVisible] = useState(first)
  const chapter = chapters[scene.chapter - 1]
  const chapterOpener = (scene.id - 1) % 4 === 0
  const counter = String(scene.id).padStart(2, '0')
  useEffect(() => {
    const node = ref.current!
    const prefetch = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: '1200px 0px' })
    const viewport = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    prefetch.observe(node)
    viewport.observe(node)
    return () => { prefetch.disconnect(); viewport.disconnect() }
  }, [])
  useLayoutEffect(() => {
    if (!visible) return
    return attachPortraitTimeline(ref.current!, scene.id, motion)
  }, [motion, visible, near, scene.id])

  return (
    <section ref={ref} className={'scene portrait-scene' + (first ? ' opening' : '') + (chapterOpener ? ' chapter-opening' : '')}
      data-scene={scene.id} data-animated={motion && visible} id={'scene-' + counter} aria-label={'Scene ' + scene.id + ', ' + chapter.name}>
      <PortraitScene scene={scene} near={near} />
    </section>
  )
})
