import type { SupabaseClient } from "@supabase/supabase-js"

export type ProfileUpdateFields = {
  firstName?: string
  lastName?: string
  phone?: string
  bio?: string
  location?: string
  specializations?: string[]
  hourlyRate?: number
  consultationFee?: number
  yearsExperience?: number
  licenseNumber?: string
}

function hasAnyField(fields: ProfileUpdateFields): boolean {
  return Object.values(fields).some((v) => v != null && v !== "")
}

function parseNumeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number.parseInt(value.replace(/,/g, ""), 10)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/** Whole years only — ignore fractional months (8 years 2 months → 8). */
export function normalizeYearsExperience(value: unknown): number | undefined {
  const n = parseNumeric(value)
  if (n == null) return undefined
  return Math.max(0, Math.floor(n))
}

export function normalizeProfileUpdateFields(raw: Record<string, unknown>): ProfileUpdateFields {
  const fee =
    parseNumeric(raw.consultationFee) ??
    parseNumeric(raw.consultation_fee) ??
    parseNumeric(raw.hourlyRate) ??
    parseNumeric(raw.hourly_rate)

  return {
    firstName: typeof raw.firstName === "string" ? raw.firstName : typeof raw.first_name === "string" ? raw.first_name : undefined,
    lastName: typeof raw.lastName === "string" ? raw.lastName : typeof raw.last_name === "string" ? raw.last_name : undefined,
    phone: typeof raw.phone === "string" ? raw.phone.trim() : undefined,
    bio: typeof raw.bio === "string" ? raw.bio.trim() : undefined,
    location: typeof raw.location === "string" ? raw.location.trim() : undefined,
    specializations: Array.isArray(raw.specializations)
      ? raw.specializations.map(String)
      : undefined,
    consultationFee: fee,
    hourlyRate: fee,
    yearsExperience: normalizeYearsExperience(raw.yearsExperience ?? raw.years_experience),
    licenseNumber:
      typeof raw.licenseNumber === "string"
        ? raw.licenseNumber
        : typeof raw.license_number === "string"
          ? raw.license_number
          : undefined,
  }
}

/** Model sometimes prints `<function(updateProfile){...}</function>` instead of real tool calls. */
export function parsePseudoUpdateProfile(text: string): ProfileUpdateFields | null {
  const match = text.match(
    /<function\s*\(\s*updateProfile\s*\)\s*(\{[\s\S]*?\})\s*(?:<\/function>)?/i,
  )
  if (!match?.[1]) return null
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>
    const fields = normalizeProfileUpdateFields(parsed)
    return hasAnyField(fields) ? fields : null
  } catch {
    return null
  }
}

