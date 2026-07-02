import { RaiBuyerSetupForm, RaiProductSetupForm } from './types'

export const previewRaiProductSetup = (form: RaiProductSetupForm) => ({
  productName: form.name,
  category: form.category,
  eventWebsites: form.eventWebsites,
  optionsCount: form.sizes.length + form.flavours.length + form.toppings.length,
})

export const previewRaiBuyerSetup = (form: RaiBuyerSetupForm) => ({
  companyName: form.companyName,
  buyerEmail: form.email,
  eventName: form.eventName,
  accessSummary: `${form.productAccess.length} product groups at ${form.pricingTier} pricing`,
})

export const submitRaiProductSetup = async (form: RaiProductSetupForm) => {
  // TODO: Wire this Phase 2 stub to OrderCloud Products, PriceSchedules, Specs, and catalog assignment mutations.
  return previewRaiProductSetup(form)
}

export const submitRaiBuyerSetup = async (form: RaiBuyerSetupForm) => {
  // TODO: Wire this Phase 2 stub to OrderCloud Buyers, Users, catalog access, product assignment, and pricing mutations.
  return previewRaiBuyerSetup(form)
}
