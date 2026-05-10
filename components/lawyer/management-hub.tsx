"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { ActiveCases } from "./active-cases"
import { ClientRequests } from "./client-requests"
import { UpcomingAppointments } from "./upcoming-appointments"
import { Briefcase, Calendar, Clock } from "lucide-react"

export function LawyerManagementHub() {
  const [activeTab, setActiveTab] = useState("requests")

  return (
    <Card className="border-none shadow-none bg-transparent">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <h2 className="text-2xl font-bold">Management Hub</h2>
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Requests</span>
              <span className="sm:hidden text-xs">Reqs</span>
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Upcoming</span>
              <span className="sm:hidden text-xs">Upc</span>
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Active Cases</span>
              <span className="sm:hidden text-xs">Cases</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="requests" className="mt-0 space-y-4">
          <ClientRequests hideTitle={true} />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-0 space-y-4">
          <UpcomingAppointments hideTitle={true} />
        </TabsContent>

        <TabsContent value="active" className="mt-0 space-y-4">
          <ActiveCases hideTitle={true} />
        </TabsContent>
      </Tabs>
    </Card>
  )
}
