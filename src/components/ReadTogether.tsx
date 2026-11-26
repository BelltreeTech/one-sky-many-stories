import { useCallback, useEffect, useRef, useState } from 'react'
import type { Scene } from '../data/edition'
import { portraitBeats } from '../data/portrait'

type VoiceState = 'idle' | 'speaking' | 'paused'
type Destination = { id: number; step: number; element: Element }
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export function ReadTogether({ current, beat, portrait, scenes }: {
  current: number; beat: number; portrait: boolean; scenes: Scene[]
}) {
  const [started, setStarted] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [notice, setNotice] = useState('')
  const active = useRef<SpeechSynthesisUtterance | null>(null)
  // Keep the requested beat separate from the center-line folio while a native
  // turn is travelling. A second tap can reverse or extend the first turn.
  const requested = useRef<Destination | null>(null)
  const [destination, setDestination] = useState<Destination | null>(null)
  const scene = scenes[current - 1]
  const beats = portrait ? portraitBeats(scene) : [scene.text]
  const beatIndex = Math.min(beat, beats.length)
  const buttonScene = destination?.id ?? current
  const buttonBeat = destination?.step ?? beatIndex
  const numBeats = (id: number) => portrait ? portraitBeats(scenes[id - 1]).length : 1
  const first = buttonScene === 1 && buttonBeat === 1
  const last = buttonScene === scenes.length && buttonBeat === numBeats(buttonScene)
  const speech = typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : undefined

  const stopVoice = useCallback(() => {
    const utterance = active.current
    if (!utterance || !speech) return
    active.current = null
    utterance.onend = utterance.onerror = null
    speech.cancel()
    setVoiceState('idle')
  }, [speech])

  useEffect(() => {
    // Several engines populate their voice list asynchronously after the first query.
    speech?.getVoices()
    const onHidden = () => { if (document.hidden) stopVoice() }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', stopVoice)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', stopVoice)
      stopVoice()
    }
  }, [speech, stopVoice])

  useEffect(() => {
    stopVoice()
    setNotice('')
  }, [current, beatIndex, portrait, stopVoice])

  const release = useCallback(() => {
    requested.current = null
    setDestination(null)
  }, [])

  useEffect(() => {
    let frame = 0
    const settle = () => {
      const target = requested.current
      if (!target) return
      const limit = document.documentElement.scrollHeight - innerHeight
      const end = Math.min(limit, Math.max(0, scrollY + target.element.getBoundingClientRect().top))
      if (Math.abs(scrollY - end) < 2) release()
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(settle)
    }
    function interrupt(event: Event) {
      if (!requested.current) return
      if ((event.type === 'pointerdown' || event.type === 'touchstart')
        && event.target instanceof Element && event.target.closest('.reading-dock')) return
      if (event instanceof KeyboardEvent) {
        if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return
        if (event.key === ' ' && event.target instanceof HTMLButtonElement) return
      }
      // End only our pending turn; the input's native default action still runs.
      window.scrollTo({ top: scrollY, behavior: 'instant' })
      release()
    }
    const finishWithoutMotion = () => {
      if (reducedMotion.matches) requested.current?.element.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', interrupt, { passive: true })
    window.addEventListener('touchstart', interrupt, { passive: true })
    window.addEventListener('pointerdown', interrupt, { passive: true })
    window.addEventListener('keydown', interrupt)
    reducedMotion.addEventListener('change', finishWithoutMotion)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', interrupt)
      window.removeEventListener('touchstart', interrupt)
      window.removeEventListener('pointerdown', interrupt)
      window.removeEventListener('keydown', interrupt)
      reducedMotion.removeEventListener('change', finishWithoutMotion)
      cancelAnimationFrame(frame)
      release()
    }
  }, [portrait, release])

  function goTo(id: number, step = 1, adjacent = true) {
    stopVoice()
    setNotice('')
    const section = document.getElementById('scene-' + String(id).padStart(2, '0'))
    const element = portrait ? section?.querySelector('[data-beat="' + step + '"]') : section
    if (!element) return
    const target = { id, step, element }
    requested.current = target
    setDestination(target)
    const behavior = adjacent && !reducedMotion.matches ? 'smooth' : 'instant'
    element.scrollIntoView({ behavior, block: 'start' })
    // A jump to the current position does not dispatch a native scroll event.
    if (Math.abs(element.getBoundingClientRect().top) < 2) {
      requestAnimationFrame(() => { if (requested.current === target) release() })
    }
  }

  function turn(delta: 1 | -1) {
    const id = requested.current?.id ?? current
    const step = requested.current?.step ?? beatIndex
    if (delta > 0) {
      if (step < numBeats(id)) return goTo(id, step + 1)
      return id === scenes.length ? goTo(1, 1, false) : goTo(id + 1)
    }
    if (step > 1) return goTo(id, step - 1)
    if (id > 1) goTo(id - 1, numBeats(id - 1))
  }

  function toggleVoice() {
    if (!speech) return
    if (active.current && voiceState === 'speaking') {
      speech.pause()
      setVoiceState('paused')
      return
    }
    if (active.current && voiceState === 'paused') {
      speech.resume()
      setVoiceState('speaking')
      return
    }
    const utterance = new SpeechSynthesisUtterance(beats[beatIndex - 1].trim())
    const voices = speech.getVoices().filter(voice => /^en(?:-|_|$)/i.test(voice.lang))
    const voice = voices.find(candidate => candidate.localService) ?? voices[0]
    utterance.lang = voice?.lang ?? 'en-US'
    if (voice) utterance.voice = voice
    utterance.rate = 0.92
    utterance.onend = () => {
      if (active.current !== utterance) return
      active.current = null
      setVoiceState('idle')
    }
    utterance.onerror = () => {
      if (active.current !== utterance) return
      active.current = null
      setVoiceState('idle')
      setNotice('英語音声を再生できませんでした。本文を読みながら「次へ」で進めます。')
    }
    active.current = utterance
    setNotice('')
    setVoiceState('speaking')
    if (speech.paused) speech.resume()
    speech.speak(utterance)
  }

  return <nav className="reading-dock" lang="ja" aria-label="読み聞かせの操作">
    {!started
      ? <button className="begin-reading" onClick={() => {
        goTo(current, beatIndex, false)
        setStarted(true)
      }}>{current === 1 ? '読み聞かせを始める' : 'このページから読み始める'}<span aria-hidden="true"> →</span></button>
      : <>
        {notice && <p className="voice-notice" role="status">{notice}</p>}
        <div className="reading-tools">
          <button className="turn-page" disabled={first} onClick={() => turn(-1)}>
            <span aria-hidden="true">← </span>前へ
          </button>
          {speech
            ? <button className="voice-button" onClick={toggleVoice}>
              <span aria-hidden="true">{voiceState === 'speaking' ? 'Ⅱ ' : '▷ '}</span>
              {voiceState === 'speaking' ? '一時停止' : voiceState === 'paused' ? '音声を再開' : '英語で聴く'}
            </button>
            : <span className="manual-reading">声に出して読む</span>}
          <button className="turn-page" onClick={() => turn(1)}>
            {last ? '最初へ' : '次へ'}<span aria-hidden="true">{last ? ' ↺' : ' →'}</span>
          </button>
        </div>
        <span className="visually-hidden" aria-live="polite">{current} / {scenes.length} ページ</span>
      </>}
  </nav>
}
