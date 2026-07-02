import {
  Buyers,
  Catalogs,
  OrderCloudError,
  PriceSchedules,
  Products,
  SecurityProfiles,
  Users,
  Specs,
  Product,
  PriceSchedule,
  Spec,
  Buyer,
  User,
  Catalog,
} from 'ordercloud-javascript-sdk'
import {
  RaiBuyerSetupForm,
  RaiBuyerSetupResult,
  RaiEventCatalogConfig,
  RaiProductSetupForm,
  RaiProductSetupResult,
  RaiProductSpecResult,
  RaiSkippedCatalog,
  RaiDemoReadinessResult,
  RaiPrepareDemoEventWebsitesResult,
  RaiReadinessItem,
  RaiDeleteDemoDataResult,
} from './types'

const RAI_PRODUCT_ID = 'RAI_PIZZA'
const RAI_PRICE_SCHEDULE_ID = 'RAI_PIZZA_DEFAULT_PRICE'
const RAI_DEMO_MANAGER = 'RAI Event Setup'
const DEFAULT_DEMO_BUYER_ID = 'RAI_EXHIBITOR_BLUE_OCEAN_EXHIBITS_ISE_2026'
const DEFAULT_DEMO_BUYER_USER_ID = 'RAI_BUYER_ALEX_DEMO_ISE_2026'

const RAI_EVENT_CATALOGS: RaiEventCatalogConfig[] = [
  { eventWebsiteLabel: 'ISE 2026', catalogID: 'ISE_2026_CATALOG' },
  { eventWebsiteLabel: 'Interclean 2026', catalogID: 'INTERCLEAN_2026_CATALOG' },
  { eventWebsiteLabel: 'RAI Catering Portal', catalogID: 'RAI_CATERING_CATALOG' },
  { eventWebsiteLabel: 'Vegetarian-only Event', catalogID: 'VEGETARIAN_EVENT_CATALOG' },
]
const REQUIRED_DEMO_CATALOG_IDS = ['ISE_2026_CATALOG', 'RAI_CATERING_CATALOG', 'VEGETARIAN_EVENT_CATALOG']

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

const sanitizeID = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const getSelectedEventWebsiteLabel = (form: RaiBuyerSetupForm) => form.eventWebsites[0] || form.eventName || 'ISE 2026'

const resolveEventCatalog = (eventWebsiteLabel: string) => RAI_EVENT_CATALOGS.find((item) => item.eventWebsiteLabel === eventWebsiteLabel)

const getBuyerID = (form: RaiBuyerSetupForm) => {
  const companyID = sanitizeID(form.companyName || 'BLUE_OCEAN_EXHIBITS')
  const eventID = sanitizeID(getSelectedEventWebsiteLabel(form) || 'ISE_2026')
  return `RAI_EXHIBITOR_${companyID}_${eventID}`
}

const getBuyerUserID = (form: RaiBuyerSetupForm) => {
  const localPart = form.email.split('@')[0] || `${form.firstName}.${form.lastName}`
  const userID = sanitizeID(localPart.replace(/\bdemo\b/gi, 'DEMO'))
  const eventID = sanitizeID(getSelectedEventWebsiteLabel(form) || 'ISE_2026')
  return `RAI_BUYER_${userID}_${eventID}`
}

const upsertBuyer = async (form: RaiBuyerSetupForm, buyerID: string, eventWebsiteLabel: string, catalogID?: string) => {
  const buyer: Buyer = {
    ID: buyerID,
    Name: form.companyName || 'Blue Ocean Exhibits',
    Active: true,
    xp: {
      rai: true,
      demoManagedBy: RAI_DEMO_MANAGER,
      eventID: form.eventName || eventWebsiteLabel,
      eventWebsiteLabel,
      catalogID,
      boothNumber: form.boothNumber || '12-A40',
      externalExhibitorID: `RAI-${sanitizeID(form.companyName || 'BLUE_OCEAN')}`,
      priceTier: form.pricingTier || 'Standard exhibitor pricing',
      buyerType: 'Exhibitor',
    },
  }

  try {
    await Buyers.Get(buyerID)
    await Buyers.Patch(buyerID, buyer)
    return 'Buyer organization created/updated: patched existing exhibitor buyer.'
  } catch (error) {
    if (!isOrderCloudNotFound(error)) throw new Error(`Buyer organization setup failed: ${getReadableErrorMessage(error)}`)
    try {
      await Buyers.Create(buyer)
    } catch (createError) {
      throw new Error(`Buyer organization create failed after not-found lookup for ${buyerID}: ${getReadableErrorMessage(createError)}`)
    }
    return 'Buyer organization created/updated: created exhibitor buyer.'
  }
}

