import {
  Catalogs,
  OrderCloudError,
  PriceSchedules,
  Products,
  Specs,
  Product,
  PriceSchedule,
  Spec,
} from 'ordercloud-javascript-sdk'
import {
  RaiBuyerSetupForm,
  RaiEventCatalogConfig,
  RaiProductSetupForm,
  RaiProductSetupResult,
  RaiProductSpecResult,
  RaiSkippedCatalog,
} from './types'

const RAI_PRODUCT_ID = 'RAI_PIZZA'
const RAI_PRICE_SCHEDULE_ID = 'RAI_PIZZA_DEFAULT_PRICE'

const RAI_EVENT_CATALOGS: RaiEventCatalogConfig[] = [
  { eventWebsiteLabel: 'ISE 2026', catalogID: 'ISE_2026_CATALOG' },
  { eventWebsiteLabel: 'Interclean 2026', catalogID: 'INTERCLEAN_2026_CATALOG' },
  { eventWebsiteLabel: 'RAI Catering Portal', catalogID: 'RAI_CATERING_CATALOG' },
  { eventWebsiteLabel: 'Vegetarian-only Event', catalogID: 'VEGETARIAN_EVENT_CATALOG' },
]

const SPEC_CONFIG = [
  { id: 'RAI_PIZZA_SIZE', name: 'Size', formKey: 'sizes' },
  { id: 'RAI_PIZZA_FLAVOUR', name: 'Flavour', formKey: 'flavours' },
  { id: 'RAI_PIZZA_TOPPING', name: 'Toppings', formKey: 'toppings' },
] as const

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

const parsePrice = (value: string) => {
  const price = Number.parseFloat(value)
  return Number.isFinite(price) && price > 0 ? price : 12
}

const sanitizeOptionID = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const getErrorStatus = (error: unknown) => error instanceof OrderCloudError ? error.status : undefined

const isNotFound = (error: unknown) => getErrorStatus(error) === 404

const getReadableErrorMessage = (error: unknown) => {
  if (error instanceof OrderCloudError) return error.message
  if (error instanceof Error) return error.message
  return 'OrderCloud could not complete the request.'
}

const upsertProduct = async (form: RaiProductSetupForm, price: number) => {
  const product: Product = {
    ID: RAI_PRODUCT_ID,
    Name: 'Pizza',
    Description: 'Reusable demo catering product for event websites: fresh pizza with configurable size, flavour, and toppings.',
    Active: true,
    DefaultPriceScheduleID: RAI_PRICE_SCHEDULE_ID,
    xp: {
      rai: true,
      raiProductType: form.category || 'Food & Catering',
      vegetarianOnlyEventEligible: form.vegetarianOnlyEventEligible,
      vegetarianByDefault: form.flavours.includes('Vegetarian') || form.flavours.includes('Margherita'),
      allergens: ['gluten', 'dairy'],
      requiresKitchenPrep: true,
      demoManagedBy: 'RAI Event Setup',
      baseDemoPrice: price,
      // Demo-scoped event option rules: OrderCloud specs are product-scoped, so the storefront can use this XP
      // to filter toppings per event. Production may model toppings as add-on products or a formal event option
      // configuration when independent pricing or fulfillment is needed.
      eventOptionRules: [
        {
          eventWebsiteLabel: 'Vegetarian-only Event',
          catalogID: 'VEGETARIAN_EVENT_CATALOG',
          optionGroup: 'Toppings',
          excludedOptions: ['Pepperoni', 'Ham'],
          reason: 'Vegetarian-only event',
        },
      ],
    },
  }

  try {
    await Products.Get(RAI_PRODUCT_ID)
    await Products.Patch(RAI_PRODUCT_ID, product)
    return 'Product created/updated: patched existing Pizza product.'
  } catch (error) {
    if (!isNotFound(error)) throw new Error(`Product setup failed: ${getReadableErrorMessage(error)}`)
    await Products.Create(product)
    return 'Product created/updated: created Pizza product.'
  }
}

