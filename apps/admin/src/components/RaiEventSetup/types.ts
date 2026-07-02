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
