import { memo, useEffect, useRef, useState } from 'react'
import { chapters, type Scene } from '../data/edition'
import { PortraitScene } from './PortraitScene'

export const SceneRenderer = memo(function SceneRenderer({ scene, current, motion, prefetch }: { scene: Scene; current: boolean; motion: boolean; prefetch: boolean }) {
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
    const prefetch = new IntersectionObserver(entries => setNear(entries[entries.length - 1].isIntersecting), { rootMargin: '1200px 0px' })
    const viewport = new IntersectionObserver(entries => setVisible(entries[entries.length - 1].isIntersecting))
    prefetch.observe(node)
    viewport.observe(node)
    return () => { prefetch.disconnect(); viewport.disconnect() }
  }, [])
  return (
    <section ref={ref} className={'scene portrait-scene' + (first ? ' opening' : '') + (chapterOpener ? ' chapter-opening' : '')}
      data-scene={scene.id} data-animated={motion && visible} id={'scene-' + counter} aria-label={'Scene ' + scene.id + ', ' + chapter.name}>
      <PortraitScene scene={scene} current={current} near={near} animate={motion && visible} />
    </section>
  )
})
