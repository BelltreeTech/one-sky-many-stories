// A fresh tab starts at the cover. Only the browser history entry that the
// reader actually leaves carries its place when Safari rebuilds the document.
export function preserveReadingHistory() {
  const entryKey = 'oneSkyReading'
  const address = () => location.pathname + location.search + location.hash
  const sceneFragment = /^#scene-(0[1-9]|1[0-9]|20)$/
  const coverAddress = () => sceneFragment.test(location.hash) ? location.pathname + location.search : address()
  function releaseFragment() {
    if (!sceneFragment.test(location.hash)) return
    try { history.replaceState(history.state, '', coverAddress()) } catch { /* Native history remains available. */ }
  }
  const matchesEntry = (url: string | undefined, y: number | undefined) =>
    url === address() || (y === 0 && url === coverAddress())

  // Browsers may snapshot history.state before pagehide. Associate a tab's
  // final scroll offset with this history entry while the document is active.
  function storageKey() {
    let id = history.state?.oneSkyEntry
    if (typeof id !== 'string') {
      id = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')
      history.replaceState({ ...history.state, oneSkyEntry: id }, '')
    }
    return 'one-sky:reading:' + id
  }
  function readPlace() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey()) ?? 'null')
      if (Array.isArray(stored)) {
        const [url, y, scene, beat, progress] = stored
        if (matchesEntry(url, y)) return { address: url, y, scene, beat, progress }
      } else if (stored && matchesEntry(stored.address, stored.y)) return stored
    } catch { /* History still works if session storage is unavailable. */ }
    return history.state?.[entryKey]
  }

  let savedY: number | undefined
  function remember() {
    const middle = innerHeight / 2
    const elements = document.querySelectorAll<HTMLElement>('[data-beat]')
    const anchor = Array.from(elements).find(element => element.getBoundingClientRect().bottom >= middle)
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const section = anchor.closest<HTMLElement>('[data-scene]')
    const place = {
      address: scrollY === 0 ? coverAddress() : address(), y: scrollY, scene: section?.id,
      beat: anchor.dataset.beat, progress: Math.max(0, Math.min(1, (middle - rect.top) / Math.max(1, rect.height))),
    }
    try {
      const key = storageKey()
      // Reserve one fixed-size slot per history entry. A larger scroll offset
      // can then replace the cover even if the tab's storage fills up later.
      const entry = [place.address, place.y, place.scene, place.beat, Number(place.progress.toFixed(7))]
      const size = JSON.stringify(place.address).length + 64
      try {
        sessionStorage.setItem(key, JSON.stringify(entry).padEnd(size))
      } catch {
        sessionStorage.removeItem(key)
      }
    } catch { /* The history entry is the fallback when storage is full. */ }
    try {
      history.replaceState({ ...history.state, [entryKey]: place }, '')
      savedY = scrollY
    } catch { /* Native history remains available. */ }
  }

  const saved = readPlace()
  const restoration = new AbortController()
  const cancelRestore = () => restoration.abort()
  const hasPlace = saved && matchesEntry(saved.address, saved.y) && Number.isFinite(saved.y) && saved.y >= 0 && Number.isFinite(saved.progress)
  const linkedScene = sceneFragment.test(location.hash) ? location.hash.slice(1) : ''
  const sceneId = hasPlace ? saved.scene : linkedScene
  const section = sceneId ? document.getElementById(sceneId) : null
  if (section) {
    const anchor = (hasPlace && section.querySelector<HTMLElement>('[data-beat="' + Number(saved.beat) + '"]')) || section
    const restore = () => {
      if (!hasPlace) {
        section.scrollIntoView({ block: 'start', behavior: 'instant' })
        return
      }
      if (saved.y === 0) {
        // Some WebKit loads apply the fragment after pageshow. A reader who
        // returned to the cover should have a cover URL in this history entry.
        releaseFragment()
        window.scrollTo({ top: 0, behavior: 'instant' })
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
  // Some browsers snapshot the history entry before pagehide. Commit a
  // completed gesture while the document is still active, including a return
  // to the cover immediately before a reload of a chapter link.
  const rememberCover = () => {
    if (scrollY === 0 && savedY !== 0) {
      cancelRestore()
      remember()
    }
  }
  window.addEventListener('scroll', rememberCover, { passive: true })
  document.addEventListener('scrollend', remember)
  const whenHidden = () => { if (document.hidden) remember() }
  window.addEventListener('pagehide', remember)
  document.addEventListener('visibilitychange', whenHidden)
  return () => {
    cancelRestore()
    window.removeEventListener('scroll', rememberCover)
    document.removeEventListener('scrollend', remember)
    window.removeEventListener('pagehide', remember)
    document.removeEventListener('visibilitychange', whenHidden)
  }
}
