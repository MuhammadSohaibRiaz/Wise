import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Groq } from "groq-sdk"
const pdf = require("pdf-parse-fork")
import { matchLawyersWithCategory } from "@/lib/ai/lawyer-matching"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SPECIALIZATIONS = [
  "Family Law",
  "Criminal Law",
  "Corporate Law",
  "Civil Law",
  "Intellectual Property",
  "Tax Law",
  "Real Estate Law",
  "Labor Law",
  "Immigration Law",
  "Bankruptcy Law",
]

export async function POST(req: NextRequest) {
  try {
    const { documentId, skipAnalysis } = await req.json()
    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    if (skipAnalysis) {
      const { data: analysis } = await supabase
        .from("document_analysis")
        .select("*")
        .eq("document_id", documentId)
        .single()
      
      if (analysis) {
        // Extract category if not present in separate field, or just match
        const recommendedLawyers = await matchLawyersWithCategory(supabase, analysis.summary || "") // Simple fallback
        return NextResponse.json({
          success: true,
          analysis,
          recommendedLawyers
        })
      }
    }

    // 1. Fetch document metadata
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // 2. Update status to analyzing
    await supabase
      .from("documents")
      .update({ status: "analyzing" })
      .eq("id", documentId)

    // 3. Extract text from document
    let extractedText = ""
    const response = await fetch(document.file_url)
    const fileBuffer = Buffer.from(await response.arrayBuffer())

    if (document.file_type === "application/pdf") {
      try {
        const data = await pdf(fileBuffer)
        extractedText = data.text
      } catch (e) {
        console.error("PDF parse failed, trying OCR:", e)
        // Fallback or handle error
      }
    }

    // If text extraction failed or it's an image, we will use Groq Vision directly
    let isImageMode = false
    let dataUrl = ""
    const isImage = document.file_type?.startsWith("image/") || document.file_name?.toLowerCase().endsWith(".jgp")
    
    if (!extractedText && isImage) {
      isImageMode = true
      const mimeType = document.file_type || (document.file_name?.toLowerCase().endsWith(".jgp") ? "image/jpeg" : "image/jpeg")
      const base64Image = fileBuffer.toString("base64")
      dataUrl = `data:${mimeType};base64,${base64Image}`
      extractedText = "[Image Document - Analyzed directly via Vision AI]"
    } else if (!extractedText && (document.file_type?.includes("word") || document.file_type?.includes("officedocument") || document.file_name?.toLowerCase().endsWith(".doc") || document.file_name?.toLowerCase().endsWith(".docx"))) {
      // For Word files, without a parser like mammoth, we notify the AI to explain the limitation or use what it can see (which is nothing yet)
      extractedText = "[Word Document - Raw text extraction unavailable. AI will attempt to provide general guidance based on metadata if possible.]"
      // Note: Full Word support requires installing 'mammoth'
    }

    // 4. Perform Groq Analysis with Pakistani Law focus and Guardrails
    const prompt = `
      You are an expert legal assistant specialized in the Law of Pakistan. 
      First, determine if the following document is a legal document (e.g., a contract, court order, lease, statute, legal notice, etc.).
      
      GUARDRAILS:
      - **LEGAL VALIDATION**: If the document is NOT a legal document (e.g., a random presentation, recipe, general article, casual letter, or non-legal PPT), you MUST set "is_legal_document": false.
      - Limit your analysis strictly to Pakistani Law (e.g., PPC, CPC, etc.).
      - **STRICT PROHIBITION**: Do not reference Indian laws (IPC, CrPC of India) or any other foreign jurisdictions. These are incorrect for this platform.
      - **NO HALLUCINATIONS**: Do not invent Acts or Sections. If you are not 100% certain of the specific Pakistani statute or section, do not include it. It is better to provide fewer, accurate citations than many incorrect ones.
      - Provide a preliminary analysis only. Include a disclaimer that this is not definitive legal advice and the client must consult a licensed Pakistani advocate.
      - Maintain a professional, neutral, and objective tone.
      
      The analysis must be returned in JSON format with these exact fields:
      - is_legal_document: boolean (true if it's a legal document, false otherwise)
      - summary: A clear 2-3 sentence overview of the document. (If not legal, say: "This is not a legal document and cannot be analyzed.")
      - key_terms: An array of important legal terms found. (Empty if not legal)
      - risk_assessment: A high-level assessment of potential risks. (Empty if not legal)
      - risk_level: One of 'Low', 'Medium', 'High'.
      - urgency: One of 'Normal', 'Urgent', 'Immediate'.
      - seriousness: One of 'Low', 'Moderate', 'Critical'.
      - recommendations: 2-3 actionable next steps for the client. (If not legal, suggest uploading a legal document)
      - category: The most SPECIFIC legal specialization from this list: [${SPECIALIZATIONS.join(", ")}].
      - legal_citations: An array of specific Sections, Acts, or Articles from Pakistani Law relevant to this document (e.g., "Section 420 of Pakistan Penal Code").
      - disclaimer: A brief mandatory disclaimer about the preliminary nature of this analysis under Pakistani law.
      
      Document text:
      ${isImageMode ? "Please analyze the attached image document directly." : extractedText.substring(0, 6000)}
      
      Return ONLY the JSON object.
    `

    let completion
    if (isImageMode) {
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0,
      })
    } else {
      completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: { type: "json_object" },
      })
    }
    
    const responseText = completion.choices[0].message.content || "{}"
    // Clean up potential markdown formatting
    const cleanedText = responseText.replace(/```json\n?|```\n?/g, '').trim()
    const result = JSON.parse(cleanedText)

    console.log("[Analysis] AI Raw Result:", result)

    const isLegalDoc = result.is_legal_document !== false

    // Robust validation for array fields to prevent DB errors
    const keyTerms = Array.isArray(result.key_terms) ? result.key_terms : []
    const legalCitations = Array.isArray(result.legal_citations) ? result.legal_citations : []
    const recommendationsArr = Array.isArray(result.recommendations) ? result.recommendations : (result.recommendations ? [result.recommendations] : [])
    const recommendationsStr = isLegalDoc
      ? JSON.stringify(recommendationsArr)
      : JSON.stringify(["Upload a court order, contract, notice, or other legal document for a full Pakistani-law analysis."])

    // 5. Store Analysis Results
    const analysisData: any = {
      document_id: documentId,
      summary: result.summary || "No summary provided",
      key_terms: isLegalDoc ? keyTerms : [],
      risk_assessment: isLegalDoc ? result.risk_assessment || "No assessment" : "Not applicable — non-legal document.",
      recommendations: recommendationsStr,
      extracted_text: extractedText.substring(0, 2000), // Limit storage
      analysis_status: "completed",
      legal_citations: isLegalDoc ? legalCitations : [],
      disclaimer: isLegalDoc
        ? result.disclaimer || ""
        : "This upload was classified as non-legal. It is not a substitute for legal advice.",
      risk_level: isLegalDoc ? result.risk_level || "Medium" : "N/A",
      urgency: isLegalDoc ? result.urgency || "Normal" : "N/A",
      seriousness: isLegalDoc ? result.seriousness || "Moderate" : "N/A",
      category: isLegalDoc ? result.category || "General" : "Non-Legal",
    }

    // Try adding is_legal_document, but catch error if column doesn't exist
    const { error: analysisError } = await supabase
      .from("document_analysis")
      .insert({
        ...analysisData,
        is_legal_document: isLegalDoc,
      })

    if (analysisError) {
      console.warn("[Analysis] Primary insert failed, trying fallback:", analysisError.message)
      // Fallback insert without the new column
      const { error: fallbackError } = await supabase
        .from("document_analysis")
        .insert(analysisData)
      
      if (fallbackError) {
        console.error("[Analysis] Database Insert Error:", fallbackError)
        throw new Error(`Database error: ${fallbackError.message}`)
      }
    }

    // 6. Final Status Update
    await supabase
      .from("documents")
      .update({ status: "completed" })
      .eq("id", documentId)

    // 7. Notify User
    if (isLegalDoc) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { notifyAnalysisComplete } = await import("@/lib/notifications")
          await notifyAnalysisComplete(supabase, {
            userId: user.id,
            documentId,
            documentName: document.name,
            riskLevel: result.risk_level || "Normal"
          })
        }
      } catch (notifyError) {
        console.warn("Failed to send analysis notification:", notifyError)
      }
    }

    // 8. Get Recommended Lawyers
    const recommendedLawyers = isLegalDoc
      ? await matchLawyersWithCategory(supabase, result.category || "")
      : []

    return NextResponse.json({
      success: true,
      analysis: { ...result, is_legal_document: isLegalDoc },
      recommendedLawyers,
      isLegalDocument: isLegalDoc,
    })

  } catch (error: any) {
    console.error("Analysis API error:", error)
    
    // Update status to failed
    const supabase = await createClient()
    const { documentId } = await req.json().catch(() => ({}))
    if (documentId) {
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", documentId)
    }

    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 })
  }
}
