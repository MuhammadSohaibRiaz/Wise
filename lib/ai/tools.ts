import { createClient } from "@/lib/supabase/server";
import { tool } from "ai";
import { z } from "zod";
import { searchLawyersFromSupabase } from "@/lib/lawyer-search";
import {
  applyProfileUpdate,
  normalizeYearsExperience,
} from "@/lib/ai/profile-update-from-message";

export const tools = {
  getProfileStatus: tool({
    description: 'Checks the current status of the logged-in user profile to see what information is missing.',
    inputSchema: z.object({}).passthrough(),
    execute: async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return { error: "User not logged in." };

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) return { error: "Profile not found." };

      const missingFields = [];
      if (!profile.first_name) missingFields.push('First Name');
      if (!profile.last_name) missingFields.push('Last Name');
      if (!profile.phone) missingFields.push('Phone Number');
      if (!profile.bio) missingFields.push('Bio');
      if (profile.user_type === 'client' && !profile.avatar_url) {
        missingFields.push('Profile photo');
      }

      if (profile.user_type === 'lawyer') {
        const { data: lawyerProfile } = await supabase
          .from('lawyer_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (lawyerProfile) {
          if (!lawyerProfile.specializations || lawyerProfile.specializations.length === 0) missingFields.push('Specializations');
          if (!lawyerProfile.hourly_rate) missingFields.push('Consultation Fee');
          if (!lawyerProfile.years_of_experience) missingFields.push('Years of Experience');
          if (!lawyerProfile.bar_license_number) missingFields.push('Bar License Number');
        } else {
          missingFields.push('Detailed Lawyer Profile');
        }
      }

      return {
        user_type: profile.user_type,
        missingFields,
        isComplete: missingFields.length === 0
      };
    },
  }),

  updateProfile: tool({
    description:
      "Updates the logged-in user profile. Call this when the user gives concrete values (phone, bio, consultation fee, years of experience, name, etc.). Do not print JSON or <function> tags in the reply.",
    inputSchema: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      bio: z.string().optional(),
      location: z.string().optional(),
      // Lawyer specific
      specializations: z.array(z.string()).optional(),
      hourlyRate: z.number().optional().describe("Consultation fee in PKR for a 60-minute session"),
      consultationFee: z.number().optional().describe("Alias for hourlyRate (PKR)"),
      yearsExperience: z.number().optional().describe("Whole years of experience"),
      licenseNumber: z.string().optional(),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Not logged in." };

      const result = await applyProfileUpdate(supabase, user.id, {
        ...input,
        yearsExperience: normalizeYearsExperience(input.yearsExperience),
      });
      if (!result.success) return { error: result.error || "Update failed." };
      return { success: true, message: result.message };
    },
  }),

  getMyDataSummary: tool({
    description: "Fetches a summary of the user's recent cases, upcoming appointments, and notifications. Use this to answer 'What's on my agenda?' or 'Show my recent activity'.",
    inputSchema: z.object({}).passthrough(),
    execute: async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Not logged in." };

      const [cases, appointments] = await Promise.all([
        supabase.from('cases').select('id, title, status, created_at').or(`client_id.eq.${user.id},lawyer_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(3),
        supabase.from('appointments').select('id, scheduled_at, status').or(`client_id.eq.${user.id},lawyer_id.eq.${user.id}`).gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(3)
      ]);

      return {
        recentCases: cases.data || [],
        upcomingAppointments: appointments.data || [],
        count: {
          cases: (cases.data || []).length,
          appointments: (appointments.data || []).length
        }
      };
    },
  }),

  searchLawyers: tool({
    description:
      "Searches verified lawyers by practice area and/or name. Always pass a non-empty query or specialty when the user names a person (e.g. query: 'Ahsan'). For Urdu specialty requests, pass the original Urdu query or translate it to the closest English specialty such as Family Law, Criminal Law, Tax Law, Labour Law, Property Law, Civil Law, or Immigration Law. Returns up to five matches with UUID ids for profile links.",
    inputSchema: z.object({
      specialty: z.string().optional().describe("Practice area, e.g. Real Estate, Family Law"),
      query: z.string().optional().describe("Lawyer name or keywords, e.g. Sher Shah, Ahsan Ali"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      // Keep search logic in one shared helper so the RAG tool and normal
      // lawyer-search API rank specialties the same way.
      const r = await searchLawyersFromSupabase(supabase, input);
      if (r.error) return { error: r.error };
      const lawyers = r.lawyers.slice(0, 5);
      return {
        lawyers,
        currency: "PKR",
        fee_note:
          "All consultation fees are in Pakistani Rupees (PKR) for a standard 60-minute consultation. Use consultation_fee_display when mentioning price — never USD or $.",
        note:
          lawyers.length === 0
            ? (r.note ??
              "No public lawyer profile matched that name or specialty. Suggest browsing /match or refining spelling.")
            : r.note,
      };
    },
  }),

  searchReviews: tool({
    description: "Fetches recent reviews for a lawyer profile (reviewee is the lawyer). Use the lawyer UUID from searchLawyers.",
    inputSchema: z.object({
      lawyerId: z.string().uuid().describe("Lawyer profile UUID (same as profiles.id for that lawyer)."),
    }),
    execute: async ({ lawyerId }) => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("reviews")
        .select("rating, comment, created_at")
        .eq("reviewee_id", lawyerId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) return { error: error.message };

      return {
        reviews: (data || []).map((r) => ({
          rating: r.rating,
          comment: r.comment,
          client: "Client",
          date: r.created_at,
        })),
      };
    },
  }),

  getPlatformFAQ: tool({
    description: "Provides answers to common questions about WiseCase platform policies, fees, and processes.",
    inputSchema: z.object({
      query: z.string().describe("The question the user is asking about the platform."),
    }),
    execute: async ({ query }) => {
      // Mocked knowledge base for platform-wide context
      const faqs = [
        { q: "verification", a: "Lawyers must upload a valid Bar License which is reviewed by our admin team. Verification usually takes 24-48 hours." },
        { q: "fees", a: "Lawyer consultation fees on WiseCase are listed in Pakistani Rupees (PKR) for a standard 60-minute consultation. Shorter or longer sessions are priced proportionally. Platform commission policies may apply on settlements." },
        { q: "refunds", a: "Appointments can be canceled up to 24 hours before the scheduled time for a full refund." },
        { q: "ai", a: "Our AI uses Llama-3-70B via Groq to analyze documents with high precision. However, AI results should be verified by a legal professional." },
        { q: "privacy", a: "Your documents are stored securely in encrypted Supabase storage. Only you and your assigned lawyer can access them." }
      ];

      const match = faqs.find(f => query.toLowerCase().includes(f.q));
      return match ? { answer: match.a } : { answer: "I don't have specific details on that platform policy yet, but generally, WiseCase focuses on transparency and security." };
    },
  }),

  getCaseAnalysisSummary: tool({
    description: "Aggregates insights across multiple documents in a specific case to provide a unified legal strategy summary.",
    inputSchema: z.object({
      caseId: z.string().describe("The ID of the case to summarize."),
    }),
    execute: async ({ caseId }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Not logged in." };

      // Case summaries are private: the tool first proves the user is the
      // client or assigned lawyer before reading any document analyses.
      const { data: caseRow, error: caseError } = await supabase
        .from("cases")
        .select("id, client_id, lawyer_id")
        .eq("id", caseId)
        .maybeSingle();

      if (caseError) return { error: caseError.message };
      if (!caseRow || (caseRow.client_id !== user.id && caseRow.lawyer_id !== user.id)) {
        return { error: "You do not have access to that case." };
      }

      const { data: docRows, error: docErr } = await supabase.from("documents").select("id, file_name").eq("case_id", caseId);
      if (docErr) return { error: docErr.message };
      const docIds = (docRows || []).map((d) => d.id);
      if (docIds.length === 0) return { error: "No documents found for this case." };

      const { data: analyses, error } = await supabase
        .from("document_analysis")
        .select("summary, risk_level, recommendations, document_id")
        .in("document_id", docIds);

      if (error) return { error: error.message };
      if (!analyses || analyses.length === 0) return { error: "No document analyses found for this case." };

      const nameByDoc = new Map((docRows || []).map((d) => [d.id, d.file_name as string]));
      const totalDocs = analyses.length;
      const highRiskDocs = analyses.filter((a) => a.risk_level === "High").length;

      return {
        totalDocuments: totalDocs,
        riskProfile: highRiskDocs > 0 ? "High Risk" : "Moderate/Low Risk",
        aggregatedSummaries: analyses.map(
          (a) => `${nameByDoc.get(a.document_id as string) || "Document"}: ${a.summary}`,
        ),
        combinedRecommendations: Array.from(new Set(analyses.flatMap(a => {
          try {
            return typeof a.recommendations === 'string' ? JSON.parse(a.recommendations) : (a.recommendations || []);
          } catch {
            return [a.recommendations];
          }
        }))),
        unifiedStrategy: `Based on ${totalDocs} documents, this case involves ${highRiskDocs} high-risk elements. Priority should be given to resolving issues identified in the high-risk documents.`
      };
    },
  }),
};
