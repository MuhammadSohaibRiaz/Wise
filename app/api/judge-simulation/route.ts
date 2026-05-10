import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Groq } from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { caseDescription, userArguments, role } = await req.json()

    if (!caseDescription && !userArguments) {
      return NextResponse.json({ error: "Please provide either a case description or arguments." }, { status: 400 })
    }

    const prompt = `
      You are an Honorable Judge of the High Court of Pakistan. 
      Your task is to provide a simulated judicial evaluation of a case presented to you.
      
      ROLE OF THE USER: ${role || "Party to the case"}
      
      CASE DESCRIPTION:
      ${caseDescription || "Not explicitly provided. Refer to the arguments for context."}
      
      USER'S ARGUMENTS/STANCE:
      ${userArguments || "No specific arguments provided."}
      
      INSTRUCTIONS:
      1. **VALIDATION**: First, determine if the input is related to a legal dispute, Pakistani law, or a judicial matter. 
         - If the input is unrelated to law (e.g., casual talk, general knowledge, non-legal requests), set "is_legal_case" to false.
         - If the input is related to law, set "is_legal_case" to true.
      2. Act as a strict but fair Pakistani judge. Use formal, judicial language (e.g., "The Court observes...", "In view of the supra...", "The petitioner contends...").
      3. Reference specific Pakistani laws where applicable (e.g., Pakistan Penal Code (PPC), Civil Procedure Code (CPC), Constitution of Pakistan, etc.).
      4. **STRICT GUARDRAIL**: Do NOT reference Indian laws (IPC, etc.).
      5. Provide a balanced evaluation:
         - Strengths of the case.
         - Weaknesses/Risks.
         - A "Simulated Ruling" or probable outcome.
         - Recommendations for the legal strategy.
      6. Include a clear disclaimer that this is an AI simulation and not a real court judgment.
      
      Return the response in a structured JSON format with these fields:
      - is_legal_case: Boolean, whether the input is a legal matter.
      - rejection_reason: String, only if is_legal_case is false (e.g., "This matter is not of a legal nature...").
      - judicial_opinion: A formal opening statement from the "Judge".
      - key_legal_points: An array of the most critical legal aspects identified.
      - strengths: Array of strong points in the user's favor.
      - weaknesses: Array of risks or weak points.
      - simulated_outcome: A summary of the likely court decision.
      - judge_recommendations: Strategic advice for the user.
      - disclaimer: The mandatory legal disclaimer.
    `

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")

    if (result.is_legal_case === false) {
      return NextResponse.json({ 
        success: false, 
        error: result.rejection_reason || "The AI Judge determined this input is not a legal matter suitable for simulation." 
      })
    }

    return NextResponse.json({
      success: true,
      simulation: result
    })
  } catch (error: any) {
    console.error("Judge Simulation API error:", error)
    return NextResponse.json({ error: error.message || "Simulation failed" }, { status: 500 })
  }
}
