"use client"

import { useState, useEffect } from "react"
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

interface StripeCheckoutProps {
  appointmentId: string
  amount: number
  currency?: string
  onPaymentSuccess?: () => void
}

function CheckoutForm({ appointmentId, amount, currency = "USD", onPaymentSuccess }: StripeCheckoutProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appointmentId,
            amount,
            currency: currency.toLowerCase(),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create payment")
        }

        const { clientSecret: secret } = await response.json()
        setClientSecret(secret)
      } catch (error: any) {
        console.error("[Payment] Error creating intent:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to initialize payment",
          variant: "destructive",
        })
      }
    }

    createPaymentIntent()
  }, [appointmentId, amount, currency, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setIsProcessing(true)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/client/appointments?payment=success`,
        },
        redirect: "if_required",
      })

      if (error) {
        throw error
      }

      if (paymentIntent?.status === "succeeded") {
        toast({
          title: "Payment successful!",
          description: "Your appointment has been confirmed.",
        })

        // Poll for payment status update
        let attempts = 0
        const maxAttempts = 10
        const checkPaymentStatus = setInterval(async () => {
          attempts++
          const { data: payment } = await supabase
            .from("payments")
            .select("status, appointments(status)")
            .eq("appointment_id", appointmentId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

          if (payment?.status === "completed" || attempts >= maxAttempts) {
            clearInterval(checkPaymentStatus)
            if (onPaymentSuccess) {
              onPaymentSuccess()
            }
            // Refresh the page to show updated status
            setTimeout(() => {
              window.location.reload()
            }, 1000)
          }
        }, 1000)

        setTimeout(() => {
          clearInterval(checkPaymentStatus)
          if (onPaymentSuccess) {
            onPaymentSuccess()
          }
          window.location.reload()
        }, 10000)
      }
    } catch (error: any) {
      console.error("[Payment] Error:", error)
      toast({
        title: "Payment failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
    },
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || isProcessing} className="w-full gap-2">
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pay ${amount.toFixed(2)}
          </>
        )}
      </Button>
    </form>
  )
}

export function StripeCheckout({ appointmentId, amount, currency = "USD", onPaymentSuccess }: StripeCheckoutProps) {
  const options: StripeElementsOptions = {
    mode: "payment",
    amount: Math.round(amount * 100),
    currency: currency.toLowerCase(),
    appearance: {
      theme: "stripe",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Payment</CardTitle>
        <CardDescription>Total amount: ${amount.toFixed(2)} {currency}</CardDescription>
      </CardHeader>
      <CardContent>
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm
            appointmentId={appointmentId}
            amount={amount}
            currency={currency}
            onPaymentSuccess={onPaymentSuccess}
          />
        </Elements>
      </CardContent>
    </Card>
  )
}

