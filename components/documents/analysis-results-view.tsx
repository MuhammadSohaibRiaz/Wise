"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Info, ArrowRight, ShieldAlert, Zap, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CaseStrengthMeter } from "./case-strength-meter"

interface AnalysisResultsViewProps {
  analysis: {
    summary: string
    key_terms: string[]
    risk_assessment: string
    risk_level: 'Low' | 'Medium' | 'High'
    urgency: 'Normal' | 'Urgent' | 'Immediate'
    seriousness: 'Low' | 'Moderate' | 'Critical'
    recommendations: string[]
    category: string
    is_legal_document?: boolean
    legal_citations?: string[]
    disclaimer?: string
    document_url?: string
  }
}

export function AnalysisResultsView({ analysis }: AnalysisResultsViewProps) {
  const isLegal = analysis.is_legal_document !== false

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'text-destructive bg-destructive/10 border-destructive/20'
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'Immediate': return <Zap className="h-4 w-4" />
      case 'Urgent': return <AlertTriangle className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isLegal && (
        <Card className="border-2 border-primary/20">
          <CardContent className="flex flex-col sm:flex-row items-center gap-6 p-6">
            <CaseStrengthMeter
              riskLevel={analysis.risk_level || "Medium"}
              urgency={analysis.urgency || "Normal"}
              seriousness={analysis.seriousness || "Moderate"}
            />
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-semibold">Case Strength Analysis</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Calculated from risk level, urgency, and seriousness of your document. A higher score indicates a stronger legal position.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Risk Level Card - Only show if legal */}
        {isLegal && (
          <Card className={cn("border-l-4", 
            analysis.risk_level === 'High' ? "border-l-destructive" : 
            analysis.risk_level === 'Medium' ? "border-l-yellow-500" : "border-l-green-500"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{analysis.risk_level || 'Medium'}</span>
                <Badge variant="outline" className={getRiskColor(analysis.risk_level || 'Medium')}>
                  {analysis.risk_level || 'Medium'} Risk
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{analysis.risk_assessment || 'No risk assessment provided.'}</p>
            </CardContent>
          </Card>
        )}

        {/* Urgency Card - Only show if legal */}
        {isLegal && (
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Required Urgency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{analysis.urgency}</span>
                <Badge variant="secondary" className="gap-1">
                  {getUrgencyIcon(analysis.urgency)}
                  {analysis.urgency}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Card */}
        <Card className={cn("border-l-4 border-l-blue-500", !isLegal && "md:col-span-2 lg:col-span-3", isLegal && "md:col-span-2 lg:col-span-1")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Document Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold truncate mr-2">{isLegal ? analysis.category : "Non-Legal Document"}</span>
              <Badge className={cn("shrink-0 border-none", isLegal ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-gray-100 text-gray-700")}>
                {isLegal ? "LITIGATION" : "GENERAL"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Analysis */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Case Summary</CardTitle>
              {analysis.document_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={analysis.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    View Original Document
                  </a>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-foreground/90">
                {analysis.summary || 'No summary available for this document.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Legal Terms Identified</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {analysis.key_terms.map((term, i) => (
                  <Badge key={i} variant="outline" className="px-3 py-1 bg-muted/30">
                    {term}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {analysis.legal_citations && analysis.legal_citations.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Relevant Pakistani Law
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-sm text-foreground/80">
                  {analysis.legal_citations.map((cite, i) => (
                    <li key={i}>{cite}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recommendations */}
        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="mt-1 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-muted-foreground leading-snug">{rec}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {analysis.disclaimer && (
        <div className="p-4 rounded-lg bg-muted border border-dashed text-xs text-muted-foreground flex gap-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{analysis.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
