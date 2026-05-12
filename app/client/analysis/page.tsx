"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Upload, AlertTriangle, CheckCircle, Trash2, Loader2, FileText, Search, History } from "lucide-react"
import { UploadZone } from "@/components/documents/upload-zone"
import { AnalysisResultsView } from "@/components/documents/analysis-results-view"
import { LawyerCard } from "@/components/lawyer/lawyer-card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { normalizeLawyerAverageRating } from "@/lib/lawyer-rating"
import { generateRecommendationReason } from "@/lib/ai/lawyer-matching"

import { useSearchParams } from "next/navigation"

type QueuedAnalysisJob = {
  status: string
  error_message?: string | null
  result_payload?: {
    analysis?: Record<string, unknown>
    recommendedLawyers?: unknown[]
    isLegalDocument?: boolean
  } | null
}

async function pollAnalysisJob(jobId: string): Promise<QueuedAnalysisJob> {
  const maxAttempts = 150
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`/api/analyze-document/job/${jobId}`)
    const job = (await res.json()) as QueuedAnalysisJob & { error?: string }
    if (!res.ok) throw new Error(job.error || "Could not check analysis status")
    if (job.status === "completed" || job.status === "failed") return job
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error("Analysis is taking longer than expected. Check History or try again.")
}
import { Suspense } from "react"

