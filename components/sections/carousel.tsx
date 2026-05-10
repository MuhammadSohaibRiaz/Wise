"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const images = [
  { src: "/law-books-gavel.png", alt: "Law books and gavel" },
  { src: "/lawyers-team-portrait.jpg", alt: "Team of lawyers" },
  { src: "/courtroom-interior.jpg", alt: "Courtroom interior" },
  { src: "/legal-documents-analysis.jpg", alt: "Legal documents analysis" },
]

export function ImageCarousel() {
  const [idx, setIdx] = useState(0)
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length)
  const next = () => setIdx((i) => (i + 1) % images.length)

  return (
    <section aria-label="Highlights" className="py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-xl border bg-card">
          <img
            key={images[idx].src}
            src={images[idx].src || "/placeholder.svg"}
            alt={images[idx].alt}
            className="w-full h-auto"
          />
          <div className="absolute inset-x-0 bottom-0 p-3 flex items-center justify-between">
            <Button size="sm" variant="secondary" onClick={prev} aria-label="Previous">
              Prev
            </Button>
            <div className="text-xs text-muted-foreground">
              {idx + 1} / {images.length}
            </div>
            <Button size="sm" onClick={next} aria-label="Next">
              Next
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
