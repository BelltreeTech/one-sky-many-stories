import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import story from './data/story.json'
import { SceneRenderer } from './components/SceneRenderer'
import { ReadingHeader } from './components/ReadingHeader'
import { ParticleEngine } from './engine/ParticleEngine'
import { useMotionEnabled, useScrollController } from './engine/scrollController'
import { refreshScenes } from './engine/animationTimeline'
import './styles/reader.css'

function App() {
  const current = useScrollController()
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
    <ReadingHeader current={current} total={story.scenes.length} />
    <main>{story.scenes.map(scene => <SceneRenderer key={scene.id} scene={scene} motion={motion} />)}</main>
    <ParticleEngine running={motion} />
  </>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
