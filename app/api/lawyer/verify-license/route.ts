import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Groq } from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req: NextRequest) {
  console.log("[Verify License] API Hit")
  try {
    const formData = await req.formData()
    const licenseNumber = formData.get("licenseNumber") as string
    const userId = formData.get("userId") as string
    const licenseUrl = formData.get("licenseUrl") as string
    const file = formData.get("file") as File | null
    
    if (!licenseNumber || (!licenseUrl && !file)) {
      return NextResponse.json({ error: "License number and either a file or URL are required" }, { status: 400 })
    }

    let dataUrl = ""

    if (file) {
      console.log("[Verify License] Processing uploaded file:", file.name)
      const buffer = Buffer.from(await file.arrayBuffer())
      const b64 = buffer.toString("base64")
      dataUrl = `data:${file.type || "image/jpeg"};base64,${b64}`
    } else if (licenseUrl) {
      console.log("[Verify License] Fetching from URL:", licenseUrl)
      const res = await fetch(licenseUrl)
      const buffer = Buffer.from(await res.arrayBuffer())
      dataUrl = `data:${res.headers.get("content-type") || "image/jpeg"};base64,${buffer.toString("base64")}`
    }

    console.log("[Verify License] Sending to Groq Vision...")
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
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0,
    })

    const responseText = completion.choices[0].message.content || "{}"
    const cleanedText = responseText.replace(/```json\n?|```\n?/g, '').trim()
    const result = JSON.parse(cleanedText)

    // Update database if userId is provided
    if (userId) {
      const supabase = await createClient()
      await supabase
        .from("lawyer_profiles")
        .update({
          ai_license_match: result.match === true,
          ai_extracted_license: result.extractedLicense || "Not found"
        })
        .eq("id", userId)
    }

    return NextResponse.json({
      success: true,
      match: result.match === true,
      extractedLicense: result.extractedLicense || "Not found"
    })

  } catch (error: any) {
    console.error("[Verify License] API Error:", error)
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 })
  }
}
