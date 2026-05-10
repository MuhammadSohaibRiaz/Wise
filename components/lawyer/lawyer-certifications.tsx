"use client"

import { Badge, Award, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Certification {
  id: string
  title: string
  issuer: string
  issue_date?: string
  expiry_date?: string
  credential_id?: string
  credential_url?: string
}

interface LawyerCertificationsProps {
  certifications: Certification[]
}

export function LawyerCertifications({ certifications }: LawyerCertificationsProps) {
  if (!certifications || certifications.length === 0) {
    return null
  }

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Certifications</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certifications.map((cert) => (
          <div key={cert.id} className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <Award className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{cert.title}</h3>
                  <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                </div>
              </div>
              {isExpired(cert.expiry_date) && (
                <Badge variant="secondary" className="text-xs">
                  Expired
                </Badge>
              )}
            </div>

            {/* Dates */}
            <div className="flex gap-4 text-xs text-muted-foreground mb-3">
              {cert.issue_date && (
                <p>
                  Issued:{" "}
                  {new Date(cert.issue_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                  })}
                </p>
              )}
              {cert.expiry_date && (
                <p>
                  Expires:{" "}
                  {new Date(cert.expiry_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                  })}
                </p>
              )}
            </div>

            {/* Credential Link */}
            {cert.credential_url && (
              <a href={cert.credential_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full text-xs bg-transparent">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Credential
                </Button>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
