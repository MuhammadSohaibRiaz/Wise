"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Loader2, Image as ImageIcon, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface CaseStudy {
    id: string
    title: string
    category: string
    outcome: string
    description: string | null
    image_url: string | null
    created_at: string
}

export function CaseStudies() {
    const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [open, setOpen] = useState(false)
    const { toast } = useToast()
    const supabase = createClient()

    const [formData, setFormData] = useState({
        title: "",
        category: "",
        outcome: "Won",
        description: "",
    })
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    const fetchCaseStudies = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user?.id) return

            const { data, error } = await supabase
                .from("case_studies")
                .select("*")
                .eq("lawyer_id", session.user.id)
                .order("created_at", { ascending: false })

            if (error) throw error
            setCaseStudies(data || [])
        } catch (error) {
            console.error("[CaseStudies] Error:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchCaseStudies()
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setIsSaving(true)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user?.id) return

            let uploadedImageUrl = null

            // Upload image if selected
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop()
                const fileName = `${session.user.id}-${Math.random()}.${fileExt}`
                const filePath = `thumbnails/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('case-studies')
                    .upload(filePath, imageFile)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('case-studies')
                    .getPublicUrl(filePath)
                
                uploadedImageUrl = publicUrl
            }

            const { error } = await supabase
                .from("case_studies")
                .insert({
                    lawyer_id: session.user.id,
                    title: formData.title,
                    category: formData.category,
                    outcome: formData.outcome,
                    description: formData.description,
                    image_url: uploadedImageUrl
                })

            if (error) throw error

            toast({
                title: "Success",
                description: "Case study added successfully",
            })
            setOpen(false)
            setFormData({ title: "", category: "", outcome: "Won", description: "" })
            setImageFile(null)
            setImagePreview(null)
            fetchCaseStudies()
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to save case study",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this case study?")) return
        try {
            const { error } = await supabase.from("case_studies").delete().eq("id", id)
            if (error) throw error
            setCaseStudies(caseStudies.filter(c => c.id !== id))
            toast({ title: "Deleted", description: "Case study removed" })
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Case Studies & Portfolio</h2>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add case study
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Add Case Study</DialogTitle>
                            <DialogDescription>
                                Showcase your successful cases to build trust with potential clients.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSave} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Case Title</Label>
                                <Input
                                    id="title"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Landmark Property Dispute Win"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Input
                                        id="category"
                                        required
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="e.g. Civil Law"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="outcome">Outcome</Label>
                                    <select
                                        id="outcome"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.outcome}
                                        onChange={e => setFormData({ ...formData, outcome: e.target.value })}
                                    >
                                        <option value="Won">Won</option>
                                        <option value="Settled">Settled</option>
                                        <option value="Ongoing">Ongoing</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Briefly describe the case and your role..."
                                    rows={4}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="image">Case Image / Thumbnail (Optional)</Label>
                                <div className="flex items-center gap-4">
                                    {imagePreview ? (
                                        <div className="relative h-20 w-32 rounded-lg overflow-hidden border">
                                            <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                            <button 
                                                type="button"
                                                onClick={() => { setImageFile(null); setImagePreview(null); }}
                                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="h-20 w-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        setImageFile(file)
                                                        setImagePreview(URL.createObjectURL(file))
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                    <p className="text-xs text-muted-foreground flex-1">
                                        Adding an image makes your portfolio stand out to clients.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Save Case Study
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {caseStudies.length === 0 ? (
                <Card className="p-12 text-center border-dashed">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="text-muted-foreground">You haven't added any case studies yet. Add your first success story!</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {caseStudies.map((study) => (
                        <Card key={study.id} className="overflow-hidden hover:shadow-lg transition-all group">
                            <div className="aspect-video bg-muted flex items-center justify-center relative">
                                {study.image_url ? (
                                    <img src={study.image_url} alt={study.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-muted-foreground/40 text-center p-4">
                                        <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                                        <p className="text-[10px] uppercase font-bold tracking-widest">{study.category}</p>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <Button 
                                        variant="destructive" 
                                        size="icon" 
                                        className="h-7 w-7" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(study.id);
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <Badge variant="secondary" className="text-[10px]">
                                        {study.category}
                                    </Badge>
                                    <Badge className={`text-[10px] ${
                                        study.outcome === 'Won' ? 'bg-green-500/10 text-green-700' : 
                                        study.outcome === 'Settled' ? 'bg-blue-500/10 text-blue-700' : 
                                        'bg-gray-500/10 text-gray-700'
                                    }`}>
                                        {study.outcome}
                                    </Badge>
                                </div>
                                <h3 className="font-semibold text-sm mb-2 line-clamp-1">{study.title}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-3 mb-4">
                                    {study.description || "No description provided."}
                                </p>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