const upsertPriceSchedule = async (price: number, currency: string) => {
  const priceSchedule: PriceSchedule = {
    ID: RAI_PRICE_SCHEDULE_ID,
    Name: 'Pizza Default Price',
    MinQuantity: 1,
    Currency: currency || 'EUR',
    PriceBreaks: [{ Quantity: 1, Price: price }],
  }

  try {
    await PriceSchedules.Get(RAI_PRICE_SCHEDULE_ID)
    await PriceSchedules.Patch(RAI_PRICE_SCHEDULE_ID, priceSchedule)
    return 'Price schedule created/updated: patched Pizza Default Price.'
  } catch (error) {
    if (!isNotFound(error)) throw new Error(`Price setup failed: ${getReadableErrorMessage(error)}`)
    await PriceSchedules.Create(priceSchedule)
    return 'Price schedule created/updated: created Pizza Default Price.'
  }
}

const upsertSpecWithOptions = async (specConfig: typeof SPEC_CONFIG[number], form: RaiProductSetupForm): Promise<RaiProductSpecResult> => {
  const spec: Spec = {
    ID: specConfig.id,
    Name: specConfig.name,
    Required: specConfig.formKey !== 'toppings',
    DefinesVariant: false,
    AllowOpenText: false,
    xp: { demoManagedBy: 'RAI Event Setup' },
  }
  await Specs.Save(specConfig.id, spec)

  const optionIDs = await Promise.all(form[specConfig.formKey].map(async (value, index) => {
    const optionID = sanitizeOptionID(value)
    await Specs.SaveOption(specConfig.id, optionID, { ID: optionID, Value: value, ListOrder: index + 1 })
    return optionID
  }))

  await Specs.SaveProductAssignment({ SpecID: specConfig.id, ProductID: RAI_PRODUCT_ID })
  return { specID: specConfig.id, name: specConfig.name, optionIDs }
}

const assignProductToCatalogs = async (eventWebsites: string[]) => {
  const assignedCatalogIDs: string[] = []
  const skippedCatalogs: RaiSkippedCatalog[] = []

  for (const eventWebsiteLabel of eventWebsites) {
    const config = RAI_EVENT_CATALOGS.find((item) => item.eventWebsiteLabel === eventWebsiteLabel)
    if (!config) {
      skippedCatalogs.push({ eventWebsiteLabel, reason: 'No demo catalog mapping is configured yet.' })
      continue
    }

    try {
      await Catalogs.Get(config.catalogID)
      await Catalogs.SaveProductAssignment({ CatalogID: config.catalogID, ProductID: RAI_PRODUCT_ID })
      assignedCatalogIDs.push(config.catalogID)
    } catch (error) {
      if (!isNotFound(error)) throw new Error(`Publishing to ${eventWebsiteLabel} failed: ${getReadableErrorMessage(error)}`)
      skippedCatalogs.push({ eventWebsiteLabel, catalogID: config.catalogID, reason: 'Catalog was not found in this environment.' })
    }
  }

  return { assignedCatalogIDs, skippedCatalogs }
}

export const createOrUpdateRaiEventProduct = async (form: RaiProductSetupForm): Promise<RaiProductSetupResult> => {
  const price = parsePrice(form.basePrice)
  const technicalSummary: string[] = []

  technicalSummary.push(await upsertPriceSchedule(price, form.currency))
  technicalSummary.push(await upsertProduct(form, price))
  const specs = await Promise.all(SPEC_CONFIG.map((specConfig) => upsertSpecWithOptions(specConfig, form)))
  technicalSummary.push(`Specs/options created/updated: ${specs.map((spec) => spec.specID).join(', ')}.`)

  const { assignedCatalogIDs, skippedCatalogs } = await assignProductToCatalogs(form.eventWebsites)
  technicalSummary.push(`Catalog product assignments created/updated: ${assignedCatalogIDs.length ? assignedCatalogIDs.join(', ') : 'none'}.`)
  technicalSummary.push('XP event option rules saved for vegetarian-only topping filtering.')

  return {
    productID: RAI_PRODUCT_ID,
    priceScheduleID: RAI_PRICE_SCHEDULE_ID,
    defaultPrice: price,
    currency: form.currency || 'EUR',
    specs,
    createdOrUpdatedSpecIDs: specs.map((spec) => spec.specID),
    assignedCatalogIDs,
    skippedCatalogs,
    warnings: skippedCatalogs.map((catalog) => `${catalog.eventWebsiteLabel}: ${catalog.reason}`),
    technicalSummary,
  }
}

export const submitRaiProductSetup = createOrUpdateRaiEventProduct

export const submitRaiBuyerSetup = async (form: RaiBuyerSetupForm) => {
  // TODO: Wire this Phase 2 stub to OrderCloud Buyers, Users, catalog access, product assignment, and pricing mutations.
  return previewRaiBuyerSetup(form)
}
