import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { asset, chapters, type Scene } from '../data/edition'
import { portraitBeats, portraitDirections, portraitFile } from '../data/portrait'

function DecodedExposure({ file, className }: { file: string; className: string }) {
  const image = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const element = image.current!
    let mounted = true
    // Reveal an optional exposure only when its pixels are available.
    void element.decode().then(() => { if (mounted) setReady(true) }).catch(() => {})
    return () => { mounted = false }
  }, [file])
  return <img ref={image} className={className} data-ready={ready} alt="" aria-hidden="true"
    src={asset('portrait/' + file + '.webp')} decoding="async" />
}

export function PortraitScene({ scene, near }: { scene: Scene; near: boolean }) {
  const [fallback, setFallback] = useState(false)
  const [aspect, setAspect] = useState(9 / 16)
  const direction = portraitDirections[scene.id]
  const filename = fallback ? scene.image : portraitFile(scene.id)
  const src = asset(filename)
  const chapter = chapters[scene.chapter - 1]
  const opener = (scene.id - 1) % 4 === 0
  const first = scene.id === 1
  const alt = scene.id === 8 && !fallback
    ? 'Luna points to the stars. Leo brings his eye to the brass telescope as Noah steadies the tripod.'
    : scene.alt
  return <>
    <div className="portrait-stage" style={{
      '--portrait-ratio': aspect,
      '--focus': direction.focus,
      '--atmosphere': near ? 'url(' + asset('atmosphere/' + String(scene.id).padStart(2, '0') + '.webp') + ')' : undefined,
    } as CSSProperties}>
      <div className="scene-atmosphere" aria-hidden="true" />
      {(scene.id === 9 || scene.id === 10) && near &&
        <div className="ridge-alignment" aria-hidden="true"><div className="portrait-sheet">
          <DecodedExposure file="ridge" className="ridge-bridge" />
        </div></div>}
      <div className="portrait-camera camera">
        <div className="portrait-sheet">
          <img className="scene-image" src={near ? src : undefined} width={9} height={16} alt={alt}
            data-fallback={fallback} decoding="async" fetchPriority={first ? 'high' : 'auto'}
            onLoad={event => {
              const img = event.currentTarget
              if (img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight)
            }}
            onError={() => { if (near && !fallback) setFallback(true) }} />
          {scene.id === 11 && near && !fallback && <div className="afterglow" data-wind="still"
            style={{ '--plate': 'url(' + src + ')' } as CSSProperties} aria-hidden="true">
            <i className="drifting-cloud" /><i className="sleeve-tip" /><i className="hair-tip" />
          </div>}
        </div>
      </div>
      {scene.id === 8 && near && <DecodedExposure file="telescope" className="telescope-view" />}
    </div>
    <div className="portrait-story">
      <div className={opener ? 'portrait-heading chapter-opener' : 'visually-hidden'}>
        {opener && <div className="chapter-line"><span className="rule" aria-hidden="true" />Chapter {chapter.numeral}
          <span className="chapter-dot" aria-hidden="true">✦</span>{!first ? 'Scene ' + String(scene.id).padStart(2, '0') : chapter.name}</div>}
        {first && <h1>One Sky,{' '}<br /><em>Many Stories</em></h1>}
        {!first && <h2>{chapter.name}</h2>}
      </div>
      <p className="passage portrait-passage">{portraitBeats(scene).map((part, index) =>
        <span className="reading-beat" data-beat={index + 1} key={index}><span className="beat-text">{part}</span></span>)}</p>
      {scene.id === 20 && <div className="portrait-end" aria-label="End of the story">✦</div>}
    </div>
  </>
}
