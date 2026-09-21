import { Tokens } from "ordercloud-javascript-sdk";
const functionsUrl = (import.meta.env.VITE_APP_CHECKOUT_API_URL || "").replace(/\/$/, "");
export type PaymentOutcome = "approve" | "decline" | "cancel";
export interface DemoPaymentResponse {
  status: "approved" | "declined" | "cancelled" | "rejected";
  paymentID?: string; amount: number; currency: string; errors?: string[];
}
export interface DemoOrderStatusResponse { status: "submitted" | "unsubmitted"; orderID: string; }

async function checkoutRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!functionsUrl) throw new Error("Checkout API URL is not configured.");
  const token = await Tokens.GetValidToken();
  const response = await fetch(`${functionsUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Demo checkout status could not be determined.");
  return body;
}

export function getDemoOrderStatus(orderID: string): Promise<DemoOrderStatusResponse> {
  return checkoutRequest(`/api/demo-checkout/${encodeURIComponent(orderID)}/status`);
}

export async function processDemoPayment(orderID: string, outcome: PaymentOutcome, amount: number, currency: string): Promise<DemoPaymentResponse> {
  return checkoutRequest(`/api/demo-checkout/${encodeURIComponent(orderID)}/payment`, {
    method: "POST",
    body: JSON.stringify({ outcome, amount, currency }),
  });
}
