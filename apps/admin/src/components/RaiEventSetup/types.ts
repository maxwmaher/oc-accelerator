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
