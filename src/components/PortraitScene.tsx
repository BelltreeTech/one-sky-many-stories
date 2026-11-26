import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { asset, chapters, type Scene } from '../data/edition'
import { portraitBeats, portraitDimensions, portraitDirections, portraitFile } from '../data/portrait'

const portraitDescriptions: Partial<Record<number, string>> = {
  8: 'Luna points to the stars. Leo brings his eye to the brass telescope as Noah steadies the tripod.',
  11: 'Seven sisters rise above the mountains with their dresses trailing below them. A bearded face takes shape in the clouds.',
  19: 'Luna points down a winding path toward a distant town. Leo and Noah stand beside her among the flowers.',
}

// Retry only a failed image, at a meaningful opportunity. An attempt-specific
// URL avoids reusing an undecodable response held in the browser image cache.
function useImageRecovery(near: boolean, failedFallbackAt?: number) {
  const [attempt, setAttempt] = useState(0)
  const [failedAt, setFailedAt] = useState(-1)
  const wasNear = useRef(near)
  const usedTimedRetry = useRef(false)
  const failed = attempt === failedAt
  const needsPixels = failedFallbackAt === undefined || failedFallbackAt === attempt
  const markFailed = useCallback(() => setFailedAt(attempt), [attempt])
  useEffect(() => {
    const returning = near && !wasNear.current
    wasNear.current = near
    if (!near) { usedTimedRetry.current = false; return }
    if (!failed) return
    const retry = () => setAttempt(value => value === attempt ? value + 1 : value)
    if (returning) { retry(); return }
    window.addEventListener('online', retry)
    // A server can recover from an HTTP error without the device going offline.
    // Give a blank illustration one extra chance during this visit. A working
    // landscape fallback stays visible until the reader returns or reconnects.
    const timer = needsPixels && !usedTimedRetry.current && navigator.onLine
      ? window.setTimeout(() => { usedTimedRetry.current = true; retry() }, 1000) : undefined
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', retry)
    }
  }, [near, failed, attempt, needsPixels])
  return { attempt, failed, markFailed }
}

function imageURL(file: string, attempt: number) {
  return asset(file) + (attempt ? '?retry=' + attempt : '')
}

function DecodedExposure({ file, className, near, alt = '' }: {
  file: string; className: string; near: boolean; alt?: string
}) {
  const image = useRef<HTMLImageElement>(null)
  const { attempt, failed, markFailed } = useImageRecovery(near)
  const [decodedAt, setDecodedAt] = useState(-1)
  const url = imageURL('portrait/' + file + '.webp', attempt)
  useEffect(() => {
    if (!near || failed) { setDecodedAt(-1); return }
    const element = image.current!
    let mounted = true
    // Reveal an optional exposure only when its pixels are available.
    void element.decode().then(() => {
      if (mounted) setDecodedAt(attempt)
    }).catch(() => { if (mounted) markFailed() })
    return () => { mounted = false }
  }, [near, failed, url, attempt, markFailed])
  return <img ref={image} className={className} data-ready={near && decodedAt === attempt && !failed}
    alt={alt} aria-hidden={alt ? undefined : true} src={near && !failed ? url : undefined} decoding="async" />
}

export function PortraitScene({ scene, near }: { scene: Scene; near: boolean }) {
  const [unavailableAt, setUnavailableAt] = useState(-1)
  const { attempt, failed: fallback, markFailed } = useImageRecovery(near, unavailableAt)
  const [width, height] = portraitDimensions(scene.id)
  const direction = portraitDirections[scene.id]
  const filename = fallback ? scene.image : portraitFile(scene.id)
  const bothFailed = fallback && unavailableAt === attempt
  const src = imageURL(filename, fallback && unavailableAt < 0 ? 0 : attempt)
  const chapter = chapters[scene.chapter - 1]
  const opener = (scene.id - 1) % 4 === 0
  const first = scene.id === 1
  const asksBeforeArt = scene.id === 7 || scene.id === 11
  const alt = fallback ? scene.alt : portraitDescriptions[scene.id] ?? scene.alt
  const art = <span className="portrait-stage" style={{
    '--portrait-ratio': width / height, '--focus': direction.focus,
    '--cover-art': first && near && !bothFailed ? 'url(' + src + ')' : undefined,
    '--atmosphere': near ? 'url(' + asset('atmosphere/' + String(scene.id).padStart(2, '0') + '.webp') + ')' : undefined,
  } as CSSProperties}>
    <span className="portrait-camera camera">
      <span className="portrait-sheet">
        <img className="scene-image" src={near && !bothFailed ? src : undefined} width={width} height={height} alt={alt}
          data-fallback={fallback} decoding="async" fetchPriority={first ? 'high' : 'auto'}
          onError={() => {
            if (!near) return
            if (fallback) setUnavailableAt(attempt)
            else markFailed()
          }} />
        {scene.id === 4 && !fallback && <DecodedExposure file="before-memory" className="registered-exposure memory-sky" near={near} />}
        {scene.id === 10 && !fallback && <DecodedExposure file="ridge" className="registered-exposure ridge-bridge" near={near} />}
        {scene.id === 11 && <span className="afterglow" data-wind="still" hidden={!near || fallback}
          style={{ '--plate': near && !fallback ? 'url(' + src + ')' : undefined } as CSSProperties} aria-hidden="true">
          <i className="drifting-cloud" /><i className="sleeve-tip" /><i className="hair-tip" />
        </span>}
      </span>
    </span>
  </span>

  return <div className={'portrait-story' + (asksBeforeArt ? ' quest' : '')}>
    {opener && <header className="portrait-heading">
      <div className="chapter-line"><span className="rule" aria-hidden="true" />Chapter {chapter.numeral}
        {first && <><span className="chapter-dot" aria-hidden="true">✦</span>{chapter.name}</>}</div>
      {first ? <h1>One Sky,{' '}<br /><em>Many Stories</em></h1> : <h2>{chapter.name}</h2>}
    </header>}
    <p className="passage portrait-passage">{portraitBeats(scene).map((part, index) =>
      <span className="reading-beat" data-beat={index + 1} key={index}>
        {!index && !asksBeforeArt && art}
        {scene.id === 8 && index === 1 && <span className="lens-field">
          <DecodedExposure file="telescope" className="telescope-view" near={near}
            alt="Through the eyepiece, a few bright stars stand out among many fainter points of light." />
        </span>}
        <span className="beat-text">{part}</span>
        {!index && asksBeforeArt && art}
      </span>)}</p>
    {scene.id === 20 && <div className="portrait-end" aria-label="End of the story">✦</div>}
  </div>
}
