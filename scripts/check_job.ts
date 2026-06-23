import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

const envPath = path.join(__dirname, "../.env.local")
const envContent = fs.readFileSync(envPath, "utf-8")
const env: Record<string, string> = {}
for (const line of envContent.split("\n")) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const idx = trimmed.indexOf("=")
  if (idx === -1) continue
  const key = trimmed.slice(0, idx).trim()
  const val = trimmed.slice(idx + 1).trim()
  env[key] = val
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl!, supabaseKey!)

async function checkJob() {
  const jobId = "3d9f6522-124d-45a4-92ad-da7ea18dd3fa"
  const { data: job, error } = await supabase
    .from("document_analysis_jobs")
    .select("*")
    .eq("id", jobId)
    .single()

  if (error || !job) {
    console.error("Job not found:", error)
    return
  }

  console.log("=== JOB DETAILS ===")
  console.log("Status:", job.status)
  console.log("Document ID:", job.document_id)
  console.log("Result Payload:", JSON.stringify(job.result_payload, null, 2))
}

checkJob()
