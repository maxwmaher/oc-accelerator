import { ShipEstimateResponse } from "ordercloud-javascript-sdk";
import {
  DemoPreferredShippingMethod,
  DemoSelectedShippingMethod,
} from "./types";

export class NoShippingRatesError extends Error {
  constructor(
    message = "No valid shipping methods were returned for this order.",
  ) {
    super(message);
    this.name = "NoShippingRatesError";
  }
}

const normalize = (value?: string | null) =>
  (value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const STABLE_XP_KEYS = [
  "ShippingMethodKey",
  "ShipMethodKey",
  "CarrierServiceCode",
  "ServiceCode",
  "MethodCode",
  "Code",
  "StableID",
  "StableId",
  "ExternalID",
  "ExternalId",
];

const sameStableXp = (
  preferred?: DemoPreferredShippingMethod,
  candidateXp?: Record<string, unknown>,
) => {
  if (!preferred?.xp || !candidateXp) return false;
  return STABLE_XP_KEYS.some((key) => {
    const preferredValue = preferred.xp?.[key];
    const candidateValue = candidateXp[key];
    return Boolean(
      preferredValue &&
        candidateValue &&
        String(preferredValue).toLowerCase() ===
          String(candidateValue).toLowerCase(),
    );
  });
};

type Candidate = DemoSelectedShippingMethod & {
  xp?: Record<string, unknown>;
};

const toCandidates = (response?: ShipEstimateResponse | null): Candidate[] =>
  (response?.ShipEstimates || []).flatMap((estimate) =>
    (estimate.ShipMethods || [])
      .filter(
        (method) =>
          estimate.ID &&
          method.ID &&
          typeof method.Cost === "number" &&
          Number.isFinite(method.Cost),
      )
      .map((method) => ({
        ShipEstimateID: estimate.ID as string,
        ShipMethodID: method.ID as string,
        ShipMethodName: method.Name || method.ID || "Shipping Method",
        Cost: method.Cost as number,
        EstimatedTransitDays: method.EstimatedTransitDays,
        xp: method.xp as Record<string, unknown> | undefined,
        matchStatus: "MATCHED" as const,
      })),
  );

const withoutXp = (candidate: Candidate): DemoSelectedShippingMethod => ({
  ShipEstimateID: candidate.ShipEstimateID,
  ShipMethodID: candidate.ShipMethodID,
  ShipMethodName: candidate.ShipMethodName,
  Cost: candidate.Cost,
  EstimatedTransitDays: candidate.EstimatedTransitDays,
  matchStatus: candidate.matchStatus,
  fallbackReason: candidate.fallbackReason,
});

export const choosePreferredOrCheapestShippingMethod = (
  response?: ShipEstimateResponse | null,
  preferred?: DemoPreferredShippingMethod,
): DemoSelectedShippingMethod => {
  const candidates = toCandidates(response);
  if (!candidates.length) throw new NoShippingRatesError();

  if (preferred) {
    const preferredName = normalize(preferred.ShipMethodName);
    const xpMatch = candidates.find((candidate) =>
      sameStableXp(preferred, candidate.xp),
    );
    if (xpMatch) return withoutXp(xpMatch);

    const nameMatch = preferredName
      ? candidates.find(
          (candidate) => normalize(candidate.ShipMethodName) === preferredName,
        )
      : undefined;
    if (nameMatch) return withoutXp(nameMatch);

    const nameAndTransitMatch = preferredName
      ? candidates.find(
          (candidate) =>
            normalize(candidate.ShipMethodName) === preferredName &&
            candidate.EstimatedTransitDays === preferred.EstimatedTransitDays,
        )
      : undefined;
    if (nameAndTransitMatch) return withoutXp(nameAndTransitMatch);

    const idMatch = preferred.ShipMethodID
      ? candidates.find(
          (candidate) => candidate.ShipMethodID === preferred.ShipMethodID,
        )
      : undefined;
    if (idMatch) return withoutXp(idMatch);
  }

  const cheapest = [...candidates].sort((a, b) => a.Cost - b.Cost)[0];
  return {
    ...withoutXp(cheapest),
    matchStatus: "FALLBACK_CHEAPEST",
    fallbackReason: preferred
      ? "Previous shipping method was not available in the new estimate."
      : "No previous shipping method preference was available.",
  };
};

export const chooseCheapestShippingMethod = (
  response?: ShipEstimateResponse | null,
): DemoSelectedShippingMethod =>
  choosePreferredOrCheapestShippingMethod(response, undefined);
