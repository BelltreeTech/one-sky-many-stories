import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import story from './data/story.json'
import { SceneRenderer } from './components/SceneRenderer'
import { ReadingHeader } from './components/ReadingHeader'
import { ParticleEngine } from './engine/ParticleEngine'
import { useMotionEnabled, usePortraitScreen, useScrollController } from './engine/scrollController'
import { refreshScenes } from './engine/animationTimeline'
import './styles/reader.css'
import './styles/portrait.css'

function App() {
  const portrait = usePortraitScreen()
  const place = useScrollController(portrait)
  const current = place.scene
  const motion = useMotionEnabled()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let mounted = true
    const refreshAfterResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { if (mounted) refreshScenes() }, 90)
    }
    void document.fonts.ready.then(() => { if (mounted) refreshScenes() })
    window.addEventListener('resize', refreshAfterResize)
    window.visualViewport?.addEventListener('resize', refreshAfterResize)
    return () => {
      mounted = false
      clearTimeout(timer)
      window.removeEventListener('resize', refreshAfterResize)
      window.visualViewport?.removeEventListener('resize', refreshAfterResize)
    }
  }, [])
  return <>
    <ReadingHeader current={current} total={story.scenes.length} portrait={portrait} />
    <main className={portrait ? 'portrait-reader' : undefined}>{story.scenes.map(scene => <SceneRenderer key={scene.id} scene={scene} motion={motion} portrait={portrait} />)}</main>
    <ParticleEngine scene={portrait ? current : undefined} running={motion && (!portrait || ![7, 8, 11, 14, 15].includes(current))} />
  </>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
