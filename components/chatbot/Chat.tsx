'use client';

import { useState, useRef, useEffect, useMemo, useCallback, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, X, Loader2, Upload, FileText, CheckCircle2, Navigation, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { normalizeChatNavigationPath, type ChatRole } from '@/lib/chat-routes';

export function Chat({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [draft, setDraft] = useState('');
  const [chatRole, setChatRole] = useState<ChatRole>('guest');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Voice Mode State
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [shouldReadAloud, setShouldReadAloud] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
  const [isRoutePending, startRouteTransition] = useTransition();
  const [historyReady, setHistoryReady] = useState(false);
  const recognitionRef = useRef<any>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const lastScrolledMessageCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const pathname = usePathname();
  
  const { messages, sendMessage, setMessages, status, error: chatError } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    body: {
      currentPath: pathname
    },
    onError: (error: any) => {
      console.error("[Chat] useChat error:", error);
      const errorMsg = error?.message || "Failed to get response from assistant";
      setMessages((prev: any) => ([
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          parts: [{ type: "text", text: `Error: ${errorMsg}` }],
        }
      ]));
    }
  } as any);

  const isLoading = status !== 'ready';

  const safeInput = draft ?? '';

  useEffect(() => {
    const loadRoleAndHistory = async () => {
      setHistoryReady(false);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setChatRole('guest');
          setHistoryReady(true);
          return;
        }
        
        // Load Profile
        const { data: profile } = await supabase.from('profiles').select('user_type, avatar_url').eq('id', user.id).maybeSingle();
        setChatRole(profile?.user_type === 'lawyer' ? 'lawyer' : 'client');
        setUserAvatar(profile?.avatar_url ?? null);

        // Load History
        const historyRes = await fetch('/api/chat/history');
        if (historyRes.ok) {
          const { messages: historyData } = await historyRes.json();
          if (historyData && historyData.length > 0) {
            // Map DB messages to UI message format with parts
            const mappedMessages = historyData.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              parts: [{ type: 'text', text: m.content }],
              createdAt: new Date(m.created_at)
            }));
            setMessages(mappedMessages);
          } else {
            setMessages([]);
          }
        }
      } catch (err) {
        console.error("[Chat] Load error:", err);
        setChatRole('guest');
      } finally {
        setHistoryReady(true);
      }
    };
    void loadRoleAndHistory();
  }, [setMessages]);

  const normalizePath = useCallback(
    (path: string | null | undefined) => {
      if (!path) return null;
      return normalizeChatNavigationPath(path, chatRole);
    },
    [chatRole],
  );

  const isAllowedAction = useCallback(
    (label: string, path: string) => {
      const normalized = normalizePath(path) ?? path;
      const l = String(label || "").toLowerCase();

      // Hard block non-legal CTAs the model might hallucinate.
      const blockedKeywords = ["doctor", "surgeon", "hospital", "clinic", "medicine", "heart"];
      if (blockedKeywords.some((k) => l.includes(k))) return false;

      // Only allow navigation inside WiseCase.
      if (!normalized.startsWith("/")) return false;

      // Allow-list key routes used by assistant.
      const allowedPrefixes = [
        "/match",
        "/client/",
        "/lawyer/",
        "/admin/",
        "/auth/",
        "/terms",
        "/privacy",
        "/",
      ];
      if (!allowedPrefixes.some((p) => normalized === p || normalized.startsWith(p))) return false;

      // Soft guard: assistant buttons should be related to WiseCase workflows.
      const allowedLabelHints = ["lawyer", "case", "appointment", "analysis", "review", "profile", "dashboard", "settings", "dispute", "payment", "message", "notify"];
      if (!allowedLabelHints.some((k) => l.includes(k))) {
        // Still allow if the destination is clearly WiseCase core pages.
        if (normalized === "/match") return true;
        if (normalized.startsWith("/client/") || normalized.startsWith("/lawyer/")) return true;
        return false;
      }

      return true;
    },
    [normalizePath],
  );

  const isExplicitNavigationText = useCallback((text: string) => {
    return /Taking you to|Navigating you to|Opening|Redirecting/i.test(text);
  }, []);

  const getMessageText = useMemo(() => {
    return (m: any) => {
      const parts = Array.isArray(m?.parts) ? m.parts : [];
      if (parts.length > 0) {
        return parts
          .filter((p: any) => p?.type === 'text')
          .map((p: any) => p.text ?? '')
          .join('');
      }
      return typeof m?.content === 'string' ? m.content : '';
    };
  }, []);

  const getToolParts = useMemo(() => {
    return (m: any) => {
      const parts = Array.isArray(m?.parts) ? m.parts : [];
      return parts.filter((p: any) => typeof p?.type === 'string' && (p.type.startsWith('tool-') || p.type === 'dynamic-tool'));
    };
  }, []);

  const getLawyerProfileHrefFromMessage = useCallback(
    (m: any) => {
      for (const part of getToolParts(m)) {
        if (part.type === "tool-searchLawyers" && part.state === "output-available") {
          const lawyers = part.output?.lawyers as { id: string }[] | undefined;
          const firstId = lawyers?.[0]?.id;
          if (firstId) return `/client/lawyer/${firstId}`;
        }
      }
      return null;
    },
    [getToolParts],
  );

  const getNavigatePath = useMemo(() => {
    return (m: any) => {
      const text = getMessageText(m);
      const navFromText = normalizePath(text.match(/\[NAVIGATE:(.*?)\]/)?.[1]);
      if (navFromText) return navFromText;

      for (const part of getToolParts(m)) {
        if (part?.type === 'tool-navigateToPage') {
          if (part?.state === 'output-available' && part?.output?.path && typeof part.output.path === 'string') {
            return normalizePath(part.output.path);
          }
          if (part?.state === 'output-available' && part?.output?.marker) {
            const navFromOutput = normalizePath(String(part.output.marker).match(/\[NAVIGATE:(.*?)\]/)?.[1]);
            if (navFromOutput) return navFromOutput;
          }
          if (typeof part?.input?.path === 'string') return normalizePath(part.input.path);
        }
      }
      return null;
    };
  }, [getMessageText, getToolParts, normalizePath]);

  const getToolSummary = useMemo(() => {
    return (m: any) => {
      const summaries: string[] = [];
      const seen = new Set<string>();
      for (const part of getToolParts(m)) {
        if (part?.state === 'output-error' && part?.errorText) {
          const msg = `Tool error: ${part.errorText}`;
          if (!seen.has(msg)) {
            summaries.push(msg);
            seen.add(msg);
          }
          continue;
        }
        if (part?.type === 'tool-getProfileStatus' && part?.state === 'output-available') {
          const output = part?.output ?? {};
          if (output?.error) {
            const msg = String(output.error);
            if (!seen.has(msg)) {
              summaries.push(msg);
              seen.add(msg);
            }
            continue;
          }
          if (Array.isArray(output?.missingFields)) {
            if (output.missingFields.length === 0) {
              const msg = 'Your profile looks complete.';
              if (!seen.has(msg)) {
                summaries.push(msg);
                seen.add(msg);
              }
            } else {
              const msg = `Missing profile fields: ${output.missingFields.join(', ')}`;
              if (!seen.has(msg)) {
                summaries.push(msg);
                seen.add(msg);
              }
            }
          }
        }
        if (part?.type === 'tool-searchLawyers' && part?.state === 'output-available') {
          const lawyers = part.output?.lawyers || [];
          if (lawyers.length > 0) {
            const msg = `Found ${lawyers.length} matching lawyers.`;
            if (!seen.has(msg)) {
              summaries.push(msg);
              seen.add(msg);
            }
          } else {
            const msg = 'No lawyers found matching your criteria.';
            if (!seen.has(msg)) {
              summaries.push(msg);
              seen.add(msg);
            }
          }
        }
        if (part?.type === 'tool-getMyDataSummary' && part?.state === 'output-available') {
          const output = part.output;
          const msg = `Found ${output.count?.cases || 0} recent cases and ${output.count?.appointments || 0} upcoming appointments.`;
          if (!seen.has(msg)) {
            summaries.push(msg);
            seen.add(msg);
          }
        }
      }
      return summaries.join('\n\n');
    };
  }, [getToolParts]);

  const navigateWithFeedback = useCallback((path: string) => {
    const normalized = normalizePath(path) ?? path;
    setPendingNavigationPath(normalized);
    startRouteTransition(() => {
      router.push(normalized);
    });
  }, [normalizePath, router]);

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || isUploading) return;
    setDraft('');
    
    const messageId = Date.now().toString();
    let timeoutHandle: NodeJS.Timeout | null = null;
    
    try {
      // Set a timeout to detect stuck loading state
      timeoutHandle = setTimeout(() => {
        console.warn("[Chat] Message timeout - no response after 15 seconds");
        setMessages((prev: any) => {
          const lastMessage = prev[prev.length - 1];
          // Only show timeout if the last message is still loading
          if (lastMessage?.role === 'assistant' && lastMessage?.content === 'Processing...') {
            return [
              ...prev.slice(0, -1),
              {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                parts: [{ type: 'text', text: 'Request timed out. Please try again or contact support if the issue persists.' }],
              }
            ];
          }
          return prev;
        });
      }, 15000); // 15 second timeout
      
      await sendMessage({ text: trimmed } as any);
    } catch (err: any) {
      console.error("[Chat] Send error:", err);
      setMessages((prev: any) => ([
        ...prev,
        { 
          id: Date.now().toString(), 
          role: 'assistant', 
          parts: [{ type: 'text', text: `Error: ${err.message || 'Failed to send message'}` }]
        }
      ]));
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  // --- Voice Logic ---
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDraft(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      return () => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setDraft('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speak = useCallback((text: string) => {
    if (!shouldReadAloud || !text) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.replace(/\[.*?\]/g, '')); // Strip markers
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, [shouldReadAloud]);

  useEffect(() => {
    const last = messages?.slice?.(-1)?.[0] as any;
    if (last?.role === 'assistant' && status === 'ready' && !isSpeaking) {
      speak(getMessageText(last));
    }
  }, [messages, status, speak, getMessageText]);
  // --- End Voice Logic ---

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const last = messages?.slice?.(-1)?.[0] as any;
    if (!last || last.role !== 'assistant') return;
    
    const text = getMessageText(last);
    const path = getNavigatePath(last);
    if (!path) return;

    // Only auto-navigate if the AI explicitly says it's doing so (to prevent "aggressive" navigation)
    const isExplicitNav = isExplicitNavigationText(text);
    
    if (isExplicitNav) {
      const t = setTimeout(() => navigateWithFeedback(path), 800);
      return () => clearTimeout(t);
    }
  }, [messages, getNavigatePath, getMessageText, isExplicitNavigationText, navigateWithFeedback]);

  useEffect(() => {
    setPendingNavigationPath(null);
  }, [pathname]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const supabase = createClient();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to upload documents.");

      // Ensure there is a dedicated case container for AI analysis documents
      const { data: existingCases, error: caseFetchError } = await supabase
        .from("cases")
        .select("id")
        .eq("client_id", user.id)
        .eq("title", "AI Analysis Documents")
        .limit(1);

      if (caseFetchError) throw caseFetchError;

      let caseId = existingCases?.[0]?.id as string | undefined;
      if (!caseId) {
        const { data: newCase, error: newCaseError } = await supabase
          .from("cases")
          .insert({
            client_id: user.id,
            title: "AI Analysis Documents",
            description: "Case container for automatically analyzed documents.",
            status: "open",
          })
          .select("id")
          .single();

        if (newCaseError) throw newCaseError;
        caseId = newCase?.id;
      }

      if (!caseId) throw new Error("Could not initialize analysis case.");

      // 1. Upload to Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt ?? "bin"}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // 2. Create document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          case_id: caseId,
          uploaded_by: user.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          status: 'pending'
        })
        .select()
        .single();

      if (docError) throw docError;

      // 3. Add temporary local message
      setMessages((prev) => ([
        ...prev,
        { id: Date.now().toString(), role: 'user', parts: [{ type: 'text', text: `Uploaded document: ${file.name}` }] },
        { id: (Date.now() + 1).toString(), role: 'assistant', parts: [{ type: 'text', text: `I've received **${file.name}**. Analyzing it now...` }] }
      ]));

      // 4. Trigger Analysis
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      });

      const analysisData = await res.json();
      if (!res.ok) throw new Error(analysisData.error || "Analysis failed");

      // 5. Update messages with results (with Pakistani Law focus)
      const citations = Array.isArray(analysisData.analysis.legal_citations) 
        ? `\n\n**Relevant Pakistani Law:**\n- ${analysisData.analysis.legal_citations.join('\n- ')}`
        : '';
        
      const disclaimer = analysisData.analysis.disclaimer 
        ? `\n\n> [!IMPORTANT]\n> ${analysisData.analysis.disclaimer}`
        : '';

      const analysisContent = `### Analysis Complete for ${file.name}\n\n**Summary:** ${analysisData.analysis.summary}\n\n**Risk Level:** ${analysisData.analysis.risk_level}${citations}${disclaimer}\n\n[VIEW_ANALYSIS:${doc.id}]`;
      
      setMessages((prev) => ([
        ...prev,
        { 
          id: (Date.now() + 2).toString(), 
          role: 'assistant', 
          parts: [{
            type: 'text',
            text: analysisContent
          }]
        }
      ]));

      // 6. Save these messages to the database (since they didn't go through /api/chat)
      await Promise.all([
        supabase.from("ai_chat_messages").insert({
          user_id: user.id,
          role: "user",
          content: `Uploaded document: ${file.name}`
        }),
        supabase.from("ai_chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: `I've received **${file.name}**. Analyzing it now...`
        }),
        supabase.from("ai_chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: analysisContent
        })
      ]);

    } catch (err: any) {
      setMessages((prev) => ([
        ...prev,
        { id: Date.now().toString(), role: 'assistant', parts: [{ type: 'text', text: `Sorry, I encountered an error: ${err.message}` }] }
      ]));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="flex flex-col h-[70vh] max-h-[640px] min-h-[420px] border-none shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-bold">WiseCase Assistant</CardTitle>
          {isSpeaking && <Volume2 className="h-4 w-4 animate-pulse text-primary-foreground/80" />}
        </div>
        <div className="flex items-center gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => {
              setShouldReadAloud(!shouldReadAloud);
              if (shouldReadAloud) window.speechSynthesis.cancel();
            }} 
            className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8"
            title={shouldReadAloud ? "Mute Assistant" : "Unmute Assistant"}
          >
            {shouldReadAloud ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-50" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      {isRoutePending && (
        <div className="h-1 w-full bg-primary/20">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      )}

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-muted/20">
        {!historyReady ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground text-sm">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span>Loading your chat history…</span>
          </div>
        ) : (
        <>
        {messages.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm italic">Hello! I'm your WiseCase Assistant. How can I help you today?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void sendText(
                    chatRole === 'lawyer'
                      ? "Where can I review or upload case documents as a lawyer?"
                      : "Analyze my documents",
                  )
                }
              >
                Analyze Doc
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void sendText(
                    chatRole === 'lawyer'
                      ? "Take me to my lawyer appointments"
                      : "View my appointments",
                  )
                }
              >
                Appointments
              </Button>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={(m as any).id} className={cn("flex items-start gap-3 w-full", (m as any).role === 'user' ? "flex-row-reverse" : "flex-row")}>
            {/* Avatar */}
            {(m as any).role === 'user' ? (
              <Avatar className="shrink-0 h-8 w-8 border">
                {userAvatar ? <AvatarImage src={userAvatar} alt="You" className="object-cover" /> : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">ME</AvatarFallback>
              </Avatar>
            ) : (
              <Avatar className="shrink-0 h-8 w-8 border">
                <AvatarImage src="/legal_assistant_avatar.png" alt="WiseCase Assistant" className="object-cover" />
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">AI</AvatarFallback>
              </Avatar>
            )}

            <div className={cn("flex flex-col max-w-[80%]", (m as any).role === 'user' ? "items-end" : "items-start")}>
              {(() => {
                const rawText = getMessageText(m as any);
                const withVisibleLinks = rawText
                  .replace(/\[NAVIGATE:(.*?)\]/g, (_full, path) => {
                    const normalized = normalizePath(path) ?? path;
                    return `[${normalized}](${normalized})`;
                  })
                  .replace(/\[VIEW_ANALYSIS:(.*?)\]/g, '')
                  .replace(/\[ACTION:.*?:.*?\]/g, ''); 

                const actionMarkers = [...rawText.matchAll(/\[ACTION:(.*?):(.*?)\]/g)].map(match => ({
                  label: match[1],
                  path: match[2]
                })).filter((a) => isAllowedAction(a.label, a.path));

                const cleanText = withVisibleLinks.trim();
                const toolSummary = getToolSummary(m as any);
                const navPath = getNavigatePath(m as any);
                const profileFromSearch = (m as any).role === "assistant" ? getLawyerProfileHrefFromMessage(m) : null;
                const viewAnalysisId = rawText.match(/\[VIEW_ANALYSIS:(.*?)\]/)?.[1];
                const renderedText = cleanText || toolSummary || ((m as any).role === 'assistant' ? 'Processing...' : '');
                const isAutoNavMessage = isExplicitNavigationText(cleanText);
                
                return (
                  <div className={cn(
                    "rounded-2xl px-4 py-2 text-sm shadow-sm",
                    (m as any).role === 'user' 
                      ? "bg-primary text-primary-foreground rounded-tr-none" 
                      : "bg-background border border-border rounded-tl-none"
                  )}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({children}) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        ul: ({children}) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                        code: ({children}) => <code className="bg-muted/50 px-1 rounded text-xs font-mono">{children}</code>
                      }}
                    >
                      {renderedText}
                    </ReactMarkdown>

                    {(m as any).role === 'assistant' && (
                      <div className="flex flex-col gap-2 mt-1">
                        {viewAnalysisId && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <Button size="sm" className="w-full h-8 text-xs gap-2" onClick={() => navigateWithFeedback(`/client/analysis?documentId=${viewAnalysisId}`)}>
                              {pendingNavigationPath === `/client/analysis?documentId=${viewAnalysisId}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                              {pendingNavigationPath === `/client/analysis?documentId=${viewAnalysisId}` ? 'Opening...' : 'View Analysis'}
                            </Button>
                          </div>
                        )}
                        {actionMarkers.map((action, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs justify-between"
                            onClick={() => navigateWithFeedback(action.path)}
                            disabled={isRoutePending}
                          >
                            {action.label}
                            {pendingNavigationPath === (normalizePath(action.path) ?? action.path) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Navigation className="h-3 w-3 opacity-50" />
                            )}
                          </Button>
                        ))}
                        {profileFromSearch && (
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full h-8 text-xs justify-between mt-2"
                            onClick={() => navigateWithFeedback(profileFromSearch)}
                            disabled={isRoutePending}
                          >
                            {pendingNavigationPath === profileFromSearch ? "Opening…" : "View Profile"}
                            {pendingNavigationPath === profileFromSearch ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Navigation className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        {navPath &&
                          !viewAnalysisId &&
                          actionMarkers.length === 0 &&
                          !isAutoNavMessage &&
                          !profileFromSearch && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full h-8 text-xs justify-between mt-2"
                            onClick={() => navigateWithFeedback(navPath)}
                            disabled={isRoutePending}
                          >
                            {pendingNavigationPath === navPath ? 'Opening...' : 'Go to Page'}
                            {pendingNavigationPath === navPath ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Navigation className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
        {(() => {
          const last = messages[messages.length - 1] as any;
          const lastLooksLikeAssistantError =
            last?.role === "assistant" && getMessageText(last).trimStart().startsWith("Error:");
          return (isLoading || isUploading) && !lastLooksLikeAssistantError;
        })() && (
          <div className="flex justify-start items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
            <Avatar className="shrink-0 h-8 w-8 border">
              <AvatarImage src="/legal_assistant_avatar.png" alt="WiseCase Assistant" className="object-cover" />
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">AI</AvatarFallback>
            </Avatar>
            <div className="bg-background border border-border rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-1">
                {isUploading && <span className="text-[10px] font-medium text-muted-foreground mb-1">Analyzing document...</span>}
                {isLoading && !isUploading && <span className="text-[10px] font-medium text-muted-foreground mb-1">Thinking...</span>}
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-grow [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-grow [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-grow"></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
        </>
        )}
      </CardContent>

      <CardFooter className="p-3 border-t bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendText(draft);
          }}
          className="flex w-full items-center gap-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
          />
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="shrink-0 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className={cn("shrink-0", isListening ? "text-primary animate-pulse" : "text-muted-foreground")}
            onClick={toggleListening}
          >
            {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <textarea
            value={safeInput}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendText(draft);
              }
            }}
            placeholder={isListening ? "Listening..." : "Type your message..."}
            className={cn(
              "flex-1 min-h-10 max-h-28 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm",
              "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
              "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
              isListening && "placeholder:text-primary placeholder:font-bold"
            )}
            disabled={isLoading || isUploading || !historyReady}
          />
          <Button type="submit" size="icon" disabled={isLoading || isUploading || !historyReady || safeInput.trim().length === 0}>
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