const upsertBuyerUser = async (form: RaiBuyerSetupForm, buyerID: string, buyerUserID: string, eventWebsiteLabel: string) => {
  const user: User = {
    ID: buyerUserID,
    Username: form.email,
    FirstName: form.firstName || 'Alex',
    LastName: form.lastName || 'Demo',
    Email: form.email,
    Active: true,
    xp: {
      rai: true,
      demoManagedBy: RAI_DEMO_MANAGER,
      eventWebsiteLabel,
      boothNumber: form.boothNumber || '12-A40',
    },
  }

  try {
    await Users.Get(buyerID, buyerUserID)
    await Users.Patch(buyerID, buyerUserID, user)
    return 'Buyer user created/updated: patched existing exhibitor contact.'
  } catch (error) {
    if (!isOrderCloudNotFound(error)) throw new Error(`Buyer user setup failed: ${getReadableErrorMessage(error)}`)
    try {
      await Users.Create(buyerID, user)
    } catch (createError) {
      throw new Error(`Buyer user create failed after not-found lookup for ${buyerID}/${buyerUserID}: ${getReadableErrorMessage(createError)}`)
    }
    return 'Buyer user created/updated: created exhibitor contact without sending an invite email.'
  }
}

const assignBuyerCatalogAccess = async (buyerID: string, eventWebsiteLabel: string, catalogID?: string) => {
  if (!catalogID) return { assigned: false, warning: `${eventWebsiteLabel}: This optional event website setup was not found in the demo environment. You can continue recording the main flow.`, summary: 'Catalog access skipped: no mapping is configured for the selected event website.' }

  try {
    await Catalogs.Get(catalogID)
    await Catalogs.SaveAssignment({ CatalogID: catalogID, BuyerID: buyerID, ViewAllCategories: true, ViewAllProducts: true })
    return { assigned: true, summary: `Catalog assignment created/updated: ${catalogID} assigned to ${buyerID}.` }
  } catch (error) {
    if (!isOrderCloudNotFound(error)) throw new Error(`Event website access setup failed: ${getReadableErrorMessage(error)}`)
    return { assigned: false, warning: `${eventWebsiteLabel}: This optional event website setup was not found in the demo environment. Prepare event websites, then run this step again.`, summary: `Catalog access skipped: ${catalogID} was not found.` }
  }
}

const PIZZA_PRICING_LOCALE_WARNING = 'Pizza pricing override was not applied because the buyer’s locale does not match the Pizza price currency. Event website access was still assigned.'

const assignPizzaPricing = async (buyerID: string, canWarnForOptionalAssignmentFailure: boolean) => {
  try {
    await Products.Get(RAI_PRODUCT_ID)
    await PriceSchedules.Get(RAI_PRICE_SCHEDULE_ID)
  } catch (error) {
    if (!isOrderCloudNotFound(error)) throw new Error(`Pizza pricing setup failed: ${getReadableErrorMessage(error)}`)
    return { assigned: false, exampleProductAvailable: false, warning: 'Pizza pricing was not found in the demo environment. Create the Pizza product setup, then run this step again.', summary: 'Product/pricing assignment skipped: Pizza product or default price schedule was not found.' }
  }

  try {
    await Products.SaveAssignment({ ProductID: RAI_PRODUCT_ID, BuyerID: buyerID, PriceScheduleID: RAI_PRICE_SCHEDULE_ID })
    return { assigned: true, exampleProductAvailable: true, summary: `Product/pricing assignment created/updated: ${RAI_PRODUCT_ID} uses ${RAI_PRICE_SCHEDULE_ID} for ${buyerID}.` }
  } catch (error) {
    if (isOrderCloudErrorCode(error, 'PriceSchedule.CurrencyMismatch')) {
      return { assigned: false, exampleProductAvailable: true, warning: PIZZA_PRICING_LOCALE_WARNING, summary: `Product/pricing assignment skipped: ${RAI_PRODUCT_ID} / ${RAI_PRICE_SCHEDULE_ID} for ${buyerID}. ${getReadableErrorMessage(error)}` }
    }
    if (canWarnForOptionalAssignmentFailure) {
      return { assigned: false, exampleProductAvailable: true, warning: 'Pizza pricing override was not applied. Event website access was still assigned.', summary: `Product/pricing assignment skipped: ${RAI_PRODUCT_ID} / ${RAI_PRICE_SCHEDULE_ID} for ${buyerID}. ${getReadableErrorMessage(error)}` }
    }
    throw new Error(`Pizza pricing setup failed: ${getReadableErrorMessage(error)}`)
  }
}

