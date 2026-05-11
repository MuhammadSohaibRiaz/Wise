import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Gavel, 
  Scale, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Loader2, 
  ArrowRight,
  ShieldAlert,
  FileText,
  FileSearch,
  User,
  History
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

interface JudgeSimulationViewProps {
  userRole: "client" | "lawyer"
}

export function JudgeSimulationView({ userRole }: JudgeSimulationViewProps) {
  const [caseDescription, setCaseDescription] = useState("")
  const [userArguments, setUserArguments] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  // New states for document selection
  const [inputMode, setInputMode] = useState<"manual" | "document">("manual")
  const [sourceRole, setSourceRole] = useState<string>(userRole)
  const [documents, setDocuments] = useState<any[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  useEffect(() => {
    if (inputMode === "document") {
      fetchDocuments()
    }
  }, [inputMode, sourceRole])

  const fetchDocuments = async () => {
    try {
      setIsLoadingDocs(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch documents and their analysis, joining with profiles to get user_type
      const { data, error } = await supabase
        .from("documents")
        .select(`
          id,
          file_name,
          uploaded_by,
          created_at,
          document_analysis (
            summary,
            category
          ),
          profiles:uploaded_by (
            user_type
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Filter documents that have analysis and match the selected sourceRole
      const analyzedDocs = data?.filter(doc => {
        const hasAnalysis = doc.document_analysis && (doc.document_analysis as any).length > 0;
        const profileRole = (doc.profiles as any)?.user_type || "client";
        return hasAnalysis && profileRole === sourceRole;
      }) || []
      
      setDocuments(analyzedDocs)
    } catch (error: any) {
      console.error("Error fetching documents:", error)
      toast({
        title: "Error fetching documents",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsLoadingDocs(false)
    }
  }

  const handleDocumentSelect = (docId: string) => {
    setSelectedDocId(docId)
    const doc = documents.find(d => d.id === docId)
    if (doc && doc.document_analysis && doc.document_analysis[0]) {
      setCaseDescription(doc.document_analysis[0].summary)
    }
  }

  const handleSimulate = async () => {
    if (!caseDescription.trim() && !userArguments.trim()) {
      toast({
        title: "Input Required",
        description: "Please provide a case description or at least one argument to simulate.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch("/api/judge-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseDescription,
          userArguments,
          role: userRole
        })
      })

      const data = await response.json()
      if (data.success) {
        setResult(data.simulation)
        toast({
          title: "Simulation Complete",
          description: "The AI Judge has rendered a simulated opinion."
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({
        title: "Simulation Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setCaseDescription("")
    setUserArguments("")
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {!result ? (
        <Card className="border-t-4 border-t-primary shadow-lg overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Scale size={160} />
          </div>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Gavel className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="text-xs uppercase tracking-wider">Experimental</Badge>
            </div>
            <CardTitle className="text-2xl">AI Judicial Perspective Simulator</CardTitle>
            <CardDescription>
              Present your case to explore how a judicial perspective might evaluate your arguments under Pakistani Law.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="gap-2">
                    <FileText className="h-4 w-4" /> Manual Entry
                  </TabsTrigger>
                  <TabsTrigger value="document" className="gap-2">
                    <FileSearch className="h-4 w-4" /> Analyzed Document
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {inputMode === "document" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <User className="h-3 w-3" /> Select Role
                    </Label>
                    <Select value={sourceRole} onValueChange={setSourceRole}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select Perspective" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client Documents</SelectItem>
                        <SelectItem value="lawyer">Lawyer Documents</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <History className="h-3 w-3" /> Select Document
                    </Label>
                    <Select value={selectedDocId} onValueChange={handleDocumentSelect} disabled={isLoadingDocs || documents.length === 0}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={isLoadingDocs ? "Loading..." : documents.length === 0 ? "No documents found" : "Choose a document"} />
                      </SelectTrigger>
                      <SelectContent>
                        {documents.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.file_name} ({new Date(doc.created_at).toLocaleDateString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Case Description
                </label>
                  <Textarea 
                    placeholder={inputMode === "document" ? "Select a document above to populate this description, or write manually..." : "Describe the facts of the case, the dispute, and the parties involved..."}
                    className="min-h-[150px] resize-none focus-visible:ring-primary shadow-sm"
                    value={caseDescription}
                    onChange={(e) => setCaseDescription(e.target.value)}
                  />
                  {inputMode === "document" && caseDescription && (
                    <p className="text-[10px] text-muted-foreground mt-1 italic">
                      Note: You can manually refine this description after selecting a document.
                    </p>
                  )}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                Your Arguments (Optional)
              </label>
              <Textarea 
                placeholder="List your key arguments or the legal stance you wish to take..."
                className="min-h-[100px] resize-none focus-visible:ring-primary shadow-sm"
                value={userArguments}
                onChange={(e) => setUserArguments(e.target.value)}
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/20 flex gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                The AI Judge will evaluate your case using established Pakistani legal principles. 
                <span className="font-semibold text-primary"> Note: This tool is strictly for legal simulations. Non-legal or casual inputs will be rejected by the Judge.</span>
              </p>
            </div>

            <Button 
              onClick={handleSimulate} 
              disabled={isLoading}
              className="w-full h-12 text-lg font-semibold shadow-md transition-all hover:translate-y-[-2px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Deliberating...
                </>
              ) : (
                <>
                  <Gavel className="mr-2 h-5 w-5" />
                  Initiate Simulation
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              Simulated Judicial Opinion
            </h2>
            <Button variant="outline" onClick={reset} size="sm">
              New Simulation
            </Button>
          </div>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="mt-1">
                  <Gavel className="h-6 w-6 text-primary opacity-50" />
                </div>
                <p className="italic text-lg text-foreground/90 leading-relaxed font-serif">
                  "{result.judicial_opinion}"
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.strengths.map((point: string, i: number) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  Risks & Weaknesses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.weaknesses.map((point: string, i: number) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-muted shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Likely Judicial Outcome</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 leading-relaxed">
                {result.simulated_outcome}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Strategic Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.judge_recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-foreground/90">{rec}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="p-4 rounded-lg bg-muted border border-dashed text-[10px] text-muted-foreground flex gap-3">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            <p>{result.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  )
}
