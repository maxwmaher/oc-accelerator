import { BuyerProduct } from "ordercloud-javascript-sdk";

export type RaiDemoProductFamily = "catering" | "utility" | "flooring";

export interface RaiDemoProductLifecycleMessaging {
  family: RaiDemoProductFamily;
  cardBadge: string;
  availabilityBadge: string;
  helper: string;
}

export const RAI_DEMO_EVENT_LIFECYCLE = {
  eventDate: "2026-10-12",
  currentStage: "Standard ordering",
  currentStageDescription: "Standard ordering window is active",
  nextStage: "Late ordering",
  nextStageStart: "2026-09-01",
  buildUpStart: "2026-10-08",
  eventOpen: "2026-10-12",
  breakdownStart: "2026-10-15",
  source: "Mocked Momentus event timeline",
} as const;

const RAI_DEMO_PRODUCT_LIFECYCLE_MESSAGES: Record<
  RaiDemoProductFamily,
  RaiDemoProductLifecycleMessaging
> = {
  catering: {
    family: "catering",
    cardBadge: "Standard ordering",
    availabilityBadge: "Available in standard ordering",
    helper: "Catering delivery time required before checkout",
  },
  utility: {
    family: "utility",
    cardBadge: "Build-up available",
    availabilityBadge: "Available through build-up",
    helper: "Placement required for supplier execution",
  },
  flooring: {
    family: "flooring",
    cardBadge: "Deadline-sensitive",
    availabilityBadge: "Deadline-sensitive",
    helper: "Order before late build-up cut-off",
  },
};

export const getRaiDemoProductFamily = (
  product?: Pick<BuyerProduct, "ID" | "Name" | "xp">,
): RaiDemoProductFamily | undefined => {
  const haystack = [
    product?.ID,
    product?.Name,
    (product as any)?.SKU,
    (product?.xp as any)?.SKU,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/food|fnb|croissant|breakfast|sandwich|muesli|yoghurt/.test(haystack)) {
    return "catering";
  }
  if (/power|socket|electricity|connection/.test(haystack)) {
    return "utility";
  }
  if (/floor/.test(haystack)) {
    return "flooring";
  }
  return undefined;
};

export const getRaiDemoProductLifecycleMessaging = (
  product?: Pick<BuyerProduct, "ID" | "Name" | "xp">,
) => {
  const family = getRaiDemoProductFamily(product);
  return family ? RAI_DEMO_PRODUCT_LIFECYCLE_MESSAGES[family] : undefined;
};
