"use client"

import { Suspense, useState } from "react"
import { motion } from "framer-motion"
import { BookOpen, X } from "lucide-react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LegalRagAssistant } from "./legal-rag-assistant"

export function LegalRagLauncher() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  if (pathname?.startsWith("/admin")) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <motion.div
        initial={false}
        animate={isOpen ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 18, scale: 0.96 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        aria-hidden={!isOpen}
        className={cn(
          "absolute bottom-16 right-0 shadow-2xl",
          !isOpen && "pointer-events-none invisible",
        )}
      >
        <Suspense fallback={null}>
          <LegalRagAssistant onClose={() => setIsOpen(false)} />
        </Suspense>
      </motion.div>

      <Button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="h-14 gap-2 rounded-full bg-emerald-700 px-5 text-white shadow-lg hover:bg-emerald-800"
      >
        {isOpen ? <X className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
        <span className="hidden text-sm font-semibold sm:inline">Legal RAG Assistant</span>
      </Button>
    </div>
  )
}