function AICaseAnalysisContent() {
  const [isReady, setIsReady] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [recommendedLawyers, setRecommendedLawyers] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [activeTab, setActiveTab] = useState("analyze")
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const documentIdParam = searchParams.get("documentId")

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (documentIdParam) {
        loadExistingAnalysis(documentIdParam)
      }

      setIsReady(true)
    }
    init()
    fetchHistory()
  }, [documentIdParam])

  const loadExistingAnalysis = async (docId: string) => {
    try {
      setIsAnalyzing(true)
      const supabase = createClient()
      
      // Fetch both the analysis and the document metadata
      const [analysisRes, documentRes] = await Promise.all([
        supabase
          .from("document_analysis")
          .select("*")
          .eq("document_id", docId)
          .single(),
        supabase
          .from("documents")
          .select("file_url")
          .eq("id", docId)
          .single()
      ])
      
      const analysis = analysisRes.data
      const document = documentRes.data

      if (analysisRes.error || !analysis) throw new Error("Analysis not found")

      // Booking reads `case_drafts` + optional session fallback in `BookAppointmentModal`.

      // Normalize DB shape to the UI shape expected by `AnalysisResultsView`
      let normalizedRecommendations: any[] = []
      if (Array.isArray((analysis as any).recommendations)) {
        normalizedRecommendations = (analysis as any).recommendations
      } else if (typeof (analysis as any).recommendations === "string") {
        const raw = (analysis as any).recommendations
        try {
          const parsed = JSON.parse(raw)
          normalizedRecommendations = Array.isArray(parsed) ? parsed : [raw]
        } catch {
          normalizedRecommendations = raw ? [raw] : []
        }
      }

      setAnalysisResult({
        summary: (analysis as any).summary ?? "",
        key_terms: Array.isArray((analysis as any).key_terms) ? (analysis as any).key_terms : [],
        risk_assessment: (analysis as any).risk_assessment ?? "",
        risk_level: (analysis as any).risk_level ?? "Medium",
        urgency: (analysis as any).urgency ?? "Normal",
        seriousness: (analysis as any).seriousness ?? "Moderate",
        recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : ["Review the full analysis and consult a lawyer if needed."],
        category: (analysis as any).category ?? "General",
        is_legal_document: (analysis as any).is_legal_document,
        legal_citations: (analysis as any).legal_citations ?? [],
        disclaimer: (analysis as any).disclaimer ?? "",
        document_url: document?.file_url ?? "",
      })
      
      // Fetch matching lawyers based on the category stored in analysis (if any)
      // For now, we'll trigger the match logic or just fetch lawyers
      const res = await fetch("/api/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId, skipAnalysis: true }), // I'll need to update the API to handle this or just fetch matching lawyers here
      })
      
      const data = await res.json()
      if (data.recommendedLawyers) {
        setRecommendedLawyers(data.recommendedLawyers)
      }

    } catch (error: any) {
      toast({
        title: "Load Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const fetchHistory = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setIsLoadingHistory(true)
    const { data, error } = await supabase
      .from("documents")
      .select(`
        id,
        file_name,
        status,
        created_at,
        document_analysis (
          id,
          summary,
          risk_assessment,
          risk_level,
          urgency,
          seriousness,
          recommendations,
          category,
          analysis_status,
          legal_citations,
          disclaimer,
          is_legal_document
        )
      `)
      .eq("uploaded_by", user.id)
      .order("created_at", { ascending: false })

    if (data) {
      const legalOnly = data.filter((doc) => {
        const analysis = Array.isArray(doc.document_analysis) ? doc.document_analysis[0] : null
        if (!analysis) return true
        return analysis.is_legal_document !== false
      })
      setHistory(legalOnly)
    }
    setIsLoadingHistory(false)
  }

  const handleUploadComplete = async (documentId: string) => {
    try {
      setIsAnalyzing(true)
      toast({
        title: "File Uploaded",
        description: "Starting AI legal analysis...",
      })

      const response = await fetch("/api/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Analysis failed")

      const analysisPayload = (data.analysis || {}) as Record<string, unknown>
      const recommended = data.recommendedLawyers || []
      const isLegalDocument = data.isLegalDocument !== false

      if (isLegalDocument === false) {
        toast({
          title: "Not a legal document",
          description:
            "This file was classified as non-legal. Upload a contract, court order, notice, lease, or similar for full Pakistani-law analysis.",
          duration: 12_000,
        })
      }

      // Fetch document metadata to get the URL
      const supabase = createClient()
      const { data: document } = await supabase
        .from("documents")
        .select("file_url")
        .eq("id", documentId)
        .single()

      setAnalysisResult({
        ...analysisPayload,
        document_url: document?.file_url,
      })
      setRecommendedLawyers(recommended)
      
      toast({
        title: isLegalDocument === false ? "Upload recorded" : "Analysis Complete",
        description:
          isLegalDocument === false
            ? "See the summary below. Recommended lawyers stay empty until a legal document is analyzed."
            : "Your document has been successfully processed.",
      })
      
      fetchHistory()
    } catch (error: any) {
      console.error("Analysis Error Details:", error)
      toast({
        title: "Analysis Failed",
        description: error.message || "An unexpected error occurred while analyzing your document. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleDeleteDocument = async (documentId: string, fileName: string) => {
    if (!window.confirm(`Delete "${fileName}" and its analysis? This cannot be undone.`)) return

    try {
      const supabase = createClient()

      await supabase.from("document_analysis").delete().eq("document_id", documentId)
      await supabase.from("documents").delete().eq("id", documentId)

      setHistory((prev) => prev.filter((d: any) => d.id !== documentId))

      toast({ title: "Deleted", description: `"${fileName}" has been removed.` })
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message || "Could not delete document.", variant: "destructive" })
    }
  }

  return (
    <main className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">AI Case Analysis</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Upload legal documents for instant AI-powered insights and lawyer matching.
          </p>
        </div>
        <Badge variant="outline" className="w-fit h-fit px-3 py-1 bg-primary/5 text-primary border-primary/20">
          Powered by Llama-3 & Groq
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="analyze" className="gap-2">
            <Search className="h-4 w-4" /> Analyze New
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-8">
          {/* Analysis Section */}
          {!analysisResult && !isAnalyzing ? (
            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-2 overflow-hidden border-2 border-primary/10 shadow-xl shadow-primary/5">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-xl font-bold">New Analysis</CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  {isReady ? (
                    <UploadZone 
                      onUploadComplete={handleUploadComplete}
                      onUploadError={(msg) => toast({ title: "Upload Error", description: msg, variant: "destructive" })}
                    />
                  ) : (
                    <div className="flex items-center justify-center p-20">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-muted/30 border-none shadow-inner">
                <CardHeader>
                  <CardTitle className="text-lg">How it works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-balance">
                  <div className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold grow-0 shrink-0">1</div>
                    <p><b>Upload</b> a PDF or Image of your legal document.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold grow-0 shrink-0">2</div>
                    <p><b>AI Extraction</b> uses OCR to read the text and identify legal entities.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold grow-0 shrink-0">3</div>
                    <p><b>Results</b> show a summary, risk level, and urgency assessment.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold grow-0 shrink-0">4</div>
                    <p><b>Match</b> with specialized lawyers from our database.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : isAnalyzing ? (
            <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6 animate-pulse">
              <div className="relative">
                <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <FileText className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold">Analyzing Your Case</h3>
                <p className="text-muted-foreground max-w-sm">
                  Our AI is currently reading your document, identifying legal risks, and finding the best lawyer for you...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  Analysis Results
                </h2>
                <Button variant="outline" onClick={() => { setAnalysisResult(null); setRecommendedLawyers([]); }}>
                  Back to Upload
                </Button>
              </div>

              <AnalysisResultsView analysis={analysisResult} />

              <section className="space-y-6">
                <div className="flex flex-col space-y-2">
                  <h2 className="text-3xl font-bold">Recommended Lawyers</h2>
                  <p className="text-muted-foreground">Based on your document analysis, these lawyers are the best fit for your case.</p>
                </div>
                
                {recommendedLawyers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendedLawyers.map((lawyer) => (
                      <LawyerCard
                        key={lawyer.id}
                        id={lawyer.id}
                        name={lawyer.name}
                        avatar_url={lawyer.avatar_url}
                        bio={null}
                        specializations={lawyer.specializations}
                        average_rating={normalizeLawyerAverageRating(lawyer.rating)}
                        total_cases={0}
                        location={null}
                        hourly_rate={lawyer.hourly_rate}
                        response_time_hours={0}
                        verified={lawyer.verified}
                        availability_status="available"
                        recommendationReason={generateRecommendationReason({
                          specializations: lawyer.specializations ?? [],
                          rating: Number(lawyer.rating) || 0,
                          caseType: analysisResult?.category ?? null,
                          verified: lawyer.verified,
                        })}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center bg-muted/20 border-dashed">
                    <p className="text-muted-foreground text-lg">No direct specialization matches found. Searching for general litigation lawyers...</p>
                    <Button variant="link" className="mt-2" onClick={() => window.location.href = "/match"}>
                      Browse All Lawyers
                    </Button>
                  </Card>
                )}
              </section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              {isLoadingHistory ? (
                <div className="flex justify-center p-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-20 rounded-xl border border-dashed">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-muted-foreground mt-4 text-lg">No history found.</p>
                  <p className="text-sm text-muted-foreground">Start by uploading a document in the analyze tab.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {history.map((item) => {
                    const hasAnalysis = Array.isArray(item.document_analysis) && item.document_analysis.length > 0
                    const riskLevel = hasAnalysis ? item.document_analysis[0]?.risk_level : null

                    return (
                      <Card key={item.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => {
                          if (hasAnalysis) {
                            loadExistingAnalysis(item.id);
                            setActiveTab("analyze");
                          } else {
                            toast({ title: "Processing", description: "Analysis is still in progress for this document." })
                          }
                        }}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="bg-primary/10 p-2 rounded">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{item.file_name}</p>
                              <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {hasAnalysis && riskLevel && riskLevel !== "N/A" && (
                              <Badge variant="outline" className={cn(
                                riskLevel === "High" ? "bg-red-50 text-red-700 border-red-200" :
                                riskLevel === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-green-50 text-green-700 border-green-200"
                              )}>
                                {riskLevel} Risk
                              </Badge>
                            )}
                            {hasAnalysis && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" /> Analyzed
                              </Badge>
                            )}
                            {item.status === "failed" && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                Failed
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteDocument(item.id, item.file_name)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}

export default function AICaseAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-20 min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AICaseAnalysisContent />
    </Suspense>
  )
}
