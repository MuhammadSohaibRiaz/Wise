"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertCircle, Loader2 } from "lucide-react"
import { FileUpload } from "@/components/auth/file-upload"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

export default function ClientSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  // States
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    country: "",
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true)
        const {
          data: { user },
        } = await supabase.auth.getUser()

        console.log("[Client Settings] Current user:", user?.id)

        if (!user) {
          router.push("/auth/client/sign-in")
          return
        }

        setUser(user)

        const { data: profileData, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()

        console.log("[Client Settings] Profile data from DB:", profileData)
        console.log("[Client Settings] Profile error:", error)

        if (error && error.code !== "PGRST116") {
          throw error
        }

        if (profileData) {
          setProfile(profileData)
          // Parse location field: "City, Country" format
          const locationParts = (profileData.location || "").split(",").map((s: string) => s.trim())
          const city = locationParts[0] || ""
          const country = locationParts[1] || ""

          const newFormData = {
            firstName: profileData.first_name || "",
            lastName: profileData.last_name || "",
            email: profileData.email || user.email || "",
            phone: profileData.phone || "",
            city: city,
            country: country,
          }

          console.log("[Client Settings] Setting form data:", newFormData)
          setFormData(newFormData)
        } else {
          console.log("[Client Settings] No profile data found, using defaults")
          // Set email at least
          setFormData(prev => ({
            ...prev,
            email: user.email || "",
          }))
        }
      } catch (error) {
        console.error("[Client Settings] Error loading user data:", error)
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [supabase, router, toast])

  const handleProfilePictureUpload = async (file: File) => {
    if (!user) return

    try {
      setIsUploading(true)

      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const tryUpload = async (bucket: "avatars" | "avatar") => {
        const upload = await supabase.storage.from(bucket).upload(fileName, file, { upsert: true })
        if (upload.error) return { bucket, error: upload.error, publicUrl: null as string | null }
        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(fileName)
        return { bucket, error: null, publicUrl }
      }

      let selected = await tryUpload("avatars")
      if (
        selected.error &&
        (selected.error.message.toLowerCase().includes("bucket") || selected.error.message.toLowerCase().includes("not found"))
      ) {
        selected = await tryUpload("avatar")
      }

      if (selected.error || !selected.publicUrl) {
        console.error("Upload error:", selected.error)
        if (selected.error?.message.includes("bucket") || selected.error?.message.includes("not found")) {
          throw new Error(
            'Storage bucket "avatars" not found or inaccessible. Please verify bucket and storage policies from script 018.'
          )
        }
        throw selected.error || new Error("Failed to upload avatar")
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: selected.publicUrl })
        .eq("id", user.id)

      if (updateError) throw updateError

      // Reload profile from database
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (profileData) {
        setProfile(profileData)
      }

      router.refresh()

      toast({
        title: "✅ Success",
        description: "Your profile picture has been updated successfully!",
      })
    } catch (error: any) {
      console.error("Error uploading profile picture:", error)
      toast({
        title: "❌ Error",
        description: error.message || "Failed to upload profile picture. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpdatePersonalInfo = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Combine city and country into location field: "City, Country" format
      let locationValue = ""
      if (formData.city && formData.country) {
        locationValue = `${formData.city}, ${formData.country}`
      } else if (formData.city) {
        locationValue = formData.city
      } else if (formData.country) {
        locationValue = formData.country
      }

      const updateData: any = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        location: locationValue || null,
        updated_at: new Date().toISOString(),
      }

      const { error, data } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id)
        .select()

      if (error) {
        console.error("Update error details:", error)
        throw error
      }

      // Reload data from Supabase to ensure consistency
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()

      if (profileData) {
        setProfile(profileData)
        // Parse location field: "City, Country" format
        const locationParts = (profileData.location || "").split(",").map((s: string) => s.trim())
        const city = locationParts[0] || ""
        const country = locationParts[1] || ""

        setFormData({
          firstName: profileData.first_name || "",
          lastName: profileData.last_name || "",
          email: profileData.email || user.email || "",
          phone: profileData.phone || "",
          city: city,
          country: country,
        })
      }

      toast({
        title: "✅ Success",
        description: "Your personal information has been saved successfully!",
      })
    } catch (error: any) {
      console.error("Error updating profile:", error)
      toast({
        title: "❌ Error",
        description: error.message || "Failed to update personal information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      toast({
        title: "Error",
        description: "Please enter your current password",
        variant: "destructive",
      })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      })
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    try {
      setPasswordLoading(true)

      // Verify current password first
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword,
      })

      if (authError) {
        toast({
          title: "Error",
          description: "Current password is incorrect",
          variant: "destructive",
        })
        return
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      })

      if (updateError) throw updateError

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })

      toast({
        title: "✅ Success",
        description: "Your password has been updated successfully!",
      })
    } catch (error: any) {
      console.error("Error changing password:", error)
      toast({
        title: "❌ Error",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    const currentPassword = prompt("Please enter your current password to confirm account deletion:")
    if (!currentPassword) {
      toast({
        title: "Cancelled",
        description: "Account deletion cancelled",
      })
      return
    }

    if (!confirm("Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.")) {
      return
    }

    try {
      setLoading(true)

      // Verify current password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (authError) {
        toast({
          title: "Error",
          description: "Incorrect password. Account deletion cancelled.",
          variant: "destructive",
        })
        return
      }

      // Delete account
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)

      if (deleteError) throw deleteError

      toast({
        title: "Success",
        description: "Account deleted successfully. Redirecting...",
      })

      setTimeout(() => {
        router.push("/")
      }, 1500)
    } catch (error: any) {
      console.error("Error deleting account:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading && !profile) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    )
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-4">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>Upload a profile picture for your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback>
                    {formData.firstName.charAt(0)}
                    {formData.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <FileUpload onFileSelect={handleProfilePictureUpload} currentImageUrl={profile?.avatar_url} />
              </div>
              {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name</label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input value={formData.email} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <Input
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleUpdatePersonalInfo} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password regularly for security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password *</label>
                <Input
                  type="password"
                  placeholder="Enter your current password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  placeholder="Enter new password (min 6 characters)"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </div>
              <Button onClick={handleChangePassword} disabled={passwordLoading}>
                {passwordLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Update Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Delete Account</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permanently delete your account and all associated data. This cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="flex-shrink-0"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
