import React from 'react'

export default function Loading() {
  return (
    <div className="fixed top-0 left-0 w-full z-[9999]">
      <div className="h-1 bg-primary w-full animate-progress overflow-hidden">
        <div className="h-full bg-primary-foreground/30 w-1/3 animate-progress-slide"></div>
      </div>
    </div>
  )
}
