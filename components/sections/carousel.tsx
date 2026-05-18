import { ArrowRight, Bot, CalendarCheck, FileSearch, ShieldCheck, Users } from "lucide-react"
import Link from "next/link"

const workflow = [
  {
    title: "Analyze the matter",
    description: "Upload a legal document and get a structured summary, risk signals, citations, and recommended next steps.",
    image: "/legal-documents-analysis.jpg",
    icon: FileSearch,
  },
  {
    title: "Choose the right lawyer",
    description: "Compare verified lawyers by specialization, rating, hourly rate, and match reason before booking.",
    image: "/lawyers-team-portrait.jpg",
    icon: Users,
  },
  {
    title: "Manage the case",
    description: "Book, pay, share documents, comment, track status, and use the Legal RAG Assistant from one workspace.",
    image: "/lawyer-meeting-courtroom-gavel.jpg",
    icon: CalendarCheck,
  },
]

export function ImageCarousel() {
  return (
    <section aria-label="WiseCase workflow" className="border-y bg-slate-50/70 py-16 dark:bg-slate-950/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">One connected legal workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              From first document to completed consultation.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              WiseCase brings AI document analysis, lawyer matching, booking, secure payments, shared case documents,
              and Pakistani legal RAG support into a single client-lawyer workspace.
            </p>
          </div>
          <Link
            href="/client/analysis"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Start with analysis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {workflow.map((item, index) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="overflow-hidden rounded-lg border bg-background shadow-sm">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={item.image}
                    alt=""
                    className="h-full w-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <div className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-md bg-background/90 shadow-sm backdrop-blur">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {index + 1}
                    </span>
                    WiseCase step
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              </article>
            )
          })}
        </div>

        <div className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm md:grid-cols-3">
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Role-protected workspaces</p>
              <p className="mt-1 text-sm text-muted-foreground">Client, lawyer, and admin paths are guarded by auth and role checks.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Bot className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Legal RAG Assistant</p>
              <p className="mt-1 text-sm text-muted-foreground">Ask about indexed Pakistani legal materials or WiseCase platform tasks.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <CalendarCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Lifecycle tracking</p>
              <p className="mt-1 text-sm text-muted-foreground">Appointments, payments, documents, and case status stay visible to both parties.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
