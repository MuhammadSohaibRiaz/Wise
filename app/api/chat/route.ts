import { convertToModelMessages, streamText, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getInitialMessage } from "@/lib/chatBotData";
import { tools } from "@/lib/ai/tools";

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

export async function POST(req: Request) {
  try {
    // Parse request with validation
    let body: any;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("[Chat API] Failed to parse JSON:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid request format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, currentPath } = body;
    
    // Validate messages array
    if (!Array.isArray(messages)) {
      console.error("[Chat API] Invalid messages format:", typeof messages);
      return new Response(
        JSON.stringify({ error: "Messages must be an array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert messages with error handling
    let modelMessages: any;
    try {
      modelMessages = await convertToModelMessages(messages);
    } catch (convertError) {
      console.error("[Chat API] Failed to convert messages:", convertError);
      return new Response(
        JSON.stringify({ error: "Failed to process messages" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const systemMessage = getInitialMessage();
    const pageContext = currentPath ? `\n[PAGE_CONTEXT] User is currently viewing: ${currentPath}. Tailor your response to this page if relevant (e.g. if on a case page, offer to help with that case).` : "";

    let authContext = "";
    if (!user) {
      authContext =
        `Current User: Guest (not logged in). For any personalized profile, cases, appointments, or uploads, explain they must sign in. ` +
        `Use [NAVIGATE:/auth/client/sign-in] for general/client login; if they say they are a lawyer logging in, use [NAVIGATE:/auth/lawyer/sign-in].`;
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
          `Current User: ${user.email}, role **client** (${first}). **Always use client routes**: dashboard \`/client/dashboard\`, settings \`/client/settings\`, appointments \`/client/appointments\`, cases \`/client/cases\`, analysis \`/client/analysis\`, AI recommendations \`/client/ai-recommendations\`, match \`/match\`.`;
      }
    }

    let result;
    try {
      // Validate Groq API key before attempting to call
      if (!process.env.GROQ_API_KEY) {
        throw new Error("[CRITICAL] GROQ_API_KEY is not configured. Please set it in your environment variables.");
      }

      result = await streamText({
        model: groq("llama-3.3-70b-versatile"),
        system: `${systemMessage.content}\n\n${authContext}${pageContext}`,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(8),
        onFinish: async ({ text, toolCalls, toolResults }) => {
          if (user) {
            try {
              // 1. Save user's last message (robust: supports parts-based UI messages)
              const lastUserMessage = messages[messages.length - 1]
              if (lastUserMessage && lastUserMessage.role === "user") {
                const userText = extractTextFromUiMessage(lastUserMessage)
                await supabase.from("ai_chat_messages").insert({
                  user_id: user.id,
                  role: "user",
                  content: userText || "[User message]",
                });
              }

              // 2. Save assistant response
              await supabase.from("ai_chat_messages").insert({
                user_id: user.id,
                role: "assistant",
                content: text,
                metadata: { toolCalls, toolResults },
              });
            } catch (saveError) {
              console.error("[Chat API] Failed to save messages to database:", saveError);
              // Don't fail the entire request just because DB save failed
            }
          }
        },
      });
    } catch (toolError: any) {
      // Check if this is a Groq auth error or other API error
      const errorMessage = toolError?.message || String(toolError);
      const isAuthError = errorMessage.includes("GROQ_API_KEY") || 
                         errorMessage.includes("401") || 
                         errorMessage.includes("Unauthorized") ||
                         errorMessage.includes("api_key");
      
      if (isAuthError) {
        console.error("[Chat API] Groq API authentication failed:", errorMessage);
        return new Response(
          JSON.stringify({ 
            error: "Chat service is not properly configured. Please contact support." 
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      // For other tool-call errors, try fallback without tools
      console.warn("[Chat API] Tool-call generation failed, attempting fallback:", errorMessage);
      
      try {
        result = await streamText({
          model: groq("llama-3.3-70b-versatile"),
          system: `${systemMessage.content}\n\n${authContext}${pageContext}`,
          messages: modelMessages,
          // No tools in fallback
          onFinish: async ({ text }) => {
            if (user) {
              try {
                // Save messages in fallback case too
                const lastUserMessage = messages[messages.length - 1]
                if (lastUserMessage && lastUserMessage.role === "user") {
                  const userText = extractTextFromUiMessage(lastUserMessage)
                  await supabase.from("ai_chat_messages").insert({
                    user_id: user.id,
                    role: "user",
                    content: userText || "[User message]",
                  });
                }
                await supabase.from("ai_chat_messages").insert({
                  user_id: user.id,
                  role: "assistant",
                  content: text,
                });
              } catch (saveError) {
                console.error("[Chat API] Fallback: Failed to save messages:", saveError);
              }
            }
          },
        });
      } catch (fallbackError) {
        console.error("[Chat API] Fallback also failed:", fallbackError);
        const fallbackMessage = fallbackError?.message || String(fallbackError);
        
        // Determine appropriate error response
        let statusCode = 500;
        let errorMsg = "Sorry, I'm temporarily unavailable. Please try again in a moment.";
        
        if (fallbackMessage.includes("GROQ_API_KEY") || fallbackMessage.includes("401")) {
          statusCode = 503;
          errorMsg = "Chat service is not configured. Please contact support.";
        } else if (fallbackMessage.includes("rate limit") || fallbackMessage.includes("429")) {
          statusCode = 429;
          errorMsg = "I'm currently busy. Please wait a moment and try again.";
        } else if (fallbackMessage.includes("timeout")) {
          statusCode = 504;
          errorMsg = "The request took too long. Please try again.";
        }
        
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: statusCode, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error("[Chat API] Unhandled error:", { message: errorMessage, error });
    
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