const assignDemoSecurityProfile = async (buyerID: string, buyerUserID: string) => {
  const candidateIDs = ['RAI_BUYER_SHOPPER', 'Storefront', 'storefront', 'Storefront Security Profile']

  for (const securityProfileID of candidateIDs) {
    try {
      await SecurityProfiles.Get(securityProfileID)
      await SecurityProfiles.SaveAssignment({ SecurityProfileID: securityProfileID, BuyerID: buyerID, UserID: buyerUserID })
      return { assigned: true, summary: `Security profile assignment created/updated: ${securityProfileID} assigned to buyer user.` }
    } catch (error) {
      if (!isOrderCloudNotFound(error)) throw new Error(`Buyer security setup failed: ${getReadableErrorMessage(error)}`)
    }
  }

  const shopperProfiles = await SecurityProfiles.List({ search: 'shopper', pageSize: 20 })
  const shopperProfile = shopperProfiles.Items.find((profile) => profile.Roles?.includes('Shopper'))
  if (shopperProfile?.ID) {
    await SecurityProfiles.SaveAssignment({ SecurityProfileID: shopperProfile.ID, BuyerID: buyerID, UserID: buyerUserID })
    return { assigned: true, summary: `Security profile assignment created/updated: ${shopperProfile.ID} assigned to buyer user.` }
  }

  return { assigned: false, warning: 'Shopper access profile was not found in this demo environment. You can continue recording the main flow.', summary: 'Security profile assignment skipped: no matching shopper security profile was found.' }
}

const getErrorNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

const getObjectValue = (value: unknown, key: string): unknown => {
  if (!value || typeof value !== 'object') return undefined
  return (value as Record<string, unknown>)[key]
}

const getOrderCloudErrorStatus = (error: unknown): number | undefined => {
  const directStatus = getErrorNumber(getObjectValue(error, 'status'))
  if (directStatus) return directStatus

  const directStatusCode = getErrorNumber(getObjectValue(error, 'statusCode'))
  if (directStatusCode) return directStatusCode

  const response = getObjectValue(error, 'response')
  const responseStatus = getErrorNumber(getObjectValue(response, 'status'))
  if (responseStatus) return responseStatus

  const responseStatusCode = getErrorNumber(getObjectValue(response, 'statusCode'))
  if (responseStatusCode) return responseStatusCode

  const data = getObjectValue(error, 'data') ?? getObjectValue(response, 'data')
  const dataStatus = getErrorNumber(getObjectValue(data, 'status'))
  if (dataStatus) return dataStatus

  const dataStatusCode = getErrorNumber(getObjectValue(data, 'statusCode'))
  if (dataStatusCode) return dataStatusCode

  return undefined
}

export const isOrderCloudNotFound = (error: unknown) => getOrderCloudErrorStatus(error) === 404

const getOrderCloudErrorDetails = (error: unknown) => {
  const status = getOrderCloudErrorStatus(error)
  const statusText = getObjectValue(error, 'statusText') ?? getObjectValue(getObjectValue(error, 'response'), 'statusText')
  const errorCode = getObjectValue(error, 'errorCode')
  const errors = getObjectValue(error, 'errors') ?? getObjectValue(getObjectValue(getObjectValue(error, 'response'), 'data'), 'Errors')
  const details = [
    status ? `status ${status}` : undefined,
    typeof statusText === 'string' && statusText ? statusText : undefined,
    typeof errorCode === 'string' && errorCode ? `code ${errorCode}` : undefined,
    Array.isArray(errors) && errors.length ? `errors ${JSON.stringify(errors)}` : undefined,
  ].filter(Boolean)
  return details.length ? ` (${details.join('; ')})` : ''
}

const getReadableErrorMessage = (error: unknown) => {
  const details = getOrderCloudErrorDetails(error)
  if (error instanceof OrderCloudError) return `${error.message}${details}`
  if (error instanceof Error) return `${error.message}${details}`
  return `OrderCloud could not complete the request.${details}`
}

const getOrderCloudErrorCode = (error: unknown) => {
  const directCode = getObjectValue(error, 'errorCode')
  if (typeof directCode === 'string') return directCode

  const errors = getObjectValue(error, 'errors') ?? getObjectValue(getObjectValue(getObjectValue(error, 'response'), 'data'), 'Errors')
  if (Array.isArray(errors)) {
    const firstErrorWithCode = errors.find((item) => item && typeof item === 'object' && typeof getObjectValue(item, 'ErrorCode') === 'string')
    if (firstErrorWithCode) return getObjectValue(firstErrorWithCode, 'ErrorCode') as string
  }

  return undefined
}

const isOrderCloudErrorCode = (error: unknown, errorCode: string) => getOrderCloudErrorCode(error) === errorCode

const hasRaiDemoMarker = (resource: { xp?: unknown }) => {
  const xp = resource.xp
  if (!xp || typeof xp !== 'object') return false
  const record = xp as Record<string, unknown>
  return record.demoManagedBy === RAI_DEMO_MANAGER || record.rai === true
}

