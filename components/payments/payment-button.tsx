"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { APP_CURRENCY, APP_CURRENCY_CODE, formatCurrency } from "@/lib/currency"

interface PaymentButtonProps {
  appointmentId: string
  amount: number
  /** When set, reuses an existing pending payment row instead of creating a duplicate */
  paymentId?: string
  currency?: string
  size?: "default" | "sm" | "lg" | "icon"
  returnTo?: "appointments" | "payments"
  onPaymentSuccess?: () => void
}

export function PaymentButton({
  appointmentId,
  amount,
  paymentId: existingPaymentId,
  currency = APP_CURRENCY,
  size = "default",
  returnTo = "appointments",
  onPaymentSuccess,
}: PaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  const handlePayment = async () => {
    try {
      setIsProcessing(true)

      let paymentId = existingPaymentId

      if (!paymentId) {
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appointmentId,
            amount,
            currency: (currency || APP_CURRENCY_CODE).toLowerCase(),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create payment")
        }

        const payload = await response.json()
        paymentId = payload.paymentId
        if (!paymentId) {
          throw new Error("No payment id returned")
        }
      }

      const checkoutSession = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appointmentId,
          amount,
          currency: (currency || APP_CURRENCY_CODE).toLowerCase(),
          paymentId,
          returnTo,
        }),
      })

      if (!checkoutSession.ok) {
        const error = await checkoutSession.json()
        throw new Error(error.error || "Failed to create checkout session")
      }

      const { url } = await checkoutSession.json()
      if (url) {
        // Redirect to Stripe Checkout
        // After payment, user returns to appointments or payments based on returnTo
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
    <Button onClick={handlePayment} disabled={isProcessing} size={size} className="gap-2">
      {isProcessing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4" />
          Pay {formatCurrency(amount)}
        </>
      )}
    </Button>
  )
}
