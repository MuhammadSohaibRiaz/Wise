'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Mic, Headset } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chat } from './Chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Chatbot() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  
  // Show welcome bubble after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
    setShowWelcome(false);
  };
  
  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-3">
        {/* Welcome Bubble */}
        <AnimatePresence>
            {showWelcome && !isChatOpen && (
                <motion.div
                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.9 }}
                    className="relative bg-white dark:bg-slate-900 border border-border shadow-xl rounded-2xl p-4 pr-10 mb-2 max-w-[240px]"
                >
                    <button 
                        onClick={() => setShowWelcome(false)}
                        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-3 w-3" />
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Online</span>
                    </div>
                    <p className="text-sm font-medium leading-tight">
                        I&apos;m your 24/7 AI Legal Assistant. How can I help you today?
                    </p>
                    {/* Triangle pointer */}
                    <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white dark:border-t-slate-900" />
                </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-end gap-4"
            >
              <AnimatePresence>
                  {isChatOpen && (
                      <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 20 }}
                          className="w-[min(92vw,420px)] shadow-2xl"
                      >
                        <Chat onClose={toggleChat}/>
                      </motion.div>
                  )}
              </AnimatePresence>

              <Button
                  onClick={toggleChat}
                  size="icon"
                  className={`relative rounded-full h-14 w-14 md:h-16 md:w-16 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden ${
                    isChatOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
                  }`}
              >
                  {isChatOpen ? (
                    <X className="h-8 w-8" />
                  ) : (
                    <div className="relative h-full w-full group">
                        <Avatar className="h-full w-full border-2 border-white/20">
                            <AvatarImage src="/legal_assistant_avatar.png" alt="AI Assistant" className="object-cover" />
                            <AvatarFallback className="bg-primary">
                                <Headset className="h-8 w-8 text-white" />
                            </AvatarFallback>
                        </Avatar>
                        {/* Mic Overlay */}
                        <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-1 border-2 border-white shadow-sm">
                            <Mic className="h-3 w-3 text-white" />
                        </div>
                    </div>
                  )}
              </Button>
            </motion.div>
        </AnimatePresence>
    </div>
  );
}

