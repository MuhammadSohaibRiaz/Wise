"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function ProgressBar() {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRunning = useRef(false)

  const cleanup = useCallback(() => {
    if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null }
  }, [])

  const start = useCallback(() => {
    if (isRunning.current) return
    isRunning.current = true
    cleanup()
    setVisible(true)
    setProgress(18)

    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) return p
        const inc = p < 30 ? 8 : p < 60 ? 4 : 2
        return Math.min(p + Math.random() * inc + 1, 88)
      })
    }, 250)

    safetyRef.current = setTimeout(() => {
      if (isRunning.current) {
        cleanup()
        isRunning.current = false
        setProgress(100)
        setTimeout(() => { setVisible(false); setProgress(0) }, 200)
      }
    }, 8000)
  }, [cleanup])

  const done = useCallback(() => {
    cleanup()
    isRunning.current = false
    setProgress(100)
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 200)
  }, [cleanup])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      if (anchor.getAttribute("target") === "_blank") return
      if (anchor.hasAttribute("download")) return
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
        if (url.pathname === window.location.pathname && url.search === window.location.search) return
      } catch { return }
      start()
    }

    document.addEventListener("click", handleClick, { capture: true })
    return () => document.removeEventListener("click", handleClick, { capture: true })
  }, [start])

  useEffect(() => {
    const origPush = history.pushState.bind(history)
    const origReplace = history.replaceState.bind(history)

    history.pushState = function (...args: Parameters<typeof origPush>) {
      if (args[2] && String(args[2]) !== window.location.href) start()
      return origPush(...args)
    }
    history.replaceState = function (...args: Parameters<typeof origReplace>) {
      if (args[2] && String(args[2]) !== window.location.href) start()
      return origReplace(...args)
    }

    const handlePopState = () => start()
    window.addEventListener("popstate", handlePopState)

    return () => {
      history.pushState = origPush
      history.replaceState = origReplace
      window.removeEventListener("popstate", handlePopState)
    }
  }, [start])

  useEffect(() => {
    if (isRunning.current) done()
  }, [pathname, searchParams, done])

  useEffect(() => () => cleanup(), [cleanup])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "150ms" : "300ms",
        }}
      />
    </div>
  )
}
