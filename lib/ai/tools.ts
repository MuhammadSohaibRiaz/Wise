import { createClient } from "@/lib/supabase/server";
import { tool } from "ai";
import { z } from "zod";
import { normalizeChatNavigationPath, type ChatRole } from "@/lib/chat-routes";
import { searchLawyersFromSupabase } from "@/lib/lawyer-search";

export const tools = {
  navigateToPage: tool({
    description:
      "Navigates the user to a specific page on the platform. Use canonical paths from the system prompt; ambiguous paths like /settings or /dashboard will be corrected for the user's role.",
    inputSchema: z.object({
      path: z.string().describe('The path to navigate to, e.g., /client/analysis, /match, /client/cases'),
    }),
    execute: async ({ path }: { path: string }) => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let role: ChatRole = "guest";
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
        role = profile?.user_type === "lawyer" ? "lawyer" : "client";
      }
      const normalized = normalizeChatNavigationPath(path, role);
      return { success: true, marker: `[NAVIGATE:${normalized}]`, path: normalized };
    },
  }),

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
          if (!lawyerProfile.hourly_rate) missingFields.push('Hourly Rate');
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
    description: 'Updates the profile information for the logged-in user. Use this to help users complete their missing fields.',
    inputSchema: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      bio: z.string().optional(),
      location: z.string().optional(),
      // Lawyer specific
      specializations: z.array(z.string()).optional(),
      hourlyRate: z.number().optional(),
      yearsExperience: z.number().optional(),
      licenseNumber: z.string().optional(),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Not logged in." };

      const profileUpdates: any = {};
      if (input.firstName) profileUpdates.first_name = input.firstName;
      if (input.lastName) profileUpdates.last_name = input.lastName;
      if (input.phone) profileUpdates.phone = input.phone;
      if (input.bio) profileUpdates.bio = input.bio;
      if (input.location) profileUpdates.location = input.location;

      const lawyerUpdates: any = {};
      if (input.specializations) lawyerUpdates.specializations = input.specializations;
      if (input.hourlyRate) lawyerUpdates.hourly_rate = input.hourlyRate;
      if (input.yearsExperience) lawyerUpdates.years_of_experience = input.yearsExperience;
      if (input.licenseNumber) lawyerUpdates.bar_license_number = input.licenseNumber;

      if (Object.keys(profileUpdates).length === 0 && Object.keys(lawyerUpdates).length === 0) {
        return { error: "No valid profile fields provided for update." };
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', user.id);
        if (error) return { error: `Profile update failed: ${error.message}` };
      }

      if (Object.keys(lawyerUpdates).length > 0) {
        const { error } = await supabase.from('lawyer_profiles').update(lawyerUpdates).eq('id', user.id);
        if (error) return { error: `Lawyer profile update failed: ${error.message}` };
      }

      return { success: true, message: "Profile updated successfully." };
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
        supabase.from('cases').select('id, title, status, created_at').eq('client_id', user.id).or(`lawyer_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(3),
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
      "Searches verified lawyers by practice area and/or name. Always pass a non-empty query or specialty when the user names a person (e.g. query: 'Ahsan'). Returns up to five matches with UUID ids for profile links.",
    inputSchema: z.object({
      specialty: z.string().optional().describe("Practice area, e.g. Real Estate, Family Law"),
      query: z.string().optional().describe("Lawyer name or keywords, e.g. Sher Shah, Ahsan Ali"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const r = await searchLawyersFromSupabase(supabase, input);
      if (r.error) return { error: r.error };
      const lawyers = r.lawyers.slice(0, 5);
      return {
        lawyers,
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
        { q: "fees", a: "WiseCase platform is currently free for students (FYP). For professional use, we charge a 10% commission on case settlements." },
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
