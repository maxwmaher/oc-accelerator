export interface RaiProductSetupForm {
  name: string
  category: string
  vegetarianOnlyEventEligible: boolean
  basePrice: string
  currency: string
  sizes: string[]
  flavours: string[]
  toppings: string[]
  eventWebsites: string[]
}

export interface RaiBuyerSetupForm {
  eventName: string
  companyName: string
  boothNumber: string
  firstName: string
  lastName: string
  email: string
  eventWebsites: string[]
  productAccess: string[]
  pricingTier: string
}

export interface RaiEventCatalogConfig {
  eventWebsiteLabel: string
  catalogID: string
}

export interface RaiSkippedCatalog {
  eventWebsiteLabel: string
  catalogID?: string
  reason: string
}

export interface RaiProductSpecResult {
  specID: string
  name: string
  optionIDs: string[]
}

export interface RaiProductSetupResult {
  productID: string
  priceScheduleID: string
  defaultPrice: number
  currency: string
  specs: RaiProductSpecResult[]
  createdOrUpdatedSpecIDs: string[]
  assignedCatalogIDs: string[]
  skippedCatalogs: RaiSkippedCatalog[]
  warnings: string[]
  technicalSummary: string[]
}

export interface RaiBuyerSetupResult {
  buyerID: string
  buyerUserID: string
  username: string
  email: string
  eventWebsiteLabel: string
  catalogID?: string
  catalogAccessAssigned: boolean
  productPricingAssigned: boolean
  securityProfileAssigned: boolean
  boothNumber: string
  priceTier: string
  exampleProductAvailable: boolean
  warnings: string[]
  technicalSummary: string[]
}

export type RaiReadinessOverallStatus = 'ready' | 'partial' | 'not-ready'
export type RaiReadinessItemStatus = 'ready' | 'missing' | 'warning' | 'unchecked'

export interface RaiReadinessItem {
  label: string
  status: RaiReadinessItemStatus
  message?: string
  technicalID?: string
}

export interface RaiDemoReadinessResult {
  overallStatus: RaiReadinessOverallStatus
  eventWebsitesReady: boolean
  pizzaSetupReady: boolean
  exhibitorSetupReady: boolean
  readyToRecord: boolean
  canCreatePizza: boolean
  canRegisterBuyer: boolean
  canRunFinalReadinessCheck: boolean
  eventWebsites: RaiReadinessItem[]
  productSetup: RaiReadinessItem[]
  buyerSetup: RaiReadinessItem[]
  productAvailabilityAssignments: RaiReadinessItem[]
  warnings: string[]
  technicalSummary: string[]
}

export interface RaiPrepareDemoEventWebsitesResult {
  createdCatalogIDs: string[]
  updatedCatalogIDs: string[]
  skippedCatalogIDs: string[]
  warnings: string[]
  technicalSummary: string[]
}

export type RaiDemoDeleteOverallStatus = 'deleted' | 'partial' | 'already-clean' | 'failed'

export interface RaiDemoDeleteSkippedItem {
  label: string
  id: string
  reason: string
}

export interface RaiDeleteDemoDataResult {
  deletedItems: string[]
  skippedItems: RaiDemoDeleteSkippedItem[]
  notFoundItems: string[]
  warnings: string[]
  technicalSummary: string[]
  overallStatus: RaiDemoDeleteOverallStatus
}