const getResetStatus = (result: Omit<RaiDeleteDemoDataResult, 'overallStatus'>): RaiDeleteDemoDataResult['overallStatus'] => {
  if (!result.deletedItems.length && !result.skippedItems.length && !result.warnings.length) return 'already-clean'
  if (!result.deletedItems.length && (result.skippedItems.length || result.warnings.length)) return 'failed'
  if (result.skippedItems.length || result.warnings.length) return 'partial'
  return 'deleted'
}

const isRaiPriceSchedule = (priceSchedule: PriceSchedule) => priceSchedule.ID === RAI_PRICE_SCHEDULE_ID && priceSchedule.Name === 'Pizza Default Price'

const deleteIfFound = async <TResource extends { ID?: string; Name?: string; xp?: unknown }>(
  result: Omit<RaiDeleteDemoDataResult, 'overallStatus'>,
  label: string,
  id: string,
  getResource: () => Promise<TResource>,
  isSafeToDelete: (resource: TResource) => boolean,
  deleteResource: () => Promise<void>,
) => {
  try {
    const resource = await getResource()
    if (!isSafeToDelete(resource)) {
      const reason = 'Found the expected ID, but it does not have the RAI demo marker, so it was left untouched.'
      result.skippedItems.push({ label, id, reason })
      result.warnings.push(`${label} ${id}: ${reason}`)
      result.technicalSummary.push(`Skipped ${label} ${id}: safety marker check failed.`)
      return
    }
    await deleteResource()
    result.deletedItems.push(`${label}: ${id}`)
    result.technicalSummary.push(`Deleted ${label}: ${id}.`)
  } catch (error) {
    if (isOrderCloudNotFound(error)) {
      result.notFoundItems.push(`${label}: ${id}`)
      result.technicalSummary.push(`Already clean: ${label} ${id} was not found.`)
      return
    }
    const warning = `${label} ${id}: ${getReadableErrorMessage(error)}`
    result.skippedItems.push({ label, id, reason: warning })
    result.warnings.push(warning)
    result.technicalSummary.push(`Could not delete ${label} ${id}: ${getReadableErrorMessage(error)}`)
  }
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
      demoManagedBy: RAI_DEMO_MANAGER,
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
    if (!isOrderCloudNotFound(error)) throw new Error(`Product setup failed: ${getReadableErrorMessage(error)}`)
    try {
      await Products.Create(product)
    } catch (createError) {
      throw new Error(`Product create failed after not-found lookup for ${RAI_PRODUCT_ID}: ${getReadableErrorMessage(createError)}`)
    }
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
    if (!isOrderCloudNotFound(error)) throw new Error(`Price setup failed: ${getReadableErrorMessage(error)}`)
    try {
      await PriceSchedules.Create(priceSchedule)
    } catch (createError) {
      throw new Error(`Price schedule create failed after not-found lookup for ${RAI_PRICE_SCHEDULE_ID}: ${getReadableErrorMessage(createError)}`)
    }
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
    xp: { demoManagedBy: RAI_DEMO_MANAGER },
  }
  try {
    await Specs.Save(specConfig.id, spec)
  } catch (error) {
    throw new Error(`Spec save failed for ${specConfig.id}: ${getReadableErrorMessage(error)}`)
  }

  const optionIDs = await Promise.all(form[specConfig.formKey].map(async (value, index) => {
    const optionID = sanitizeOptionID(value)
    try {
      await Specs.SaveOption(specConfig.id, optionID, { ID: optionID, Value: value, ListOrder: index + 1 })
    } catch (error) {
      throw new Error(`Spec option save failed for ${specConfig.id}/${optionID}: ${getReadableErrorMessage(error)}`)
    }
    return optionID
  }))

  try {
    await Specs.SaveProductAssignment({ SpecID: specConfig.id, ProductID: RAI_PRODUCT_ID })
  } catch (error) {
    throw new Error(`Spec product assignment failed for ${specConfig.id}/${RAI_PRODUCT_ID}: ${getReadableErrorMessage(error)}`)
  }
  return { specID: specConfig.id, name: specConfig.name, optionIDs }
}

