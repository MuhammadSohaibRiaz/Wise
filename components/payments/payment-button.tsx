"use client"

import { useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

interface PaymentButtonProps {
  appointmentId: string
  amount: number
  currency?: string
  onPaymentSuccess?: () => void
}

export function PaymentButton({ appointmentId, amount, currency = "USD", onPaymentSuccess }: PaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handlePayment = async () => {
    try {
      setIsProcessing(true)

      // Create payment intent
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

      const { clientSecret, paymentId } = await response.json()

      if (!clientSecret) {
        throw new Error("No client secret returned")
      }

      const stripe = await stripePromise
      if (!stripe) {
        throw new Error("Stripe failed to load")
      }

      // Redirect to Stripe hosted payment page
      const checkoutSession = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appointmentId,
          amount,
          currency: currency.toLowerCase(),
          paymentId,
        }),
      })

      if (!checkoutSession.ok) {
        const error = await checkoutSession.json()
        throw new Error(error.error || "Failed to create checkout session")
      }

      const { url } = await checkoutSession.json()
      if (url) {
        // Redirect to Stripe Checkout
        // After payment, user will be redirected back to /client/appointments?payment=success
        window.location.href = url
        return
      }
      
      throw new Error("No checkout URL returned")
    } catch (error: any) {
      console.error("[Payment] Error:", error)
      toast({
        title: "Payment Failed",
        description: error.message || "Please try again or contact support if the issue persists.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Button onClick={handlePayment} disabled={isProcessing} className="gap-2">
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
  )
}

