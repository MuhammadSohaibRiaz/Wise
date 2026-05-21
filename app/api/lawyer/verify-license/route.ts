import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Groq } from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

function isAllowedLicenseUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null
    if (supabaseHost && parsed.host === supabaseHost) {
      return parsed.pathname.includes("/verifications/") || parsed.pathname.includes("/storage/")
    }
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.user_type !== "lawyer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contentType = req.headers.get("content-type") || ""
    let licenseNumber = ""
    let licenseUrl = ""
    let file: File | null = null

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}))
      licenseNumber = String(body.licenseNumber || "").trim()
      licenseUrl = String(body.licenseUrl || "").trim()
    } else {
      const formData = await req.formData()
      licenseNumber = String(formData.get("licenseNumber") || "").trim()
      licenseUrl = String(formData.get("licenseUrl") || "").trim()
      const rawFile = formData.get("file")
      file = rawFile instanceof File ? rawFile : null
    }

    if (!licenseNumber || (!licenseUrl && !file)) {
      return NextResponse.json(
        { error: "License number and either a file or URL are required" },
        { status: 400 },
      )
    }

    let dataUrl = ""

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      dataUrl = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`
    } else if (licenseUrl) {
      if (!isAllowedLicenseUrl(licenseUrl)) {
        return NextResponse.json({ error: "Invalid license document URL" }, { status: 400 })
      }
      const res = await fetch(licenseUrl)
      if (!res.ok) {
        return NextResponse.json({ error: "Could not fetch license document" }, { status: 400 })
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      dataUrl = `data:${res.headers.get("content-type") || "image/jpeg"};base64,${buffer.toString("base64")}`
    }

    const prompt = `
      You are an AI tasked with extracting a Bar License Number from a scan or photo of a lawyer's license document.
      The user claims their license number is: "${licenseNumber}".
      
      Your task:
      1. Find the license number in the image. Look for numbers near "License", "Enrollment", "No", "Reg", etc.
      2. Check if the number you find matches the claimed number (ignoring case, spaces, and special characters).
      3. Return ONLY a valid JSON object with no markdown formatting. It must have exactly these two fields:
         - "extractedLicense": string (the exact license number you found in the image, or "Not found" if none)
         - "match": boolean (true if it matches the claimed number, false otherwise)
    `

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0,
    })

    const responseText = completion.choices[0].message.content || "{}"
    const cleanedText = responseText.replace(/```json\n?|```\n?/g, "").trim()
    let result: { extractedLicense?: string; match?: boolean }
    try {
      result = JSON.parse(cleanedText)
    } catch {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 502 })
    }

    await supabase
      .from("lawyer_profiles")
      .update({
        ai_license_match: result.match === true,
        ai_extracted_license: result.extractedLicense || "Not found",
      })
      .eq("id", user.id)

    return NextResponse.json({
      success: true,
      match: result.match === true,
      extractedLicense: result.extractedLicense || "Not found",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed"
    console.error("[Verify License] API Error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