const assignProductToCatalogs = async (eventWebsites: string[]) => {
  const assignedCatalogIDs: string[] = []
  const skippedCatalogs: RaiSkippedCatalog[] = []

  for (const eventWebsiteLabel of eventWebsites) {
    const config = RAI_EVENT_CATALOGS.find((item) => item.eventWebsiteLabel === eventWebsiteLabel)
    if (!config) {
      skippedCatalogs.push({ eventWebsiteLabel, reason: 'This optional setup was not found in the demo environment.' })
      continue
    }

    try {
      await Catalogs.Get(config.catalogID)
      await Catalogs.SaveProductAssignment({ CatalogID: config.catalogID, ProductID: RAI_PRODUCT_ID })
      assignedCatalogIDs.push(config.catalogID)
    } catch (error) {
      if (!isOrderCloudNotFound(error)) throw new Error(`Publishing to ${eventWebsiteLabel} failed: ${getReadableErrorMessage(error)}`)
      skippedCatalogs.push({ eventWebsiteLabel, catalogID: config.catalogID, reason: 'Prepare event websites, then run this step again.' })
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

export const createOrUpdateRaiExhibitorBuyer = async (form: RaiBuyerSetupForm): Promise<RaiBuyerSetupResult> => {
  const eventWebsiteLabel = getSelectedEventWebsiteLabel(form)
  const catalogConfig = resolveEventCatalog(eventWebsiteLabel)
  const buyerID = getBuyerID(form)
  const buyerUserID = getBuyerUserID(form)
  const warnings: string[] = []
  const technicalSummary: string[] = []

  technicalSummary.push(await upsertBuyer(form, buyerID, eventWebsiteLabel, catalogConfig?.catalogID))
  technicalSummary.push(await upsertBuyerUser(form, buyerID, buyerUserID, eventWebsiteLabel))

  const catalogResult = await assignBuyerCatalogAccess(buyerID, eventWebsiteLabel, catalogConfig?.catalogID)
  technicalSummary.push(catalogResult.summary)
  if (catalogResult.warning) warnings.push(catalogResult.warning)

  const pricingResult = await assignPizzaPricing(buyerID, catalogResult.assigned)
  technicalSummary.push(pricingResult.summary)
  if (pricingResult.warning) warnings.push(pricingResult.warning)

  const securityResult = await assignDemoSecurityProfile(buyerID, buyerUserID)
  technicalSummary.push(securityResult.summary)
  if (securityResult.warning) warnings.push(securityResult.warning)

  return {
    buyerID,
    buyerUserID,
    username: form.email,
    email: form.email,
    eventWebsiteLabel,
    catalogID: catalogConfig?.catalogID,
    catalogAccessAssigned: catalogResult.assigned,
    productPricingAssigned: pricingResult.assigned,
    securityProfileAssigned: securityResult.assigned,
    boothNumber: form.boothNumber || '12-A40',
    priceTier: form.pricingTier || 'Standard exhibitor pricing',
    exampleProductAvailable: pricingResult.exampleProductAvailable || catalogResult.assigned,
    warnings,
    technicalSummary,
  }
}

export const submitRaiBuyerSetup = createOrUpdateRaiExhibitorBuyer

const deleteAssignmentIfPresent = async (
  result: Omit<RaiDeleteDemoDataResult, 'overallStatus'>,
  label: string,
  id: string,
  deleteAssignment: () => Promise<void>,
) => {
  try {
    await deleteAssignment()
    result.deletedItems.push(`${label}: ${id}`)
    result.technicalSummary.push(`Removed ${label}: ${id}.`)
  } catch (error) {
    if (isOrderCloudNotFound(error)) {
      result.notFoundItems.push(`${label}: ${id}`)
      result.technicalSummary.push(`Already clean: ${label} ${id} was not assigned.`)
      return
    }
    const warning = `${label} ${id}: ${getReadableErrorMessage(error)}`
    result.skippedItems.push({ label, id, reason: warning })
    result.warnings.push(warning)
    result.technicalSummary.push(`Could not remove ${label} ${id}: ${getReadableErrorMessage(error)}`)
  }
}

export const deleteRaiDemoData = async (): Promise<RaiDeleteDemoDataResult> => {
  const result: Omit<RaiDeleteDemoDataResult, 'overallStatus'> = {
    deletedItems: [],
    skippedItems: [],
    notFoundItems: [],
    warnings: [],
    technicalSummary: [
      'Reset deletes only stable RAI demo IDs and verifies RAI demo markers before deleting catalogs, product, specs, buyer, and buyer user.',
    ],
  }

  await deleteAssignmentIfPresent(result, 'Pizza pricing assignment', `${RAI_PRODUCT_ID} / ${DEFAULT_DEMO_BUYER_ID}`, () => Products.DeleteAssignment(RAI_PRODUCT_ID, DEFAULT_DEMO_BUYER_ID))

  for (const config of RAI_EVENT_CATALOGS) {
    await deleteAssignmentIfPresent(result, 'Buyer catalog access', `${config.catalogID} / ${DEFAULT_DEMO_BUYER_ID}`, () => Catalogs.DeleteAssignment(config.catalogID, { buyerID: DEFAULT_DEMO_BUYER_ID }))
    await deleteAssignmentIfPresent(result, 'Catalog product publishing', `${config.catalogID} / ${RAI_PRODUCT_ID}`, () => Catalogs.DeleteProductAssignment(config.catalogID, RAI_PRODUCT_ID))
  }

  try {
    const assignments = await SecurityProfiles.ListAssignments({ buyerID: DEFAULT_DEMO_BUYER_ID, userID: DEFAULT_DEMO_BUYER_USER_ID, pageSize: 100 })
    if (!assignments.Items.length) {
      result.notFoundItems.push(`Shopper access assignment: ${DEFAULT_DEMO_BUYER_USER_ID}`)
      result.technicalSummary.push(`Already clean: no security profile assignments found for ${DEFAULT_DEMO_BUYER_USER_ID}.`)
    }
    for (const assignment of assignments.Items) {
      if (!assignment.SecurityProfileID) continue
      await deleteAssignmentIfPresent(result, 'Shopper access assignment', `${assignment.SecurityProfileID} / ${DEFAULT_DEMO_BUYER_USER_ID}`, () => SecurityProfiles.DeleteAssignment(assignment.SecurityProfileID as string, { buyerID: DEFAULT_DEMO_BUYER_ID, userID: DEFAULT_DEMO_BUYER_USER_ID }))
    }
  } catch (error) {
    if (isOrderCloudNotFound(error)) {
      result.notFoundItems.push(`Shopper access assignment: ${DEFAULT_DEMO_BUYER_USER_ID}`)
      result.technicalSummary.push(`Already clean: shopper access assignments for ${DEFAULT_DEMO_BUYER_USER_ID} were not found.`)
    } else {
      const warning = `Shopper access assignments: ${getReadableErrorMessage(error)}`
      result.skippedItems.push({ label: 'Shopper access assignments', id: DEFAULT_DEMO_BUYER_USER_ID, reason: warning })
      result.warnings.push(warning)
      result.technicalSummary.push(`Could not check shopper access assignments: ${getReadableErrorMessage(error)}`)
    }
  }

  await deleteIfFound(result, 'Buyer contact', DEFAULT_DEMO_BUYER_USER_ID, () => Users.Get(DEFAULT_DEMO_BUYER_ID, DEFAULT_DEMO_BUYER_USER_ID), hasRaiDemoMarker, () => Users.Delete(DEFAULT_DEMO_BUYER_ID, DEFAULT_DEMO_BUYER_USER_ID))
  await deleteIfFound(result, 'Blue Ocean Exhibits buyer', DEFAULT_DEMO_BUYER_ID, () => Buyers.Get(DEFAULT_DEMO_BUYER_ID), hasRaiDemoMarker, () => Buyers.Delete(DEFAULT_DEMO_BUYER_ID))

  for (const specConfig of SPEC_CONFIG) {
    await deleteAssignmentIfPresent(result, 'Pizza option assignment', `${specConfig.id} / ${RAI_PRODUCT_ID}`, () => Specs.DeleteProductAssignment(specConfig.id, RAI_PRODUCT_ID))
  }

  await deleteIfFound(result, 'Pizza product setup', RAI_PRODUCT_ID, () => Products.Get(RAI_PRODUCT_ID), hasRaiDemoMarker, () => Products.Delete(RAI_PRODUCT_ID))

  for (const specConfig of SPEC_CONFIG) {
    await deleteIfFound(result, 'Pizza option group', specConfig.id, () => Specs.Get(specConfig.id), hasRaiDemoMarker, () => Specs.Delete(specConfig.id))
  }

  await deleteIfFound(result, 'Pizza price schedule', RAI_PRICE_SCHEDULE_ID, () => PriceSchedules.Get(RAI_PRICE_SCHEDULE_ID), isRaiPriceSchedule, () => PriceSchedules.Delete(RAI_PRICE_SCHEDULE_ID))

  for (const config of RAI_EVENT_CATALOGS) {
    await deleteIfFound(result, 'Demo event website', config.catalogID, () => Catalogs.Get(config.catalogID), hasRaiDemoMarker, () => Catalogs.Delete(config.catalogID))
  }

  return {
    ...result,
    overallStatus: getResetStatus(result),
  }
}

export const resetRaiDemoData = deleteRaiDemoData

const getCatalogDescription = (eventWebsiteLabel: string) => {
  if (eventWebsiteLabel === 'Vegetarian-only Event') return 'Demo event website for vegetarian-only catering visibility.'
  if (eventWebsiteLabel === 'RAI Catering Portal') return 'Demo catering portal for reusable food and beverage products.'
  return `Demo event website for ${eventWebsiteLabel} exhibitors.`
}

const getCatalogPatch = (config: RaiEventCatalogConfig): Catalog => ({
  ID: config.catalogID,
  Name: config.eventWebsiteLabel,
  Description: getCatalogDescription(config.eventWebsiteLabel),
  Active: true,
  xp: {
    rai: true,
    demoManagedBy: RAI_DEMO_MANAGER,
    eventWebsiteLabel: config.eventWebsiteLabel,
    demoEventWebsite: true,
    vegetarianOnly: config.catalogID === 'VEGETARIAN_EVENT_CATALOG' || undefined,
    description: getCatalogDescription(config.eventWebsiteLabel),
    useCase: config.eventWebsiteLabel === 'Vegetarian-only Event' ? 'Show event-specific product option filtering.' : 'Support the RAI admin demo recording flow.',
  },
})

const getReadinessStatus = (items: RaiReadinessItem[]): RaiDemoReadinessResult['overallStatus'] => {
  if (items.some((item) => item.status === 'missing')) return 'not-ready'
  if (items.some((item) => item.status === 'warning' || item.status === 'unchecked')) return 'partial'
  return 'ready'
}

const checkGet = async (label: string, technicalID: string, getter: () => Promise<object>, requireActive = false): Promise<RaiReadinessItem> => {
  try {
    const item = await getter()
    if (requireActive && 'Active' in item && item.Active === false) return { label, status: 'warning', message: 'Found, but it is not active yet.', technicalID }
    return { label, status: 'ready', message: 'Ready', technicalID }
  } catch (error) {
    if (isOrderCloudNotFound(error)) return { label, status: 'missing', message: 'Not found in the demo environment yet.', technicalID }
    return { label, status: 'warning', message: `This optional setup could not be checked. You can continue recording the main flow if the core steps are visible. ${getReadableErrorMessage(error)}`, technicalID }
  }
}

export const prepareRaiDemoEventWebsites = async (selectedCatalogIDs?: string[]): Promise<RaiPrepareDemoEventWebsitesResult> => {
  const createdCatalogIDs: string[] = []
  const updatedCatalogIDs: string[] = []
  const skippedCatalogIDs: string[] = []
  const warnings: string[] = []
  const technicalSummary: string[] = []
  const selectedIDs = new Set(selectedCatalogIDs?.length ? selectedCatalogIDs : RAI_EVENT_CATALOGS.map((config) => config.catalogID))

  for (const config of RAI_EVENT_CATALOGS) {
    if (!selectedIDs.has(config.catalogID)) {
      skippedCatalogIDs.push(config.catalogID)
      technicalSummary.push(`Event website skipped by selection: ${config.catalogID}.`)
      continue
    }
    const catalog = getCatalogPatch(config)
    try {
      await Catalogs.Get(config.catalogID)
      await Catalogs.Patch(config.catalogID, catalog)
      updatedCatalogIDs.push(config.catalogID)
      technicalSummary.push(`Event website updated: ${config.catalogID}.`)
    } catch (error) {
      if (!isOrderCloudNotFound(error)) {
        const warning = `${config.eventWebsiteLabel}: This optional setup could not be prepared. You can continue recording the main flow or try again later. ${getReadableErrorMessage(error)}`
        warnings.push(warning)
        technicalSummary.push(warning)
        continue
      }
      try {
        await Catalogs.Create(catalog)
      } catch (createError) {
        const warning = `${config.eventWebsiteLabel}: Event website create failed after not-found lookup for ${config.catalogID}: ${getReadableErrorMessage(createError)}`
        warnings.push(warning)
        technicalSummary.push(warning)
        continue
      }
      createdCatalogIDs.push(config.catalogID)
      technicalSummary.push(`Event website created: ${config.catalogID}.`)
    }
  }

  return { createdCatalogIDs, updatedCatalogIDs, skippedCatalogIDs, warnings, technicalSummary }
}

export const getRaiDemoReadiness = async (): Promise<RaiDemoReadinessResult> => {
  const warnings: string[] = []
  const eventWebsites = await Promise.all(RAI_EVENT_CATALOGS.map(async (config) => {
    const item = await checkGet(config.eventWebsiteLabel, config.catalogID, () => Catalogs.Get(config.catalogID), true)
    if (item.status === 'missing' && !REQUIRED_DEMO_CATALOG_IDS.includes(config.catalogID)) return { ...item, status: 'warning' as const, message: 'Optional event website has not been prepared yet.' }
    return item
  }))

  const product = await checkGet('Product', RAI_PRODUCT_ID, () => Products.Get(RAI_PRODUCT_ID), true)
  const price = await checkGet('Price', RAI_PRICE_SCHEDULE_ID, () => PriceSchedules.Get(RAI_PRICE_SCHEDULE_ID))
  const specItems = await Promise.all(SPEC_CONFIG.map((spec) => checkGet(spec.name, spec.id, () => Specs.Get(spec.id))))
  const optionsStatus: RaiReadinessItem = specItems.every((item) => item.status === 'ready')
    ? { label: 'Options', status: 'ready', message: 'Size, flavour, and topping options are ready.', technicalID: SPEC_CONFIG.map((spec) => spec.id).join(', ') }
    : { label: 'Options', status: specItems.some((item) => item.status === 'missing') ? 'missing' : 'warning', message: specItems.filter((item) => item.status !== 'ready').map((item) => `${item.label}: ${item.message}`).join(' · '), technicalID: SPEC_CONFIG.map((spec) => spec.id).join(', ') }
  const productSetup = [product, price, optionsStatus]

  const buyer = await checkGet('Buyer organization', DEFAULT_DEMO_BUYER_ID, () => Buyers.Get(DEFAULT_DEMO_BUYER_ID), true)
  const user = await checkGet('Buyer user', DEFAULT_DEMO_BUYER_USER_ID, () => Users.Get(DEFAULT_DEMO_BUYER_ID, DEFAULT_DEMO_BUYER_USER_ID), true)

  const catalogAssignments = await Catalogs.ListAssignments({ catalogID: 'ISE_2026_CATALOG', buyerID: DEFAULT_DEMO_BUYER_ID, pageSize: 1 })
  const iseAccess: RaiReadinessItem = catalogAssignments.Items.length
    ? { label: 'ISE 2026 access', status: 'ready', message: 'Exhibitor access is assigned.', technicalID: 'ISE_2026_CATALOG' }
    : { label: 'ISE 2026 access', status: 'missing', message: 'Prepare event websites, then run the buyer setup again.', technicalID: 'ISE_2026_CATALOG' }

  const productAssignments = await Products.ListAssignments({ productID: RAI_PRODUCT_ID, buyerID: DEFAULT_DEMO_BUYER_ID, priceScheduleID: RAI_PRICE_SCHEDULE_ID, pageSize: 1 })
  const pizzaPricing: RaiReadinessItem = productAssignments.Items.length
    ? { label: 'Pizza pricing', status: 'ready', message: 'Pizza pricing is assigned.', technicalID: `${RAI_PRODUCT_ID} / ${RAI_PRICE_SCHEDULE_ID}` }
    : { label: 'Pizza pricing', status: 'missing', message: 'Create the Pizza product setup, then run the buyer setup again.', technicalID: `${RAI_PRODUCT_ID} / ${RAI_PRICE_SCHEDULE_ID}` }

  const securityAssignments = await SecurityProfiles.ListAssignments({ buyerID: DEFAULT_DEMO_BUYER_ID, userID: DEFAULT_DEMO_BUYER_USER_ID, pageSize: 20 })
  const shopperAccess: RaiReadinessItem = securityAssignments.Items.length
    ? { label: 'Shopper access/security profile', status: 'ready', message: 'Shopper-style access is assigned.', technicalID: securityAssignments.Items.map((item) => item.SecurityProfileID).filter(Boolean).join(', ') }
    : { label: 'Shopper access/security profile', status: 'warning', message: 'Shopper access profile was not found in this demo environment. You can continue recording the main flow.', technicalID: 'SecurityProfiles.ListAssignments' }
  if (shopperAccess.status === 'warning') warnings.push('Shopper access/security profile: Shopper access profile was not found in this demo environment. You can continue recording the main flow.')

  const buyerSetup = [buyer, user, iseAccess, pizzaPricing, shopperAccess]
  const allItems = [...eventWebsites, ...productSetup, ...buyerSetup]
  warnings.push(...allItems.filter((item) => item.status === 'missing' || item.status === 'warning').map((item) => `${item.label}: ${item.message || item.status}`))
  const eventWebsitesReady = eventWebsites.filter((item) => REQUIRED_DEMO_CATALOG_IDS.includes(item.technicalID || '')).every((item) => item.status === 'ready')
  const pizzaSetupReady = productSetup.every((item) => item.status === 'ready')
  const exhibitorSetupReady = [buyer, user, iseAccess].every((item) => item.status === 'ready')
  const readyToRecord = eventWebsitesReady && pizzaSetupReady && exhibitorSetupReady

  return {
    overallStatus: getReadinessStatus(allItems),
    eventWebsitesReady,
    pizzaSetupReady,
    exhibitorSetupReady,
    readyToRecord,
    canCreatePizza: eventWebsitesReady,
    canRegisterBuyer: eventWebsitesReady && pizzaSetupReady,
    canRunFinalReadinessCheck: readyToRecord,
    eventWebsites,
    productSetup,
    buyerSetup,
    warnings,
    technicalSummary: [
      `Catalog IDs: ${RAI_EVENT_CATALOGS.map((catalog) => catalog.catalogID).join(', ')}`,
      `Product ID: ${RAI_PRODUCT_ID}`,
      `Price schedule ID: ${RAI_PRICE_SCHEDULE_ID}`,
      `Spec IDs: ${SPEC_CONFIG.map((spec) => spec.id).join(', ')}`,
      `Buyer ID: ${DEFAULT_DEMO_BUYER_ID}`,
      `Buyer user ID: ${DEFAULT_DEMO_BUYER_USER_ID}`,
      ...warnings,
    ],
  }
}

export const checkRaiDemoReadiness = getRaiDemoReadiness
