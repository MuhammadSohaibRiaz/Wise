const LAWYER_GATE_SESSION_KEY = "wisecase-lawyer-license-gate"

export type LawyerLicenseGate = "approved" | "pending" | "rejected" | "unverified"

export function cacheLawyerLicenseGate(gate: LawyerLicenseGate) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(LAWYER_GATE_SESSION_KEY, gate)
  } catch {
    /* ignore quota / private mode */
  }
}

export function readCachedLawyerLicenseGate(): LawyerLicenseGate | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(LAWYER_GATE_SESSION_KEY)
    if (
      raw === "approved" ||
      raw === "pending" ||
      raw === "rejected" ||
      raw === "unverified"
    ) {
      return raw
    }
  } catch {
    /* ignore */
  }
  return null
}

export function clearCachedLawyerLicenseGate() {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(LAWYER_GATE_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function resolveLawyerLicenseGate(profile: {
  verified?: boolean | null
  verification_status?: string | null
  license_file_url?: string | null
} | null): LawyerLicenseGate {
  if (!profile) return "unverified"
  if (profile.verification_status === "rejected") return "rejected"
  if (profile.verified === true || profile.verification_status === "approved") return "approved"
  if (profile.license_file_url) return "pending"
  return "unverified"
}

export function lawyerSignInToast(gate: LawyerLicenseGate): {
  variant: "success" | "default"
  title: string
  description: string
} {
  switch (gate) {
    case "approved":
      return {
        variant: "success",
        title: "Sign in successful",
        description: "Redirecting to your dashboard…",
      }
    case "pending":
      return {
        variant: "default",
        title: "Signed in — license under review",
        description:
          "Your credentials are correct. Full dashboard access will unlock after an admin approves your bar license (usually 24–48 hours).",
      }
    case "rejected":
      return {
        variant: "default",
        title: "Signed in — license not approved",
        description:
          "Your submitted license was rejected. Re-upload a valid document on the next screen to request review again.",
      }
    case "unverified":
      return {
        variant: "default",
        title: "Signed in — verification required",
        description:
          "Upload your bar license document on the next screen before you can use the lawyer dashboard.",
      }
  }
}
