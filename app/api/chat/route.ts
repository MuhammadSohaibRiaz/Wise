import { convertToModelMessages, streamText, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getInitialMessage } from "@/lib/chatBotData";
import { tools } from "@/lib/ai/tools";
import { extractCaseIdFromPath } from "@/lib/chat-case-context";
import { applySimpleRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Validate Groq API key at startup
if (!process.env.GROQ_API_KEY) {
  console.error("[Chat API] CRITICAL: GROQ_API_KEY is not set in environment variables");
}

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

import { createClient } from "@/lib/supabase/server";

function extractTextFromUiMessage(m: any): string {
  if (!m) return ""
  if (typeof m.content === "string" && m.content.trim()) return m.content.trim()
  const parts = Array.isArray(m.parts) ? m.parts : []
  const text = parts
    .filter((p: any) => p?.type === "text")
    .map((p: any) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim()
  return text
}

async function resolveAuthorizedCaseId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rawCaseId: string | null,
): Promise<string | null> {
  if (!rawCaseId) return null

  const { data, error } = await supabase
    .from("cases")
    .select("id, client_id, lawyer_id")
    .eq("id", rawCaseId)
    .maybeSingle()

  if (error || !data) return null

  if (data.client_id !== userId && data.lawyer_id !== userId) {
    return null
  }

  return data.id
}

export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    let body: any;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("[Chat:API] ✗ JSON parse failed:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid request format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, currentPath } = body;
    const requestedCaseId = extractCaseIdFromPath(currentPath);
    console.log(`[Chat:API] ▶ POST | msgs=${messages?.length ?? '?'} | path=${currentPath} | requestedCase=${requestedCaseId || 'none'} | ip=${ip}`);
    
    if (!Array.isArray(messages)) {
      console.error("[Chat:API] ✗ messages is not an array:", typeof messages);
      return new Response(
        JSON.stringify({ error: "Messages must be an array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let modelMessages: any;
    try {
      modelMessages = await convertToModelMessages(messages);
      console.log(`[Chat:API]   convertToModelMessages → ${modelMessages?.length ?? 0} model messages`);
    } catch (convertError) {
      console.error("[Chat:API] ✗ convertToModelMessages failed:", convertError);
      return new Response(
        JSON.stringify({ error: "Failed to process messages" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const caseId = user ? await resolveAuthorizedCaseId(supabase, user.id, requestedCaseId) : null
    console.log(`[Chat:API]   auth → ${user ? `user=${user.id.slice(0,8)}… email=${user.email}` : 'GUEST'} | caseId=${caseId || 'none'}`);

    const throttle = applySimpleRateLimit({
      namespace: "api-chat-post",
      key: user?.id || ip,
      limit: 25,
      windowMs: 60_000,
    })
    if (!throttle.ok) {
      console.warn(`[Chat:API] ✗ rate limited (retry in ${throttle.retryAfterSec}s)`);
      return new Response(JSON.stringify({ error: "Too many chat requests. Please wait a moment." }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(throttle.retryAfterSec),
        },
      })
    }

    const systemMessage = getInitialMessage();
    const pageContext = currentPath ? `\n[PAGE_CONTEXT] User is currently viewing: ${currentPath}. Tailor your response to this page if relevant (e.g. if on a case page, offer to help with that case).` : "";

    let authContext = "";
    if (!user) {
      authContext =
        `Current User: Guest (not logged in). ` +
        `Guests can browse lawyers at /match and ask general legal questions. ` +
        `For anything personal (cases, appointments, uploads, analysis), tell them to sign in. ` +
        `Use [ACTION:Sign In:/auth/client/sign-in] or [ACTION:Sign Up:/auth/client/register] buttons. ` +
        `If they say they are a lawyer, use [ACTION:Lawyer Sign In:/auth/lawyer/sign-in]. ` +
        `Keep responses short and helpful.`;
    } else {
      const { data: profile } = await supabase.from("profiles").select("user_type, first_name").eq("id", user.id).maybeSingle();
      const role = profile?.user_type === "lawyer" ? "lawyer" : "client";
      const first = profile?.first_name?.trim() || "there";
      if (role === "lawyer") {
        authContext =
          `Current User: ${user.email}, role **lawyer** (${first}). **Always use lawyer routes**: dashboard \`/lawyer/dashboard\`, appointments \`/lawyer/appointments\`, cases \`/lawyer/cases\`, profile/settings \`/lawyer/profile\`. ` +
          `Never navigate this user to \`/client/*\` unless they explicitly ask how clients experience the product. ` +
          `Document analysis chat uploads still use \`/client/analysis\` only when analyzing own docs as on that page — prefer directing lawyers to their dashboard or profile for practice settings.`;
      } else {
        authContext =
          `Current User: ${user.email}, role **client** (${first}). **Always use client routes**: dashboard \`/client/dashboard\`, settings \`/client/settings\`, appointments \`/client/appointments\`, cases \`/client/cases\`, analysis \`/client/analysis\`, browse lawyers \`/match\`.`;
      }
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("[Chat:API] ✗ GROQ_API_KEY missing");
      return new Response(
        JSON.stringify({ error: "Chat service is not properly configured. Please contact support." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const saveChatMessages = async (text: string, toolCalls?: unknown, toolResults?: unknown) => {
      if (!user) { console.log("[Chat:API]   onFinish → skip save (guest)"); return; }
      try {
        const lastUserMessage = messages[messages.length - 1]
        if (lastUserMessage && lastUserMessage.role === "user") {
          const userText = extractTextFromUiMessage(lastUserMessage)
          await supabase.from("ai_chat_messages").insert({
            user_id: user.id,
            case_id: caseId,
            role: "user",
            content: userText || "[User message]",
          });
        }
        await supabase.from("ai_chat_messages").insert({
          user_id: user.id,
          case_id: caseId,
          role: "assistant",
          content: text,
          metadata: toolCalls ? { toolCalls, toolResults } : undefined,
        });
        console.log(`[Chat:API]   onFinish → saved to DB (text=${text.length}chars, tools=${toolCalls ? 'yes' : 'no'})`);
      } catch (saveError) {
        console.error("[Chat:API] ✗ onFinish → DB save failed:", saveError);
      }
    };

    const systemPrompt = `${systemMessage.content}\n\n${authContext}${pageContext}`;

    const useTools = !!user;
    console.log(`[Chat:API]   streaming → tools=${useTools} | model=llama-3.3-70b-versatile | systemPromptLen=${systemPrompt.length}`);
    let result;
    try {
      result = await streamText({
        model: groq("llama-3.3-70b-versatile"),
        system: systemPrompt,
        messages: modelMessages,
        ...(useTools ? { tools, stopWhen: stepCountIs(3) } : {}),
        onFinish: async ({ text, toolCalls, toolResults }) => saveChatMessages(text, toolCalls, toolResults),
      });
      console.log(`[Chat:API]   streamText → ok (${Date.now() - t0}ms)`);
    } catch (toolError: any) {
      const errorMessage = toolError?.message || String(toolError);
      console.warn(`[Chat:API] ✗ streamText threw (${Date.now() - t0}ms):`, errorMessage);

      const isAuthError = errorMessage.includes("GROQ_API_KEY") ||
                         errorMessage.includes("401") ||
                         errorMessage.includes("Unauthorized") ||
                         errorMessage.includes("api_key");

      if (isAuthError) {
        console.error("[Chat:API] ✗ auth error, not retrying");
        return new Response(
          JSON.stringify({ error: "Chat service is not properly configured. Please contact support." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        console.log("[Chat:API]   fallback → retrying without tools...");
        const systemWithNav = `${systemPrompt}\n\n[IMPORTANT] Tool calling is temporarily unavailable. Reply with plain text only. For navigation, include [NAVIGATE:/path] or [ACTION:Label:/path] markers in your text.`;
        result = await streamText({
          model: groq("llama-3.3-70b-versatile"),
          system: systemWithNav,
          messages: modelMessages,
          onFinish: async ({ text }) => saveChatMessages(text),
        });
        console.log(`[Chat:API]   fallback → ok (${Date.now() - t0}ms)`);
      } catch (fallbackError: any) {
        console.error(`[Chat:API] ✗ fallback also failed (${Date.now() - t0}ms):`, fallbackError?.message || fallbackError);
        const msg = fallbackError?.message || String(fallbackError);
        const statusCode = msg.includes("429") || msg.includes("rate limit") ? 429 : 500;
        return new Response(
          JSON.stringify({ error: statusCode === 429 ? "I'm currently busy. Please wait a moment." : "Sorry, I'm temporarily unavailable. Please try again." }),
          { status: statusCode, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[Chat:API] ✓ returning stream (${Date.now() - t0}ms)`);
    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error(`[Chat:API] ✗ UNHANDLED (${Date.now() - t0}ms):`, { message: errorMessage, stack: error?.stack?.split('\n').slice(0, 3) });
    
    // Return a user-friendly error response
    const statusCode = error?.status || 500;
    return new Response(
      JSON.stringify({ 
        error: "An error occurred while processing your message. Please try again.",
        debug: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
