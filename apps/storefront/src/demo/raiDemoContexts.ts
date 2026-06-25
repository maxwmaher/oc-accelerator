export interface RaiDemoContext {
  id: string;
  accountId: string;
  companyName: string;
  eventId: string;
  eventName: string;
  exhibitorId: string;
  hall: string;
  standNumber: string;
  standType: string;
  standPackage: string;
  role: string;
}

export const RAI_DEMO_CONTEXT_STORAGE_KEY = "rai-demo-context-id";

// Demo-only: production would retrieve these contexts from the post-Keycloak
// Momentus/profile-service call, then keep OrderCloud catalog and Buyer context
// changes explicit in their own flow rather than implying they happen here.
export const RAI_DEMO_CONTEXTS: RaiDemoContext[] = [
  {
    id: "devworld-2026-exh-dw26-08420",
    companyName: "Northstar Exhibitions B.V.",
    accountId: "ACC-RAI-DEMO-001",
    eventName: "DevWorld 2026",
    eventId: "DEVWORLD-2026",
    exhibitorId: "EXH-DW26-08420",
    hall: "Hall 8",
    standNumber: "08.420",
    standType: "Exhibition stand",
    standPackage: "Space only",
    role: "Exhibitor",
  },
  {
    id: "devworld-2026-exh-dw26-10115",
    companyName: "Northstar Exhibitions B.V.",
    accountId: "ACC-RAI-DEMO-001",
    eventName: "DevWorld 2026",
    eventId: "DEVWORLD-2026",
    exhibitorId: "EXH-DW26-10115",
    hall: "Hall 10",
    standNumber: "10.115",
    standType: "Networking booth",
    standPackage: "Standard booth",
    role: "Exhibitor",
  },
];

export const getRaiDemoContextById = (contextId?: string | null) => {
  return (
    RAI_DEMO_CONTEXTS.find((context) => context.id === contextId) ??
    RAI_DEMO_CONTEXTS[0]
  );
};
