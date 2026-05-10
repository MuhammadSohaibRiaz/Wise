import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20 grid gap-8 md:gap-12">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
            AI-Powered Legal Platform
          </Badge>
          <h1 className="text-balance text-6xl md:text-7xl font-black tracking-tighter leading-[0.9] text-slate-900 dark:text-white">
            Legal Expertise, <br/><span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">Evolved</span> with AI.
          </h1>
          <p className="mt-8 text-xl text-muted-foreground text-pretty leading-relaxed max-w-2xl">
            WiseCase helps you find top-rated lawyers, analyze complex legal documents in seconds, and manage your cases with total transparency.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/match"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-8 py-4 text-base font-bold shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all active:scale-95 group"
            >
              Find Your Lawyer
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/client/analysis"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-background border-2 border-slate-200 dark:border-slate-800 px-8 py-4 text-base font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-95"
            >
              Analyze Case Document
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground border-t border-slate-100 dark:border-slate-800 pt-8">
            <div className="flex -space-x-2">
              {[1,2,3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                  {i === 1 ? 'JD' : i === 2 ? 'MS' : 'RK'}
                </div>
              ))}
            </div>
            <p>Trusted by <b>500+ clients</b> and legal professionals.</p>
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li className="rounded-lg border p-4">
            <h3 className="font-semibold">AI‑Powered Lawyer Suggestion</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Recommendations based on case information, document analysis, and lawyer specialization.
            </p>
          </li>
          <li className="rounded-lg border p-4">
            <h3 className="font-semibold">Automated Case Document Analysis</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload legal documents for OCR/NLP to extract legal terms, summarize content, and highlight risks.
            </p>
          </li>
          <li className="rounded-lg border p-4">
            <h3 className="font-semibold">Secure Payments</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Seamless and secure payment for consultations via a gateway such as Stripe.
            </p>
          </li>
        </ul>
      </div>
    </section>
  )
}
