import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { asset, chapters, type Scene } from '../data/edition'
import { attachTimeline } from '../engine/animationTimeline'
import { attachPortraitTimeline } from '../engine/portraitTimeline'
import { PortraitScene } from './PortraitScene'

export const SceneRenderer = memo(function SceneRenderer({ scene, motion, portrait, prefetch }: { scene: Scene; motion: boolean; portrait: boolean; prefetch: boolean }) {
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
    if (portrait) return attachPortraitTimeline(ref.current!, scene.id, motion)
    if (motion) return attachTimeline(ref.current!, scene.id)
  }, [motion, portrait, visible, near, scene.id])

  return (
    <section ref={ref} className={'scene' + (portrait ? ' portrait-scene' : '') + (first ? ' opening' : '') + (chapterOpener ? ' chapter-opening' : '')}
      style={near && !portrait ? { '--scene-art': 'url(' + asset(scene.image) + ')' } as CSSProperties : undefined}
      data-scene={scene.id} data-animated={motion && visible} id={'scene-' + counter} aria-label={'Scene ' + scene.id + ', ' + chapter.name}>
      {portrait ? <PortraitScene scene={scene} near={near} /> : <>
      <div className="atmosphere" aria-hidden="true" style={near ? { backgroundImage: 'url(' + asset('atmosphere/' + counter + '.webp') + ')' } : undefined} />
      {(first || scene.id === 20) && <div className="night-canopy" aria-hidden="true" />}
      <div className="terrain" aria-hidden="true" />
      <div className="scene-inner">
        <div className="art-stage">
          <div className="camera">
            <picture>
              {scene.portrait && near && <source media="(orientation: portrait)" srcSet={asset(scene.portrait.image)} width={scene.portrait.width} height={scene.portrait.height} />}
              <img className="scene-image" src={near ? asset(scene.image) : undefined} width={scene.width} height={scene.height}
                loading={first ? 'eager' : 'lazy'} fetchPriority={first ? 'high' : 'auto'} decoding="async" alt={scene.alt} />
            </picture>
          </div>
        </div>
        <div className="chapter-heading">
          <div className="chapter-line"><span className="rule" aria-hidden="true" />Chapter {chapter.numeral}<span className="chapter-dot" aria-hidden="true">✦</span>{first ? chapter.name : <span>Scene {counter}</span>}</div>
          {first ? <h1>One Sky,{' '}<br /><em>Many Stories</em></h1> : <h2>{chapter.name}</h2>}
        </div>
        <div className="narration"><p className="passage">{scene.text}</p></div>
        {scene.id === 20 && <div className="end-mark" aria-label="End of the story"><span />✦<span /></div>}
      </div>
      <div className="scene-veil" aria-hidden="true" />
      </>}
    </section>
  )
})
