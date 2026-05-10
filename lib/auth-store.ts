"use client"

import { create } from "zustand"
import { createClient } from "@/lib/supabase/client"

export interface User {
  id: string
  email: string
  user_type: "client" | "lawyer"
  first_name: string
  last_name: string
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  error: string | null
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  initializeAuth: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  initializeAuth: async () => {
    try {
      set({ isLoading: true, error: null })
      const supabase = createClient()

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (session?.user) {
        // Fetch user profile to get additional info
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, user_type, first_name, last_name")
          .eq("id", session.user.id)
          .single()

        if (profileError) throw profileError

        set({
          user: profile,
          isLoading: false,
        })
      } else {
        set({
          user: null,
          isLoading: false,
        })
      }
    } catch (error) {
      console.error("[v0] Auth init error:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to initialize auth",
        isLoading: false,
      })
    }
  },
  logout: async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      set({ user: null })
    } catch (error) {
      console.error("[v0] Logout error:", error)
      set({ error: error instanceof Error ? error.message : "Failed to logout" })
    }
  },
}))
