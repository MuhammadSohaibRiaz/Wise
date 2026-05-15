"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BookOpen, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LegalRagAssistant } from "./legal-rag-assistant"

export function LegalRagLauncher() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-3 md:bottom-6 md:left-6">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="shadow-2xl"
          >
            <LegalRagAssistant onClose={() => setIsOpen(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

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