export function extractProfileUpdateFromMessage(text: string): ProfileUpdateFields | null {
  const pseudo = parsePseudoUpdateProfile(text)
  if (pseudo) return pseudo

  const fields: ProfileUpdateFields = {}

  const phoneMatch =
    text.match(/(?:contact\s*(?:number|no\.?)|phone)\s*[=:]?\s*(\+?\d[\d\s-]{9,16})/i) ??
    text.match(/(\+\d{10,15})/)
  if (phoneMatch?.[1]) {
    fields.phone = phoneMatch[1].replace(/\s/g, "")
  }

  const feeMatch = text.match(
    /(?:consultation\s*fee|consultationFee|hourly\s*rate|hourlyRate)\s*[=:]?\s*(\d[\d,]*)/i,
  )
  if (feeMatch?.[1]) {
    const fee = Number.parseInt(feeMatch[1].replace(/,/g, ""), 10)
    if (Number.isFinite(fee) && fee > 0) fields.consultationFee = fee
  }

  const yearsMatch = text.match(/(\d+)\s*(?:years?|yrs?)(?:\s*(?:and\s*)?\d+\s*months?)?/i)
  if (yearsMatch?.[1]) {
    fields.yearsExperience = Number.parseInt(yearsMatch[1], 10)
  }

  const bioMatch = text.match(/bio\s*(?:is|=)\s*(.+?)(?:\n|$)/i)
  if (bioMatch?.[1]) {
    fields.bio = bioMatch[1].trim().replace(/^["']|["']$/g, "")
  }

  return hasAnyField(fields) ? fields : null
}

export function looksLikeProfileUpdateIntent(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/<function\s*\(\s*updateProfile/i.test(t)) return true
  if (/update\s+(?:my\s+)?(?:profile|contact|phone|bio|fee|experience)/i.test(t)) return true
  const hasField =
    /(?:contact\s*(?:number|no\.?)|phone|bio|consultation\s*fee|consultationFee|hourly\s*rate|experience)/i.test(
      t,
    )
  const hasValue = /[=:+]|\+?\d/.test(t)
  return hasField && hasValue
}

export function summarizeAppliedFields(fields: ProfileUpdateFields): string {
  const parts: string[] = []
  if (fields.phone) parts.push(`phone ${fields.phone}`)
  const fee = fields.consultationFee ?? fields.hourlyRate
  if (fee) parts.push(`consultation fee PKR ${fee}`)
  if (fields.yearsExperience != null) parts.push(`${fields.yearsExperience} years experience`)
  if (fields.bio) parts.push("bio")
  if (fields.firstName) parts.push("first name")
  if (fields.lastName) parts.push("last name")
  if (fields.location) parts.push("location")
  if (fields.specializations?.length) parts.push("specializations")
  return parts.join(", ")
}

export async function applyProfileUpdate(
  supabase: SupabaseClient,
  userId: string,
  input: ProfileUpdateFields,
): Promise<{ success: boolean; message: string; error?: string }> {
  const profileUpdates: Record<string, unknown> = {}
  if (input.firstName) profileUpdates.first_name = input.firstName
  if (input.lastName) profileUpdates.last_name = input.lastName
  if (input.phone) profileUpdates.phone = input.phone
  if (input.bio) profileUpdates.bio = input.bio
  if (input.location) profileUpdates.location = input.location

  const consultationFee = input.hourlyRate ?? input.consultationFee
  const yearsExperience = normalizeYearsExperience(input.yearsExperience)

  const lawyerUpdates: Record<string, unknown> = {}
  if (input.specializations) lawyerUpdates.specializations = input.specializations
  if (consultationFee != null && consultationFee > 0) lawyerUpdates.hourly_rate = consultationFee
  if (yearsExperience != null) lawyerUpdates.years_of_experience = yearsExperience
  if (input.licenseNumber) lawyerUpdates.bar_license_number = input.licenseNumber

  if (Object.keys(profileUpdates).length === 0 && Object.keys(lawyerUpdates).length === 0) {
    return { success: false, message: "", error: "No valid profile fields provided for update." }
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from("profiles").update(profileUpdates).eq("id", userId)
    if (error) return { success: false, message: "", error: `Profile update failed: ${error.message}` }
  }

  if (Object.keys(lawyerUpdates).length > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .maybeSingle()

    if (profile?.user_type !== "lawyer") {
      return {
        success: false,
        message: "",
        error: "Consultation fee and experience can only be updated on lawyer accounts.",
      }
    }

    const { error } = await supabase.from("lawyer_profiles").update(lawyerUpdates).eq("id", userId)
    if (error) {
      return { success: false, message: "", error: `Lawyer profile update failed: ${error.message}` }
    }
  }

  return { success: true, message: "Profile updated successfully." }
}

export async function tryApplyProfileUpdateFromUserMessage(
  supabase: SupabaseClient,
  userId: string,
  userText: string,
): Promise<{ applied: boolean; contextLine: string }> {
  if (!looksLikeProfileUpdateIntent(userText)) {
    return { applied: false, contextLine: "" }
  }

  const fields = extractProfileUpdateFromMessage(userText)
  if (!fields) {
    return { applied: false, contextLine: "" }
  }

  const result = await applyProfileUpdate(supabase, userId, fields)
  const summary = summarizeAppliedFields(fields)

  if (result.success) {
    return {
      applied: true,
      contextLine:
        `[PROFILE_ALREADY_SAVED] ${result.message} Updated: ${summary}. ` +
        `Reply in 1–2 plain sentences confirming what was saved. ` +
        `Experience is stored in whole years only (months are ignored). ` +
        `Do NOT output <function>, JSON, or repeat the user's message. ` +
        `For lawyers use [ACTION:Edit Profile:/lawyer/profile] only — never /client/lawyer/ URLs for self-updates.`,
    }
  }

  return {
    applied: false,
    contextLine: `[PROFILE_UPDATE_FAILED] ${result.error}. Explain briefly and suggest opening profile settings.`,
  }
}
