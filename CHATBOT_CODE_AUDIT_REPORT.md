# WiseCase Chatbot Implementation - Comprehensive Code Audit
**Date**: May 7, 2026  
**Files Audited**: Chat.tsx, route.ts, tools.ts, chatbot.tsx

---

## Executive Summary

The chatbot implementation has **15 identified issues** across streaming, rendering, avatars, performance, and accessibility. **2 HIGH severity** bugs need immediate attention (speech synthesis race condition, resource leak). **8 MEDIUM severity** issues should be prioritized.

---

## 🔴 CRITICAL BUGS (HIGH SEVERITY)

### BUG #1: Speech Synthesis Race Condition
**Location**: [Chat.tsx](Chat.tsx#L267-277)  
**Severity**: 🔴 HIGH  
**Category**: UX / Performance

**Problem**:
- `speak()` function is called on every `messages`, `status`, or `getMessageText` change
- If user sends 3 messages rapidly, 3 separate speech synthesis requests queue up
- No rate limiting or debouncing mechanism
- Multiple utterances may overlap, creating confusing audio

**Current Code**:
```typescript
useEffect(() => {
  const last = messages?.slice?.(-1)?.[0] as any;
  if (last?.role === 'assistant' && status === 'ready' && !isSpeaking) {
    speak(getMessageText(last)); // Queues immediately
  }
}, [messages, status, speak, getMessageText]); // Runs on every update
```

**Impact**: Poor audio experience, overlapping speech, resource waste

**Fix**:
```typescript
useEffect(() => {
  const last = messages?.slice?.(-1)?.[0] as any;
  // Only speak if this is a NEW assistant message
  const prevLast = useRef<any>(null);
  
  if (last?.role === 'assistant' && status === 'ready' && !isSpeaking && last?.id !== prevLast.current?.id) {
    speak(getMessageText(last));
    prevLast.current = last;
  }
}, [messages, status, speak, getMessageText]);
```

---

### BUG #2: Speech Recognition Resource Leak
**Location**: [Chat.tsx](Chat.tsx#L227-243)  
**Severity**: 🔴 HIGH  
**Category**: Memory / Cleanup

**Problem**:
- `SpeechRecognition` instance created in useEffect without cleanup
- If component unmounts while user is listening, recognizer keeps running
- Browser resources never released
- Repeated opens/closes of chat causes multiple lingering recognizers

**Current Code**:
```typescript
useEffect(() => {
  if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    // ... setup handlers
    // ❌ NO cleanup function
  }
}, []); // Only runs once
```

**Impact**: Resource leak, browser slowdown, multiple recognizers running simultaneously

**Fix**:
```typescript
useEffect(() => {
  if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    // ... setup
    
    return () => {
      recognitionRef.current?.stop(); // Cleanup on unmount
      recognitionRef.current = null;
    };
  }
}, []);
```

---

## 🟠 MAJOR BUGS (MEDIUM SEVERITY)

### BUG #3: Missing User/Lawyer Avatar Integration
**Location**: [Chat.tsx](Chat.tsx#L541-545) | [chatbot.tsx](chatbot.tsx#L70-76)  
**Severity**: 🟠 MEDIUM  
**Category**: UX / UI

**Problem**:
- Avatars show generic "ME" and "AI" text labels only
- No integration with `profiles.avatar_url` database field
- Users cannot see profile pictures for themselves or lawyers
- Bot uses `/legal_assistant_avatar.png` which may not exist
- Unprofessional appearance compared to ChatGPT-style interfaces

**Current Code** (Chat.tsx):
```typescript
<div className="...">
  {(m as any).role === 'user' ? 'ME' : 'AI'}
</div>
```

**Current Code** (chatbot.tsx):
```typescript
<Avatar className="h-full w-full border-2 border-white/20">
  <AvatarImage src="/legal_assistant_avatar.png" alt="AI Assistant" />
  <AvatarFallback>
    <Headset className="h-8 w-8 text-white" />
  </AvatarFallback>
</Avatar>
```

**Impact**: Poor UX, unprofessional appearance, reduced user trust

**Fix**:
1. Load user avatar from profile in Chat component
2. Display lawyer profile pictures if known
3. Add default bot avatar to `/public`

```typescript
// In Chat.tsx, add after loadRoleAndHistory:
const [userAvatar, setUserAvatar] = useState<string | null>(null);

useEffect(() => {
  const loadAvatar = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      setUserAvatar(profile?.avatar_url || null);
    }
  };
  void loadAvatar();
}, []);

// In avatar render:
{(m as any).role === 'user' && userAvatar ? (
  <img src={userAvatar} alt="You" className="h-8 w-8 rounded-full" />
) : (
  <div className="...">{(m as any).role === 'user' ? 'ME' : 'AI'}</div>
)}
```

---

### BUG #4: Aggressive Auto-Scroll During Streaming
**Location**: [Chat.tsx](Chat.tsx#L290)  
**Severity**: 🟠 MEDIUM  
**Category**: UX

**Problem**:
- Auto-scroll runs on EVERY change to `messages` array
- Scrolls even while assistant is typing/streaming response
- Creates jarring visual experience as new words appear
- Should only scroll when NEW message arrives or when response starts

**Current Code**:
```typescript
useEffect(() => {
  scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]); // Runs on EVERY message change, including streaming updates
```

**Impact**: Confusing UX, makes text hard to read during streaming response

**Fix**: Only scroll when message COUNT increases or first response words arrive
```typescript
const [messageCount, setMessageCount] = useState(0);

useEffect(() => {
  if (messages.length > messageCount) {
    setMessageCount(messages.length);
    // Only scroll when new message is added, not on content updates
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
}, [messages.length, messageCount]);
```

---

### BUG #5: Memory Leak in loadRoleAndHistory useEffect
**Location**: [Chat.tsx](Chat.tsx#L60-80)  
**Severity**: 🟠 MEDIUM  
**Category**: Memory / React Warning

**Problem**:
- Async operations don't check if component is mounted before setState
- If user closes chat while history is loading, `setMessages()` and `setChatRole()` still execute
- Generates React warning: "Can't perform a React state update on an unmounted component"
- Memory leak from abandoned async tasks

**Current Code**:
```typescript
useEffect(() => {
  const loadRoleAndHistory = async () => {
    // ... long async operations
    const historyRes = await fetch('/api/chat/history');
    if (historyRes.ok) {
      const { messages: historyData } = await historyRes.json();
      setMessages(mappedMessages); // ❌ Can fire after unmount
      setChatRole(...);
    }
  };
  void loadRoleAndHistory();
  // No cleanup or mounted check
}, [setMessages]);
```

**Impact**: Console warnings, potential memory leaks

**Fix**: Add mounted ref or AbortController
```typescript
useEffect(() => {
  let isMounted = true;
  const abortController = new AbortController();

  const loadRoleAndHistory = async () => {
    try {
      // ... fetch calls with abortController.signal
      if (isMounted) {
        setMessages(mappedMessages);
        setChatRole(...);
      }
    } catch (err) {
      if (isMounted) console.error("[Chat] Load error:", err);
    }
  };
  
  void loadRoleAndHistory();
  
  return () => {
    isMounted = false;
    abortController.abort();
  };
}, [setMessages]);
```

---

### BUG #6: Null/Undefined Safety on Message Parts
**Location**: [Chat.tsx](Chat.tsx#L102-115)  
**Severity**: 🟠 MEDIUM  
**Category**: Robustness

**Problem**:
- `getMessageText()` and `getToolParts()` assume message structure without deep validation
- If API returns malformed message (missing `parts`, null values), could cause undefined errors
- No defensive checks throughout message processing

**Current Code**:
```typescript
const getMessageText = useMemo(() => {
  return (m: any) => {
    const parts = Array.isArray(m?.parts) ? m.parts : [];
    if (parts.length > 0) {
      return parts
        .filter((p: any) => p?.type === 'text') // Could be undefined
        .map((p: any) => p.text ?? '')
        .join('');
    }
    return typeof m?.content === 'string' ? m.content : '';
  };
}, []);
```

**Impact**: Potential crashes with malformed API responses

**Fix**: Add comprehensive null checks
```typescript
const getMessageText = useMemo(() => {
  return (m: any) => {
    if (!m) return '';
    const parts = Array.isArray(m.parts) ? m.parts : [];
    if (parts.length > 0) {
      return parts
        .filter((p: any) => p && typeof p === 'object' && p.type === 'text')
        .map((p: any) => String(p.text ?? ''))
        .filter(Boolean)
        .join('');
    }
    return typeof m.content === 'string' ? String(m.content) : '';
  };
}, []);
```

---

### BUG #7: Fragile Timeout Detection Logic
**Location**: [Chat.tsx](Chat.tsx#L233-242)  
**Severity**: 🟠 MEDIUM  
**Category**: Reliability

**Problem**:
- Timeout detection checks if last message content is EXACTLY `"Processing..."`
- If assistant has started typing or message has different format, timeout never triggers
- Relies on fragile string matching instead of state
- Message content is inconsistent between `content` and `parts` fields

**Current Code**:
```typescript
if (lastMessage?.role === 'assistant' && lastMessage?.content === 'Processing...') {
  return [
    ...prev.slice(0, -1),
    {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      parts: [{ type: 'text', text: '⏱️ Request timed out...' }],
    }
  ];
}
```

**Impact**: Timeout detection fails silently if message format differs

**Fix**: Track timeout state separately
```typescript
const [isTimeout, setIsTimeout] = useState(false);

const timeoutHandle = setTimeout(() => {
  console.warn("[Chat] Message timeout - no response after 15 seconds");
  if (status !== 'ready') {
    setIsTimeout(true);
    setMessages((prev: any) => ([
      ...prev,
      {
        id: Date.now().toString(),
        role: 'assistant',
        parts: [{ type: 'text', text: '⏱️ Request timed out...' }],
      }
    ]));
  }
  setIsTimeout(false);
}, 15000);
```

---

### BUG #8: Custom Body Parameters Not Sent to API
**Location**: [Chat.tsx](Chat.tsx#L34-36) | [route.ts](route.ts#L31)  
**Severity**: 🟠 MEDIUM  
**Category**: Integration

**Problem**:
- `useChat` hook configured with custom `body: { currentPath: pathname }`
- `DefaultChatTransport` does NOT support custom body parameters in constructor
- The `currentPath` is never sent to API route
- API checks for `currentPath` but always receives `undefined`
- Page context awareness (tailoring responses to current page) doesn't work

**Current Code** (Chat.tsx):
```typescript
const { messages, sendMessage, setMessages, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
  body: { currentPath: pathname } // ❌ Not actually sent
});
```

**Current Code** (route.ts):
```typescript
const { messages, currentPath } = body;
// currentPath is always undefined due to above bug
const pageContext = currentPath ? `[PAGE_CONTEXT] User is currently viewing: ${currentPath}...` : "";
```

**Impact**: AI can't provide page-specific help; page context awareness broken

**Fix**: Create custom transport or fetch wrapper
```typescript
// Use custom fetcher:
const { messages, sendMessage, setMessages, status } = useChat({
  api: '/api/chat',
  body: { currentPath: pathname }
  // OR use fetch wrapper if DefaultChatTransport doesn't support it
} as any);

// Or extend DefaultChatTransport to pass body
```

---

### BUG #9: Message Utilities Recalculated Multiple Times Per Render
**Location**: [Chat.tsx](Chat.tsx#L531-590)  
**Severity**: 🟠 MEDIUM  
**Category**: Performance

**Problem**:
- `getMessageText()`, `getToolParts()`, `getToolSummary()`, `getNavigatePath()` all called fresh in message map
- Even with useMemo, these are recalculated for every single message on every render
- Results not cached per-message
- With 50+ messages, causes noticeable lag

**Current Code**:
```typescript
{messages.map((m) => (
  <div>
    {(() => {
      const text = getMessageText(m); // Recalculated on every render
      const toolSummary = getToolSummary(m); // Recalculated
      const navPath = getNavigatePath(m); // Recalculated
      // ...
    })()}
  </div>
))}
```

**Impact**: Slower rendering, laggy scroll on long conversations

**Fix**: Memoize individual messages
```typescript
const MessageComponent = React.memo(({ message, onNavigate }: any) => {
  const text = useMemo(() => getMessageText(message), [message]);
  const toolSummary = useMemo(() => getToolSummary(message), [message]);
  const navPath = useMemo(() => getNavigatePath(message), [message]);
  
  return <div>{/* render */}</div>;
});

// Then in messages.map:
{messages.map((m) => <MessageComponent key={m.id} message={m} />)}
```

---

### BUG #10: No Message Virtualization for Long Chat Histories
**Location**: [Chat.tsx](Chat.tsx#L531-600)  
**Severity**: 🟠 MEDIUM  
**Category**: Performance / Scalability

**Problem**:
- All messages rendered in DOM regardless of viewport visibility
- Chat with 1000+ messages causes severe performance degradation
- No lazy loading or pagination
- Scroll performance suffers with every message rendered

**Impact**: Unusable chatbot after ~200+ messages

**Fix**: Implement virtual scrolling with `react-window` or similar
```typescript
import { FixedSizeList as List } from 'react-window';

<List
  height={600}
  itemCount={messages.length}
  itemSize={60}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      {/* Render message at index */}
    </div>
  )}
</List>
```

---

## 🟡 MINOR ISSUES (LOW-MEDIUM SEVERITY)

### BUG #11: No Timestamps on Messages
**Location**: [Chat.tsx](Chat.tsx#L531-560)  
**Severity**: 🟡 LOW-MEDIUM  
**Category**: UX

**Problem**:
- Messages don't show when they were sent
- With long conversations, hard to understand timeline
- Standard in all modern chat interfaces

**Impact**: Reduced usability for long conversations

**Fix**: Display timestamp on each message
```typescript
<div className="text-xs text-muted-foreground mt-1">
  {new Date(message.createdAt).toLocaleTimeString()}
</div>
```

---

### BUG #12: No Typing Indicators or Read Receipts
**Location**: [Chat.tsx](Chat.tsx)  
**Severity**: 🟡 LOW  
**Category**: UX

**Problem**:
- No "Assistant is typing..." indicator
- No delivery confirmation for user messages
- No read status

**Impact**: Uncertain if message was received

**Fix**: Add typing animation and delivery status

---

### BUG #13: Missing Accessibility Labels (ARIA)
**Location**: [Chat.tsx](Chat.tsx#L541-545) | [chatbot.tsx](chatbot.tsx#L60-90)  
**Severity**: 🟡 LOW  
**Category**: Accessibility

**Problem**:
- Avatar divs don't have semantic meaning
- Icon buttons lack aria-labels
- Screen readers can't identify components

**Current Code**:
```typescript
<div className="...">
  {(m as any).role === 'user' ? 'ME' : 'AI'}
</div>
```

**Fix**:
```typescript
<div 
  className="..." 
  role="img" 
  aria-label={`${message.role === 'user' ? 'Your' : 'Assistant\'s'} message avatar`}
>
  {message.role === 'user' ? 'ME' : 'AI'}
</div>
```

---

### BUG #14: Race Condition in Auto-Navigation
**Location**: [Chat.tsx](Chat.tsx#L301-318)  
**Severity**: 🟡 LOW-MEDIUM  
**Category**: Edge Case

**Problem**:
- `router.push()` scheduled in timeout without mounted check
- If component closes before timeout fires, navigation might fail
- No error handling for navigation failures

**Current Code**:
```typescript
if (isExplicitNav) {
  const t = setTimeout(() => router.push(path), 800);
  return () => clearTimeout(t);
}
```

**Fix**: Add mounted check
```typescript
let isMounted = true;
if (isExplicitNav) {
  const t = setTimeout(() => {
    if (isMounted) router.push(path).catch(err => console.error(err));
  }, 800);
  return () => {
    isMounted = false;
    clearTimeout(t);
  };
}
```

---

### BUG #15: File Upload Without Client-Side Validation
**Location**: [Chat.tsx](Chat.tsx#L453)  
**Severity**: 🟡 LOW  
**Category**: UX

**Problem**:
- Accept attribute set but no validation before upload
- If user selects unsupported file, error appears late
- No user feedback about supported formats

**Current Code**:
```typescript
<input
  type="file"
  accept=".pdf,.jpg,.jpeg,.png"
/>
```

**Fix**: Add client validation
```typescript
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  const supported = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!supported.includes(file.type)) {
    alert('Only PDF, JPG, and PNG files are supported');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    alert('File must be smaller than 10MB');
    return;
  }
  
  handleFileUpload(e);
};
```

---

## 📊 Streaming & Rendering Analysis

### ✅ What's Working Well
- **Streaming**: useChat hook properly handles word-by-word streaming from API
- **Transport**: DefaultChatTransport works correctly for streaming responses
- **Backend**: `streamText()` returns proper ReadableStream
- **Message Updates**: Messages appear gradually as stream arrives

### ❌ Issues Found
- **Auto-scroll**: Too aggressive during streaming (BUG #4)
- **No typing indicators**: Users don't see "typing..." feedback
- **Speech timing**: Race conditions in speech synthesis (BUG #1)

---

## 📋 Severity Summary

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 HIGH | 2 | Speech race condition, Resource leak |
| 🟠 MEDIUM | 8 | Avatars, scroll, memory leak, nulls, timeout, params, perf, virtualization |
| 🟡 LOW | 5 | Timestamps, typing, a11y, nav race, file validation |

---

## 🎯 Recommended Fix Order

1. **IMMEDIATE** (Next commit):
   - BUG #2: Fix speech recognition cleanup
   - BUG #5: Fix memory leak in async useEffect

2. **THIS SPRINT**:
   - BUG #1: Fix speech synthesis race condition
   - BUG #3: Add avatar integration
   - BUG #4: Fix aggressive auto-scroll

3. **NEXT SPRINT**:
   - BUG #6-10: Performance and robustness fixes
   - BUG #11-15: UX and accessibility improvements

---

## 📞 Questions for Product Team

1. Should we show full user profile pics in chat?
2. Should timestamps be visible or in tooltip?
3. Is page context awareness (BUG #8) actually used?
4. Should we implement message virtualization for long chats?

