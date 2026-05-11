import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { matchLawyersWithCategory } from "@/lib/ai/lawyer-matching"
import { runDocumentAnalysis } from "@/lib/analysis/run-document-analysis"

export async function POST(req: NextRequest) {
  let failureDocumentId: string | null = null

  try {
    const body = await req.json()
    const documentId = body?.documentId as string | undefined
    const skipAnalysis = Boolean(body?.skipAnalysis)
    const asyncMode = Boolean(body?.async)

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }
    failureDocumentId = documentId

    const supabase = await createClient()

    if (skipAnalysis) {
      const { data: analysis } = await supabase
        .from("document_analysis")
        .select("*")
        .eq("document_id", documentId)
        .single()

      if (analysis) {
        const recommendedLawyers = await matchLawyersWithCategory(supabase, analysis.summary || "")
        return NextResponse.json({
          success: true,
          analysis,
          recommendedLawyers,
        })
      }
    }

    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let allowed = document.uploaded_by === user.id
    if (!allowed && document.case_id) {
      const { data: caseRow } = await supabase
        .from("cases")
        .select("client_id, lawyer_id")
        .eq("id", document.case_id)
        .single()

      allowed =
        caseRow?.client_id === user.id ||
        caseRow?.lawyer_id === user.id
    }
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (asyncMode) {
      const { data: job, error: jobErr } = await supabase
        .from("document_analysis_jobs")
        .insert({
          document_id: documentId,
          requested_by: user.id,
          status: "pending",
        })
        .select("id")
        .single()

      if (jobErr || !job?.id) {
        console.error("[analyze-document] job enqueue failed:", jobErr)
        return NextResponse.json(
          { error: jobErr?.message || "Could not queue analysis. Run scripts/045_document_analysis_jobs.sql if missing." },
          { status: 400 },
        )
      }

      return NextResponse.json({
        queued: true,
        jobId: job.id,
        async: true,
      })
    }

    const result = await runDocumentAnalysis(supabase, {
      documentId,
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      recommendedLawyers: result.recommendedLawyers,
      isLegalDocument: result.isLegalDocument,
      lowConfidence: result.lowConfidence,
      confidenceScore: result.confidenceScore,
      async: false,
    })
  } catch (error: unknown) {
    console.error("Analysis API error:", error)
    const message = error instanceof Error ? error.message : "Analysis failed"

    if (failureDocumentId) {
      try {
        const supabase = await createClient()
        await supabase.from("documents").update({ status: "failed" }).eq("id", failureDocumentId)
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
