"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  className = "",
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  enableSystem?: boolean
  className?: string
}) {
  const [theme, setTheme] = React.useState<Theme>(defaultTheme)

  // Apply theme to html element
  React.useEffect(() => {
    const root = document.documentElement
    const isSystemDark = enableSystem && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches

    const effective = theme === "system" ? (isSystemDark ? "dark" : "light") : theme

    root.classList.toggle("dark", effective === "dark")
  }, [theme, enableSystem])

  // Expose a simple context-free API via data-attribute if needed later
  return (
    <div data-theme={theme} className={className}>
      {children}
    </div>
  )
}

// Optional small toggle button for demo use
export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(false)
  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])
  const toggle = () => {
    const root = document.documentElement
    const next = !root.classList.contains("dark")
    root.classList.toggle("dark", next)
    setIsDark(next)
  }
  return (
    <button
      aria-label="Toggle dark mode"
      onClick={toggle}
      className="rounded-md px-3 py-2 text-sm font-medium border bg-card text-card-foreground hover:bg-muted transition"
    >
      {isDark ? "Light" : "Dark"}
    </button>
  )
}
