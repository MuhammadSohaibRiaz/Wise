"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react"

export default function TestConnectionPage() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<any>(null)

  const testConnection = async () => {
    setTesting(true)
    setResults(null)

    const testResults: any = {
      envVars: {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
        keyValue: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`
          : "NOT SET",
      },
      clientCreation: { success: false, error: null },
      authTest: { success: false, error: null },
      databaseTest: { success: false, error: null },
    }

    try {
      // Test 1: Create client
      try {
        const supabase = createClient()
        testResults.clientCreation.success = true
        testResults.clientCreation.client = supabase

        // Test 2: Test auth connection
        try {
          const { error: authError } = await supabase.auth.getSession()
          if (authError) {
            testResults.authTest.error = authError.message
          } else {
            testResults.authTest.success = true
          }
        } catch (err: any) {
          testResults.authTest.error = err.message
        }

        // Test 3: Test database connection
        try {
          const { data, error: dbError } = await supabase.from("profiles").select("id").limit(1)
          if (dbError) {
            testResults.databaseTest.error = dbError.message
            if (dbError.message.includes("Invalid API key") || dbError.message.includes("JWT")) {
              testResults.databaseTest.error += " - Check your NEXT_PUBLIC_SUPABASE_ANON_KEY"
            }
          } else {
            testResults.databaseTest.success = true
            testResults.databaseTest.data = data
          }
        } catch (err: any) {
          testResults.databaseTest.error = err.message
        }
      } catch (err: any) {
        testResults.clientCreation.error = err.message
      }
    } catch (err: any) {
      testResults.generalError = err.message
    }

    setResults(testResults)
    setTesting(false)
  }

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Supabase Connection Test</h1>
          <p className="text-muted-foreground">Use this page to diagnose Supabase connection issues</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connection Diagnostics</CardTitle>
            <CardDescription>Click the button below to test your Supabase connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testConnection} disabled={testing} className="w-full">
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            {results && (
              <div className="space-y-6 mt-6">
                {/* Environment Variables */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    Environment Variables
                    {results.envVars.url && results.envVars.key ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </h3>
                  <div className="bg-muted p-4 rounded-md space-y-2 text-sm font-mono">
                    <div>
                      <span className="text-muted-foreground">NEXT_PUBLIC_SUPABASE_URL:</span>{" "}
                      {results.envVars.url ? (
                        <span className="text-green-600">{results.envVars.urlValue}</span>
                      ) : (
                        <span className="text-red-600">NOT SET</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>{" "}
                      {results.envVars.key ? (
                        <span className="text-green-600">{results.envVars.keyValue}</span>
                      ) : (
                        <span className="text-red-600">NOT SET</span>
                      )}
                    </div>
                  </div>
                  {(!results.envVars.url || !results.envVars.key) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-yellow-900">Environment Variables Missing</p>
                          <p className="text-sm text-yellow-700 mt-1">
                            Create a <code className="bg-yellow-100 px-1 rounded">.env.local</code> file in the root
                            directory with:
                          </p>
                          <pre className="mt-2 text-xs bg-yellow-100 p-2 rounded overflow-x-auto">
                            {`NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Client Creation */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    Client Creation
                    {results.clientCreation.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </h3>
                  {results.clientCreation.error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
                      {results.clientCreation.error}
                    </div>
                  )}
                </div>

                {/* Auth Test */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    Authentication Connection
                    {results.authTest.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </h3>
                  {results.authTest.error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
                      {results.authTest.error}
                    </div>
                  )}
                </div>

                {/* Database Test */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    Database Connection
                    {results.databaseTest.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </h3>
                  {results.databaseTest.error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
                      {results.databaseTest.error}
                    </div>
                  )}
                  {results.databaseTest.success && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4 text-sm text-green-700">
                      ✅ Successfully connected to Supabase database!
                    </div>
                  )}
                </div>

                {/* Summary */}
                {results.clientCreation.success &&
                  results.authTest.success &&
                  results.databaseTest.success && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                      <div className="flex gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-green-900">All Tests Passed!</p>
                          <p className="text-sm text-green-700 mt-1">
                            Your Supabase connection is working correctly.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Fix Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-2">1. Create .env.local file</p>
              <p className="text-muted-foreground">
                In the root directory (same folder as package.json), create a file named exactly{" "}
                <code className="bg-muted px-1 rounded">.env.local</code>
              </p>
            </div>
            <div>
              <p className="font-semibold mb-2">2. Add your Supabase credentials</p>
              <pre className="bg-muted p-3 rounded mt-2 text-xs overflow-x-auto">
                {`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here`}
              </pre>
            </div>
            <div>
              <p className="font-semibold mb-2">3. Get credentials from Supabase</p>
              <p className="text-muted-foreground">
                Go to{" "}
                <a
                  href="https://app.supabase.com/project/_/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Supabase Dashboard → Settings → API
                </a>
              </p>
            </div>
            <div>
              <p className="font-semibold mb-2">4. Restart dev server</p>
              <p className="text-muted-foreground">
                After creating/updating .env.local, you MUST restart your dev server (Ctrl+C then npm run dev)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

