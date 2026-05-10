"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Search, Loader2, Star } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { matchLawyersWithCategory } from "@/lib/ai/lawyer-matching"
import { LAW_SPECIALIZATIONS } from "@/lib/specializations"
import { Badge } from "@/components/ui/badge"
import { formatLawyerRatingLabel, normalizeLawyerAverageRating } from "@/lib/lawyer-rating"

export default function AIRecommendationsPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        caseType: "",
        caseDescription: "",
        budget: "",
        location: "",
        urgency: ""
    })
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<Awaited<ReturnType<typeof matchLawyersWithCategory>>>([])
    const [searched, setSearched] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setSearched(false)
        setResults([])
        try {
            const supabase = createClient()
            const hint = [
                formData.caseType,
                formData.caseDescription,
                formData.location ? `Location preference: ${formData.location}` : "",
                formData.urgency ? `Urgency: ${formData.urgency}` : "",
            ]
                .filter(Boolean)
                .join("\n")

            const matched = await matchLawyersWithCategory(supabase, hint)
            setResults(matched.slice(0, 12))
            setSearched(true)
        } finally {
            setLoading(false)
        }
    }

    const openMatchWithFilters = () => {
        const params = new URLSearchParams()
        if (formData.caseType.trim()) params.set("specialization", formData.caseType.trim())
        if (formData.location.trim()) params.set("location", formData.location.trim())
        const budgetDigits = formData.budget.replace(/[^\d]/g, "")
        if (budgetDigits) params.set("maxRate", budgetDigits)
        router.push(`/match?${params.toString()}`)
    }

    return (
        <main className="min-h-screen bg-background py-8 px-4">
            <div className="mx-auto max-w-4xl">
                <div className="mb-8 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Sparkles className="h-8 w-8 text-primary" />
                        <h1 className="text-3xl md:text-4xl font-bold">AI Lawyer Recommendations</h1>
                    </div>
                    <p className="text-lg text-muted-foreground">
                        Tell us about your case and we&apos;ll find the best lawyers for you
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Case Details</CardTitle>
                        <CardDescription>
                            Provide information about your legal needs to get personalized lawyer recommendations
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="caseType">Case Type *</Label>
                                <Select
                                    value={formData.caseType}
                                    onValueChange={(value) => setFormData({ ...formData, caseType: value })}
                                    required
                                >
                                    <SelectTrigger id="caseType">
                                        <SelectValue placeholder="Select case type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LAW_SPECIALIZATIONS.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="General Litigation">General Litigation</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="caseDescription">Case Description *</Label>
                                <textarea
                                    id="caseDescription"
                                    placeholder="Describe your legal situation in detail..."
                                    value={formData.caseDescription}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                        setFormData({ ...formData, caseDescription: e.target.value })
                                    }
                                    required
                                    rows={6}
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="budget">Budget Range ($)</Label>
                                    <Input
                                        id="budget"
                                        type="text"
                                        placeholder="e.g., 50,000 - 100,000"
                                        value={formData.budget}
                                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="location">Preferred Location</Label>
                                    <Input
                                        id="location"
                                        type="text"
                                        placeholder="e.g., Karachi, Lahore, Online"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="urgency">Urgency Level</Label>
                                <Select
                                    value={formData.urgency}
                                    onValueChange={(value) => setFormData({ ...formData, urgency: value })}
                                >
                                    <SelectTrigger id="urgency">
                                        <SelectValue placeholder="Select urgency level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low - Can wait a few weeks</SelectItem>
                                        <SelectItem value="medium">Medium - Need within a week</SelectItem>
                                        <SelectItem value="high">High - Urgent, need ASAP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    Find Matching Lawyers
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => openMatchWithFilters()}>
                                    Open Match page with same filters
                                </Button>
                                <Button type="button" variant="outline" asChild>
                                    <Link href="/client/dashboard">Cancel</Link>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {searched && (
                    <section className="mt-10 space-y-4">
                        <h2 className="text-xl font-semibold">Matches</h2>
                        {results.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="py-10 text-center text-muted-foreground">
                                    <p className="font-medium text-foreground mb-1">No lawyers matched your case yet</p>
                                    <p className="text-sm max-w-md mx-auto">
                                        Try a different case type or add more detail to your description so we can align
                                        with lawyer specializations.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {results.map((lawyer) => {
                                    const matchPct = Math.min(99, Math.round(Number(lawyer.match_score) || 0))
                                    const spec =
                                        Array.isArray(lawyer.specializations) && lawyer.specializations.length > 0
                                            ? lawyer.specializations.slice(0, 2).join(", ")
                                            : "Practice areas"
                                    return (
                                        <Card key={lawyer.id}>
                                            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                                                <div>
                                                    <CardTitle className="text-lg">{lawyer.name}</CardTitle>
                                                    <CardDescription>{spec}</CardDescription>
                                                </div>
                                                <Badge variant="secondary">{matchPct}%</Badge>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="flex justify-between text-sm text-muted-foreground">
                                                    <span>{lawyer.location || "—"}</span>
                                                    <span className="flex items-center gap-1">
                                                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                                        {normalizeLawyerAverageRating(lawyer.rating) > 0
                                                            ? `${formatLawyerRatingLabel(normalizeLawyerAverageRating(lawyer.rating))}/5`
                                                            : "New"}
                                                    </span>
                                                </div>
                                                <Button asChild className="w-full">
                                                    <Link href={`/client/lawyer/${lawyer.id}`}>View lawyer</Link>
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        )}
                    </section>
                )}

                <div className="mt-8 p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm text-muted-foreground">
                        <strong>Tip:</strong> The more details you provide, the better we can match you with the right lawyer.
                        Our AI analyzes your case description and finds lawyers with relevant experience and expertise.
                    </p>
                </div>
            </div>
        </main>
    )
}
