import { StrictMode, useEffect, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import story from './data/story.json'
import { SceneRenderer } from './components/SceneRenderer'
import { ReadingHeader } from './components/ReadingHeader'
import { useMotionEnabled, useScrollController } from './engine/scrollController'
import { preserveReadingHistory } from './engine/readingHistory'
import { observeSceneLayout } from './engine/animationTimeline'
import './styles/reader.css'
import './styles/portrait.css'

function useCoverPriority() {
  const [ready, setReady] = useState(() => !!window.scrollY || !!location.hash)
  useLayoutEffect(() => {
    if (ready) return
    const cover = document.querySelector<HTMLImageElement>('.opening .scene-image')
    const release = () => setReady(true)
    if (!cover || window.scrollY || (cover.complete && cover.naturalWidth)) {
      release()
      return
    }
    cover.addEventListener('load', release, { once: true })
    cover.addEventListener('error', release, { once: true })
    window.addEventListener('scroll', release, { passive: true, once: true })
    return () => {
      cover.removeEventListener('load', release)
      cover.removeEventListener('error', release)
      window.removeEventListener('scroll', release)
    }
  }, [ready])
  return ready
}

function App() {
  const prefetch = useCoverPriority()
  const place = useScrollController()
  const current = place.scene
  const motion = useMotionEnabled()
  useLayoutEffect(preserveReadingHistory, [])
  useEffect(() => {
    const strip = document.querySelector<HTMLElement>('main.portrait-reader')!
    return observeSceneLayout(strip)
  }, [])
  return <>
    <ReadingHeader current={current} total={story.scenes.length} />
    <main className="portrait-reader">{story.scenes.map(scene => <SceneRenderer key={scene.id} scene={scene} current={current === scene.id} motion={motion} prefetch={prefetch || scene.id === 1} />)}</main>
  </>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
