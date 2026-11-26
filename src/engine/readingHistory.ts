// A fresh tab starts at the cover. Only the browser history entry that the
// reader actually leaves carries its place when Safari rebuilds the document.
export function preserveReadingHistory() {
  const entryKey = 'oneSkyReading'
  const address = location.pathname + location.search + location.hash

  function remember() {
    const middle = innerHeight / 2
    const elements = document.querySelectorAll<HTMLElement>('[data-beat]')
    const anchor = Array.from(elements).find(element => element.getBoundingClientRect().bottom >= middle)
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const section = anchor.closest<HTMLElement>('[data-scene]')
    const place = {
      address, y: scrollY, scene: section?.id,
      beat: anchor.dataset.beat, progress: Math.max(0, Math.min(1, (middle - rect.top) / Math.max(1, rect.height))),
    }
    try { history.replaceState({ ...history.state, [entryKey]: place }, '') } catch { /* Native history remains available. */ }
  }

  const saved = history.state?.[entryKey]
  const restoration = new AbortController()
  const cancelRestore = () => restoration.abort()
  const hasPlace = saved?.address === address && saved.y > 0 && Number.isFinite(saved.progress)
  const linkedScene = /^#scene-(0[1-9]|1[0-9]|20)$/.test(location.hash) ? location.hash.slice(1) : ''
  const sceneId = hasPlace ? saved.scene : linkedScene
  const section = sceneId ? document.getElementById(sceneId) : null
  if (section) {
    const anchor = (hasPlace && section.querySelector<HTMLElement>('[data-beat="' + Number(saved.beat) + '"]')) || section
    const restore = () => {
      if (!hasPlace) {
        section.scrollIntoView({ block: 'start', behavior: 'instant' })
        return
      }
      const rect = anchor.getBoundingClientRect()
      const top = scrollY + rect.top + rect.height * saved.progress - innerHeight / 2
      window.scrollTo({ top, behavior: 'instant' })
    }
    // On iPad Safari the first layout can use fallback fonts and the browser
    // can still be settling its own offset when document.fonts.ready fires.
    // Recompute on the first displayed frame, unless the reader intervened.
    const options = { once: true, passive: true, signal: restoration.signal }
    for (const input of ['pointerdown', 'wheel', 'keydown']) window.addEventListener(input, cancelRestore, options)
    window.addEventListener('pageshow', event => {
      if (!event.persisted) requestAnimationFrame(() => {
        if (!restoration.signal.aborted) restore()
        cancelRestore()
      })
    }, options)
    restore()
    const restored = scrollY
    void document.fonts.ready.then(() => {
      if (!restoration.signal.aborted && Math.abs(scrollY - restored) < 2) restore()
    })
  }
  const whenHidden = () => { if (document.hidden) remember() }
  window.addEventListener('pagehide', remember)
  document.addEventListener('visibilitychange', whenHidden)
  return () => {
    cancelRestore()
    window.removeEventListener('pagehide', remember)
    document.removeEventListener('visibilitychange', whenHidden)
  }
}
