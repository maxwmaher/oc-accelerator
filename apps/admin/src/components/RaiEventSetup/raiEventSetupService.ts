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
    if (!isNotFound(error)) throw new Error(`Buyer organization setup failed: ${getReadableErrorMessage(error)}`)
    await Buyers.Create(buyer)
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
    if (!isNotFound(error)) throw new Error(`Buyer user setup failed: ${getReadableErrorMessage(error)}`)
    await Users.Create(buyerID, user)
    return 'Buyer user created/updated: created exhibitor contact without sending an invite email.'
  }
}

const assignBuyerCatalogAccess = async (buyerID: string, eventWebsiteLabel: string, catalogID?: string) => {
  if (!catalogID) return { assigned: false, warning: `${eventWebsiteLabel}: No demo catalog mapping is configured yet.`, summary: 'Catalog assignment skipped: no mapping is configured for the selected event website.' }

  try {
    await Catalogs.Get(catalogID)
    await Catalogs.SaveAssignment({ CatalogID: catalogID, BuyerID: buyerID, ViewAllCategories: true, ViewAllProducts: true })
    return { assigned: true, summary: `Catalog assignment created/updated: ${catalogID} assigned to ${buyerID}.` }
  } catch (error) {
    if (!isNotFound(error)) throw new Error(`Event website access setup failed: ${getReadableErrorMessage(error)}`)
    return { assigned: false, warning: `${eventWebsiteLabel}: Event website access could not be assigned because catalog ${catalogID} was not found.`, summary: `Catalog assignment skipped: ${catalogID} was not found.` }
  }
}

const assignPizzaPricing = async (buyerID: string) => {
  try {
    await Products.Get(RAI_PRODUCT_ID)
    await PriceSchedules.Get(RAI_PRICE_SCHEDULE_ID)
    await Products.SaveAssignment({ ProductID: RAI_PRODUCT_ID, BuyerID: buyerID, PriceScheduleID: RAI_PRICE_SCHEDULE_ID })
    return { assigned: true, exampleProductAvailable: true, summary: `Product/pricing assignment created/updated: ${RAI_PRODUCT_ID} uses ${RAI_PRICE_SCHEDULE_ID} for ${buyerID}.` }
  } catch (error) {
    if (!isNotFound(error)) throw new Error(`Pizza pricing setup failed: ${getReadableErrorMessage(error)}`)
    return { assigned: false, exampleProductAvailable: false, warning: 'Pizza pricing override was not applied because the Pizza product or default price schedule was not found.', summary: 'Product/pricing assignment skipped: Pizza product or default price schedule was not found.' }
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
      if (!isNotFound(error)) throw new Error(`Buyer security setup failed: ${getReadableErrorMessage(error)}`)
    }
  }

  const shopperProfiles = await SecurityProfiles.List({ search: 'shopper', pageSize: 20 })
  const shopperProfile = shopperProfiles.Items.find((profile) => profile.Roles?.includes('Shopper'))
  if (shopperProfile?.ID) {
    await SecurityProfiles.SaveAssignment({ SecurityProfileID: shopperProfile.ID, BuyerID: buyerID, UserID: buyerUserID })
    return { assigned: true, summary: `Security profile assignment created/updated: ${shopperProfile.ID} assigned to buyer user.` }
  }

  return { assigned: false, warning: 'Buyer user was created, but no demo buyer security profile was assigned because no matching security profile was found.', summary: 'Security profile assignment skipped: no matching shopper security profile was found.' }
}

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
    xp: { demoManagedBy: RAI_DEMO_MANAGER },
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

  const pricingResult = await assignPizzaPricing(buyerID)
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
    if (requireActive && 'Active' in item && item.Active === false) return { label, status: 'warning', message: 'Found but not active.', technicalID }
    return { label, status: 'ready', message: 'Ready', technicalID }
  } catch (error) {
    if (isNotFound(error)) return { label, status: 'missing', message: 'Missing', technicalID }
    return { label, status: 'warning', message: getReadableErrorMessage(error), technicalID }
  }
}

export const prepareRaiDemoEventWebsites = async (): Promise<RaiPrepareDemoEventWebsitesResult> => {
  const createdCatalogIDs: string[] = []
  const updatedCatalogIDs: string[] = []
  const warnings: string[] = []
  const technicalSummary: string[] = []

  for (const config of RAI_EVENT_CATALOGS) {
    const catalog = getCatalogPatch(config)
    try {
      await Catalogs.Get(config.catalogID)
      await Catalogs.Patch(config.catalogID, catalog)
      updatedCatalogIDs.push(config.catalogID)
      technicalSummary.push(`Event website updated: ${config.catalogID}.`)
    } catch (error) {
      if (!isNotFound(error)) {
        const warning = `${config.eventWebsiteLabel} could not be prepared: ${getReadableErrorMessage(error)}`
        warnings.push(warning)
        technicalSummary.push(warning)
        continue
      }
      await Catalogs.Create(catalog)
      createdCatalogIDs.push(config.catalogID)
      technicalSummary.push(`Event website created: ${config.catalogID}.`)
    }
  }

  return { createdCatalogIDs, updatedCatalogIDs, warnings, technicalSummary }
}

export const getRaiDemoReadiness = async (): Promise<RaiDemoReadinessResult> => {
  const warnings: string[] = []
  const eventWebsites = await Promise.all(RAI_EVENT_CATALOGS.map((config) => checkGet(config.eventWebsiteLabel, config.catalogID, () => Catalogs.Get(config.catalogID), true)))

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
    : { label: 'ISE 2026 access', status: 'missing', message: 'Not assigned yet.', technicalID: 'ISE_2026_CATALOG' }

  const productAssignments = await Products.ListAssignments({ productID: RAI_PRODUCT_ID, buyerID: DEFAULT_DEMO_BUYER_ID, priceScheduleID: RAI_PRICE_SCHEDULE_ID, pageSize: 1 })
  const pizzaPricing: RaiReadinessItem = productAssignments.Items.length
    ? { label: 'Pizza pricing', status: 'ready', message: 'Pizza pricing is assigned.', technicalID: `${RAI_PRODUCT_ID} / ${RAI_PRICE_SCHEDULE_ID}` }
    : { label: 'Pizza pricing', status: 'missing', message: 'Not assigned yet.', technicalID: `${RAI_PRODUCT_ID} / ${RAI_PRICE_SCHEDULE_ID}` }

  const securityAssignments = await SecurityProfiles.ListAssignments({ buyerID: DEFAULT_DEMO_BUYER_ID, userID: DEFAULT_DEMO_BUYER_USER_ID, pageSize: 20 })
  const shopperAccess: RaiReadinessItem = securityAssignments.Items.length
    ? { label: 'Shopper access/security profile', status: 'ready', message: 'Shopper-style access is assigned.', technicalID: securityAssignments.Items.map((item) => item.SecurityProfileID).filter(Boolean).join(', ') }
    : { label: 'Shopper access/security profile', status: 'warning', message: 'No assigned shopper-style access was found.', technicalID: 'SecurityProfiles.ListAssignments' }
  if (shopperAccess.status === 'warning') warnings.push('Shopper access/security profile should be reviewed before recording.')

  const buyerSetup = [buyer, user, iseAccess, pizzaPricing, shopperAccess]
  const allItems = [...eventWebsites, ...productSetup, ...buyerSetup]
  warnings.push(...allItems.filter((item) => item.status === 'missing' || item.status === 'warning').map((item) => `${item.label}: ${item.message || item.status}`))

  return {
    overallStatus: getReadinessStatus(allItems),
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
