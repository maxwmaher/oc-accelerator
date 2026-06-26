import { BuyerProduct } from "ordercloud-javascript-sdk";
export { RAI_DEMO_CONTEXT_CHANGED_EVENT } from "./raiDemoContexts";
import {
  getRaiDemoProductFamily,
  RaiDemoProductFamily,
} from "./raiDemoLifecycle";

export type RaiDemoCatalogueFilter =
  | "all"
  | "recommended"
  | "utilities"
  | "catering"
  | "stand-construction";

// Demo-only: production would enforce catalogue visibility with OrderCloud
// catalog assignments, user groups, price schedules, and/or middleware-driven
// product visibility from Momentus instead of these local UI rules.
export const RAI_DEMO_CATALOGUE_FILTER_LABELS: Record<
  RaiDemoCatalogueFilter,
  string
> = {
  all: "All",
  recommended: "Recommended for this stand",
  utilities: "Utilities",
  catering: "Catering",
  "stand-construction": "Stand construction",
};

export const getRaiDemoCatalogueSegment = (context: {
  hall: string;
  standPackage: string;
}) => {
  const hall = context.hall.toLowerCase();
  const standPackage = context.standPackage.toLowerCase();

  if (hall.includes("hall 8") && standPackage.includes("space only")) {
    return {
      id: "hall-8-space-only",
      emphasis:
        "Power, sockets, raised floor, and service placement are highlighted for this stand.",
      visibilityBadge: "Visible for Hall 8 · Space only",
      recommendedFamilies: ["utility", "flooring"] as RaiDemoProductFamily[],
    };
  }

  if (hall.includes("hall 10") && standPackage.includes("standard booth")) {
    return {
      id: "hall-10-standard-booth",
      emphasis:
        "Catering and additional sockets are highlighted for this stand.",
      visibilityBadge: "Visible for Hall 10 · Standard booth",
      recommendedFamilies: ["catering", "utility"] as RaiDemoProductFamily[],
    };
  }

  return {
    id: "default",
    emphasis:
      "Recommended services are highlighted for the selected event and stand context.",
    visibilityBadge: "Visible for selected stand",
    recommendedFamilies: [] as RaiDemoProductFamily[],
  };
};

export const getRaiDemoProductVisibilityBadge = (
  product: Pick<BuyerProduct, "ID" | "Name" | "xp">,
  context: { hall: string; standPackage: string },
) => {
  const family = getRaiDemoProductFamily(product);
  const segment = getRaiDemoCatalogueSegment(context);

  return family && segment.recommendedFamilies.includes(family)
    ? segment.visibilityBadge
    : undefined;
};

export const productMatchesRaiDemoCatalogueFilter = (
  product: Pick<BuyerProduct, "ID" | "Name" | "xp">,
  context: { hall: string; standPackage: string },
  filter: RaiDemoCatalogueFilter,
) => {
  const family = getRaiDemoProductFamily(product);

  switch (filter) {
    case "recommended":
      return Boolean(getRaiDemoProductVisibilityBadge(product, context));
    case "utilities":
      return family === "utility";
    case "catering":
      return family === "catering";
    case "stand-construction":
      return family === "flooring";
    case "all":
    default:
      return true;
  }
};
