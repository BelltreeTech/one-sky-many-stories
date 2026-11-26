import { useCallback, useEffect, useRef, useState } from 'react'
import type { Scene } from '../data/edition'
import { portraitBeats } from '../data/portrait'

type VoiceState = 'idle' | 'speaking' | 'paused'

export function ReadTogether({ current, beat, portrait, scenes }: {
  current: number; beat: number; portrait: boolean; scenes: Scene[]
}) {
  const [started, setStarted] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [notice, setNotice] = useState('')
  const active = useRef<SpeechSynthesisUtterance | null>(null)
  const scene = scenes[current - 1]
  const beats = portrait ? portraitBeats(scene) : [scene.text]
  const beatIndex = Math.min(beat, beats.length)
  const first = current === 1 && beatIndex === 1
  const last = current === scenes.length && beatIndex === beats.length
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

  function goTo(id: number, step = 1) {
    stopVoice()
    setNotice('')
    const section = document.getElementById('scene-' + String(id).padStart(2, '0'))
    const target = portrait ? section?.querySelector('[data-beat="' + step + '"]') : section
    target?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }

  function advance() {
    if (last) return goTo(1)
    if (beatIndex < beats.length) return goTo(current, beatIndex + 1)
    goTo(current + 1)
  }

  function previous() {
    if (beatIndex > 1) return goTo(current, beatIndex - 1)
    const previousScene = scenes[current - 2]
    if (previousScene) goTo(previousScene.id, portrait ? portraitBeats(previousScene).length : 1)
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
        goTo(current, beatIndex)
        setStarted(true)
      }}>{current === 1 ? '読み聞かせを始める' : 'このページから読み始める'}<span aria-hidden="true"> →</span></button>
      : <>
        {notice && <p className="voice-notice" role="status">{notice}</p>}
        <div className="reading-tools">
          <button className="turn-page" disabled={first} onClick={previous}>
            <span aria-hidden="true">← </span>前へ
          </button>
          {speech
            ? <button className="voice-button" onClick={toggleVoice}>
              <span aria-hidden="true">{voiceState === 'speaking' ? 'Ⅱ ' : '▷ '}</span>
              {voiceState === 'speaking' ? '一時停止' : voiceState === 'paused' ? '音声を再開' : '英語で聴く'}
            </button>
            : <span className="manual-reading">声に出して読む</span>}
          <button className="turn-page" onClick={advance}>
            {last ? '最初へ' : '次へ'}<span aria-hidden="true">{last ? ' ↺' : ' →'}</span>
          </button>
        </div>
        <span className="visually-hidden" aria-live="polite">{current} / {scenes.length} ページ</span>
      </>}
  </nav>
}
