export function Features() {
  return (
    <section id="features" className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 grid gap-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-semibold text-balance">Key Features</h2>
          <p className="mt-2 text-muted-foreground">Derived from the proposal’s Success Criteria and Key Features.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <h3 className="font-semibold">Efficient Lawyer Search & Booking</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Search by specialization, area, and reviews; narrow results with advanced filtering; schedule with
              availability tracking.
            </p>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-semibold">AI‑Driven Lawyer Suggestion</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Intelligent matching through case information, legal document analysis, and user searches with ongoing
              improvement.
            </p>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-semibold">Automated Document Analysis</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              OCR and NLP for contracts, agreements, and case files: summaries, risk analysis, and extraction of legal
              terms.
            </p>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-semibold">Secure Payments</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Secure and easy payment for consultations via a gateway such as Stripe.
            </p>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-semibold">User Administration</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Profiles, authentication, registration, and lawyer profile verification.
            </p>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-semibold">Reviews & Ratings</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Clients can rate and review lawyers to support informed decision‑making.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
