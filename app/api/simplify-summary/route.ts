import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Groq } from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { summary, category, risk_level, urgency, seriousness, key_terms, legal_citations } = body

  if (!summary || typeof summary !== "string") {
    return NextResponse.json({ error: "summary is required" }, { status: 400 })
  }

  const context = [
    category && `Document type: ${category}`,
    risk_level && risk_level !== "N/A" && `Risk level: ${risk_level}`,
    urgency && urgency !== "N/A" && `Urgency: ${urgency}`,
    seriousness && seriousness !== "N/A" && `Seriousness: ${seriousness}`,
    Array.isArray(key_terms) && key_terms.length > 0 && `Key legal terms: ${key_terms.slice(0, 6).join(", ")}`,
    Array.isArray(legal_citations) && legal_citations.length > 0 && `Laws involved: ${legal_citations.slice(0, 3).join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n")

  const prompt = `You are a plain-language legal explainer. A Pakistani client (non-lawyer) uploaded a legal document and received this AI-generated summary:

ORIGINAL SUMMARY:
${summary}

DOCUMENT CONTEXT:
${context}

Rewrite the summary in simple, everyday language that a person with no legal background can fully understand. Rules:
- Use short sentences. Avoid legal jargon. If you must use a legal term, briefly explain it in parentheses.
- Keep it grounded to what the ORIGINAL SUMMARY says — do not add new facts or predictions.
- Keep it to 3–5 sentences maximum.
- Write as if explaining to a friend who is worried about their legal situation — be calm and clear.
- Do NOT say "the document says" or "the summary says" — just explain the situation directly.
- Do NOT include any disclaimer or sign-off.

Return ONLY the simplified explanation text. No labels, no JSON, no preamble.`

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 300,
    })

    const simplified = completion.choices[0]?.message?.content?.trim()
    if (!simplified) return NextResponse.json({ error: "No response from AI" }, { status: 500 })

    return NextResponse.json({ simplified })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI request failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
