"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { AdminHeader } from "@/components/admin/admin-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Search, 
  User, 
  Mail, 
  Shield, 
  MoreVertical,
  Filter,
  Loader2
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  user_type: string
  avatar_url: string
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchUsers() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) throw error
        setUsers(data || [])
      } catch (error) {
        console.error("Error fetching users:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
    const email = (user.email || "").toLowerCase()
    const query = searchQuery.toLowerCase()
    return fullName.includes(query) || email.includes(query)
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <AdminHeader />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <AdminHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">User Management</h1>
            <p className="text-gray-500 mt-1">View and manage all registered accounts on WiseCase</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search by name or email..." 
                className="pl-9 bg-white" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="hidden md:grid grid-cols-12 px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <div className="col-span-5">User Information</div>
            <div className="col-span-3">Role / Account Type</div>
            <div className="col-span-3">Joined Date</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {filteredUsers.length === 0 ? (
            <Card className="p-12 text-center bg-white border-dashed">
              <p className="text-muted-foreground">No users found matching your search.</p>
            </Card>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} className="hover:shadow-sm transition-shadow bg-white overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-12 items-center p-4 md:p-6 gap-4">
                    {/* User Info */}
                    <div className="col-span-5 flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-primary/5 text-primary">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 truncate">
                          {user.first_name} {user.last_name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="col-span-3">
                      <Badge variant="outline" className={`
                        capitalize px-3 py-0.5 border-none
                        ${user.user_type === 'admin' ? 'bg-purple-50 text-purple-700' : 
                          user.user_type === 'lawyer' ? 'bg-blue-50 text-blue-700' : 
                          'bg-green-50 text-green-700'}
                      `}>
                        <Shield className="h-3 w-3 mr-1.5" />
                        {user.user_type}
                      </Badge>
                    </div>

                    {/* Date */}
                    <div className="col-span-3 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 text-right">
                      <button className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
