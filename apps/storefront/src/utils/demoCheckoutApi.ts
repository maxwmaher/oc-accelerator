import { Tokens } from "ordercloud-javascript-sdk";
const functionsUrl = (import.meta.env.VITE_APP_CHECKOUT_API_URL || "").replace(/\/$/, "");
export type PaymentOutcome = "approve" | "decline" | "cancel";
export interface DemoPaymentResponse {
  status: "approved" | "declined" | "cancelled" | "rejected";
  paymentID?: string; amount: number; currency: string; errors?: string[];
}
export async function processDemoPayment(orderID: string, outcome: PaymentOutcome, amount: number, currency: string): Promise<DemoPaymentResponse> {
  if (!functionsUrl) throw new Error("Checkout API URL is not configured.");
  const token = await Tokens.GetValidToken();
  const response = await fetch(`${functionsUrl}/api/demo-checkout/${encodeURIComponent(orderID)}/payment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ outcome, amount, currency }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Demo payment could not be processed.");
  return body;
}
