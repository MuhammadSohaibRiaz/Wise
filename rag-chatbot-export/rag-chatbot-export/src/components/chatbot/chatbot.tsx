'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowDownCircleIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Chat } from '@/components/chatbot/Chat';

export default function Chatbot() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  // const [showChatIcon, setShowChatIcon] = useState(false);
  const chatIconRef = useRef<HTMLButtonElement>(null);

  // useEffect(() => {
  //   const handleScroll = () => {
  //     if (window.scrollY > 200) {
  //       setShowChatIcon(true);
  //     } else {
  //       setShowChatIcon(false);
  //       setIsChatOpen(false);
  //     }
  //   };
  //   handleScroll();
  //   window.addEventListener('scroll', handleScroll);
  //   return () => window.removeEventListener('scroll', handleScroll);
  // }, []);

  const toggleChat = () => setIsChatOpen((prev) => !prev);
  
  return (
    <div>
        <AnimatePresence>
        {/* {showChatIcon && ( */}
            <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50"
            >
            <Button
                ref={chatIconRef}
                onClick={toggleChat}
                size="icon"
                className={`rounded-full size-14 md:size-16 p-2 shadow-lg hover:shadow-xl transition-all duration-200 ${
                  isChatOpen
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : ""
                }`}
            >
                {!isChatOpen ? (
                <MessageCircle className="size-7 md:size-8" />
                ) : (
                <ArrowDownCircleIcon className="size-7 md:size-8" />
                )}
            </Button>
            </motion.div>
        {/* )} */}
        </AnimatePresence>

        <AnimatePresence>
            {isChatOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="fixed bottom-24 right-6 z-50 w-[95%] md:w-[400px]"
                >
                <Chat onClose={toggleChat}/>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}