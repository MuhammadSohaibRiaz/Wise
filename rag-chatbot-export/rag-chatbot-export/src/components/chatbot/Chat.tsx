'use client';
import { useState, useEffect, useRef, memo } from 'react';
import { CardContent, CardHeader, CardTitle, Card, CardFooter } from '../ui/card';
import { Button } from '@/components/ui/button';
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MeetingForm, MeetingData } from './MeetingForm';

type Message = { id: string; role: 'user' | 'assistant'; content: string; fullContent?: string; isStreaming?: boolean; showMeetingButton?: boolean };

export function Chat({onClose}: {onClose?: () => void}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming'>('ready');
  const [error, setError] = useState<Error | null>(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); // ADD
  const isUserNearBottomRef = useRef(true); // ADD
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldShowMeetingFormRef = useRef(false);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 80;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isUserNearBottomRef.current = atBottom;
  };

  useEffect(() => {
    if (!isUserNearBottomRef.current) return;
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (showMeetingForm && status === 'ready') {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [showMeetingForm, status]);

  useEffect(() => {
    if (status === 'ready' && inputRef.current && !showMeetingForm) {
      inputRef.current.focus();
    }
  }, [status, showMeetingForm]);

  useEffect(() => {
    const streamingMessage = messages.find(msg => msg.isStreaming);
    
    if (streamingMessage && streamingMessage.fullContent) {
      const currentLength = streamingMessage.content.length;
      const targetLength = streamingMessage.fullContent.length;
      
      if (currentLength < targetLength) {
        if (streamingIntervalRef.current) {
          clearInterval(streamingIntervalRef.current);
        }
        
        streamingIntervalRef.current = setInterval(() => {
          setMessages(prev => 
            prev.map(msg => {
              if (msg.id === streamingMessage.id && msg.fullContent) {
                const newLength = Math.min(msg.content.length + 3, msg.fullContent.length);
                return {
                  ...msg,
                  content: msg.fullContent.substring(0, newLength),
                  isStreaming: newLength < msg.fullContent.length
                };
              }
              return msg;
            })
          );
        }, 20);
      }
    } else {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    }

    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
    };
  }, [messages]);

  useEffect(() => {
  if (status === 'streaming') {
    scrollRef.current?.scrollIntoView({ behavior: "auto" });
    return;
  }
  if (!isUserNearBottomRef.current) return;
  scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    isUserNearBottomRef.current = true; // ensure autoscroll during stream
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setStatus('submitted');
    setError(null);

    shouldShowMeetingFormRef.current = false;

    try {
      // Only send last 6 messages (3 exchanges) to reduce token usage
      const recentMessages = messages.slice(-6);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...recentMessages, userMsg] }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setStatus('streaming');
      const assistantMsgId = (Date.now() + 1).toString();
      
      setMessages((prev) => [...prev, { 
        id: assistantMsgId, 
        role: 'assistant', 
        content: '', 
        fullContent: '',
        isStreaming: true 
      }]);

      let assistantContent = '';
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        assistantContent += chunk;
        
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === assistantMsgId 
              ? { ...msg, fullContent: assistantContent, isStreaming: true }
              : msg
          )
        );
      }

      // Check if response contains meeting button marker or meeting intent
      const showMeetingButton = assistantContent.includes('[SHOW_MEETING_BUTTON]');
      const openMeetingForm = assistantContent.includes('[OPEN_MEETING_FORM]');

      // Remove all markers from displayed content
      const cleanContent = assistantContent
        .replace('[SHOW_MEETING_BUTTON]', '')
        .replace('[OPEN_MEETING_FORM]', '')
        .trim();

      // Update the message with clean content AND mark streaming as complete
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === assistantMsgId 
            ? { 
                ...msg, 
                fullContent: cleanContent, 
                content: cleanContent,  // ADD THIS - set content to full
                showMeetingButton: showMeetingButton,
                isStreaming: false  // ADD THIS - mark as complete
              }
            : msg
        )
      );

      shouldShowMeetingFormRef.current = openMeetingForm;

      setStatus('ready');
      if (shouldShowMeetingFormRef.current) {
        setShowMeetingForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setStatus('ready');
    }
  };

  const handleMeetingSubmit = async (data: MeetingData) => {
    try {
      const response = await fetch('/api/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit meeting request');
      }

      // Add success message
      const successMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: ` **Meeting request submitted!**\n\nThank you ${data.name}! We've received your meeting request for **${data.datetime}** (${data.timezone || 'no timezone specified'}). \n\nOur team will contact you at **${data.email}** to confirm. Please check your inbox (and spam folder) shortly.`,
      };

      setMessages(prev => [...prev, successMsg]);
      setShowMeetingForm(false);
      setStatus('ready');
    } catch (err) {
      throw err;
    }
  };

  const markdownComponents: Components = {
    code({ node, inline, className, children, ...props }: any) {
      if (inline) {
        return (
          <code className="bg-gray-300 px-1 rounded text-sm" {...props}>
            {children}
          </code>
        );
      }

      return (
        <pre className="bg-gray-300 p-2 rounded overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    ul: ({ children }) => <ul className="list-disc ml-4">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal ml-4">{children}</ol>,
    p: ({ children }) => <p className="mb-2">{children}</p>,
  };

  const MessageBubble = memo(function MessageBubble({
    message,
    markdownComponents,
    onShowMeetingForm,
    showMeetingForm,
  }: {
    message: Message;
    markdownComponents: Components;
    onShowMeetingForm: () => void;
    showMeetingForm: boolean;
  }) {
        return (
      <div
        className={`mb-4 ${
          message.role === "user" ? "flex justify-end" : "flex justify-start"
        }`}
      >
        <div className="flex flex-col max-w-[85%]">
          <div
            className={`rounded-2xl px-4 py-2 shadow-sm text-left ${
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 backdrop-blur-sm border border-border"
            }`}
          >
            <ReactMarkdown
              children={message.content}
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            />
          </div>

          {message.role === "assistant" &&
            message.showMeetingButton &&
            !message.isStreaming && !showMeetingForm && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onShowMeetingForm}
                  className="text-xs"
                >
                  Schedule Meeting with Team
                </Button>
              </div>
            )}
        </div>
      </div>
    );
  });

  return (
    <Card className="border-2 shadow-2xl backdrop-blur-sm bg-background/95 w-full !py-2 !gap-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-0 border-b !pb-2 shrink-0">
        <CardTitle className="text-base font-bold py-0">
          Chat with PlasmoCode
        </CardTitle>
        <Button
          onClick={onClose}
          size="sm"
          variant="ghost"
          className="px-2 py-0"
        >
          <X className="h-4 w-4"/>
          <span className='sr-only'>Close Chat</span>
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-[270px] overflow-y-auto px-3 py-2 space-y-2"
        >
          {messages?.length === 0 && !showMeetingForm && (
            <div className='w-full h-full flex flex-col items-center justify-center text-muted-foreground'>
              <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">Start a conversation with PlasmoCode</p>
            </div>  
          )}

          {messages?.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              markdownComponents={markdownComponents}
              onShowMeetingForm={() => setShowMeetingForm(true)}
              showMeetingForm={showMeetingForm}
            />
          ))}

          {showMeetingForm && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Scheduling a meeting</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMeetingForm(false)}
                >
                  Close form
                </Button>
              </div>
              <MeetingForm
                onSubmit={handleMeetingSubmit}
                onCancel={() => setShowMeetingForm(false)}
              />
            </div>
          )}

          {status === 'streaming' && messages.every(msg => !msg.isStreaming) && (
            <div className="w-full items-center flex justify-center gap-3">
              <Loader2 className="animate-spin h-5 w-5 text-primary" />
              <span className="text-xs">streaming...</span>
            </div>
          )}

          {error && (
            <div className='w-full items-center flex justify-center gap-3'>
              <div className="text-red-500 text-sm">Error: {error.message}</div>
              <button
                className='underline text-sm'
                type="button"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          )}
          <div ref={scrollRef}></div>
        </div>
      </CardContent>

      <CardFooter className="border-t px-3 py-3 !pt-3">
        {showMeetingForm ? (
          <div className="w-full flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Fill the meeting request form above.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMeetingForm(false)}
              className="h-8"
            >
              Continue chat instead
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) {
                sendMessage(input);
                setInput('');
              }
            }}
            className='flex w-full items-center space-x-2'
          >          
            <Input 
              ref={inputRef}
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              className="flex-1 rounded-full" 
              placeholder="Type your message here..."
              disabled={status !== 'ready'}
            />

            <Button 
              type="submit"
              className="h-10 w-10 rounded-full"
              disabled={status !== 'ready'}
              size="icon"
            >
              <Send className="h-4 w-4"/>
            </Button>
          </form>
        )}
      </CardFooter>
    </Card>
  );
}