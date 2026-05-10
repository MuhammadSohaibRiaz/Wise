"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname } from "next/navigation"

export function ProgressBar() {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const pathname = usePathname()

  const kick = useCallback((pct: number) => {
    setIsVisible(true)
    setProgress((prev) => Math.max(prev, pct))
  }, [])

  // Start immediately on in-app link clicks (pathname updates only after navigation completes).
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      const a = el?.closest?.("a")
      if (!a) return
      const href = a.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      if (a.getAttribute("target") === "_blank") return
      try {
        const u = new URL(href, window.location.origin)
        if (u.origin !== window.location.origin) return
        if (u.pathname === window.location.pathname && u.search === window.location.search) return
      } catch {
        return
      }
      kick(20)
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [kick])

  useEffect(() => {
    setIsVisible(true)
    setProgress(12)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev
        return Math.min(prev + Math.random() * 12 + 4, 92)
      })
    }, 140)

    const finish = setTimeout(() => {
      setProgress(100)
      setTimeout(() => {
        setIsVisible(false)
        setProgress(0)
      }, 220)
    }, 900)

    return () => {
      clearInterval(interval)
      clearTimeout(finish)
    }
  }, [pathname])

  if (!isVisible) return null

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[9999] bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out shadow-lg"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
