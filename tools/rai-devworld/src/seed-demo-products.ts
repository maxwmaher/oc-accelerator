import {
  Auth,
  Bundles,
  Catalogs,
  Configuration,
  OrderCloudError,
  PriceSchedules,
  Products,
  Specs,
  Tokens,
  type ApiRole,
  type Bundle,
  type BundleAssignment,
  type BundleCatalogAssignment,
  type BundleProductAssignment,
  type PriceSchedule,
  type Product,
  type ProductCatalogAssignment,
  type Spec,
  type SpecOption,
  type SpecProductAssignment,
} from 'ordercloud-javascript-sdk';

const SEED_ID = 'rai-amsterdam-demo-products';
const SEED_VERSION = 1;
const DEFAULT_API_URL = 'https://westeurope-sandbox.ordercloud.io';
const DEFAULT_BUYER_ID = 'buyer';
const DEFAULT_CATALOG_ID = 'buyer';

type CatalogXpKind = 'spec-product' | 'bundle' | 'bundle-component';

type CatalogXp = {
  Demo: {
    Managed: true;
    SeedID: string;
    Version: number;
    Event: 'RAI Amsterdam';
    ResourceKind: CatalogXpKind;
    DisplayGroup: 'RAI Amsterdam Demo';
    SpecIDs: string[];
    ComponentProductIDs: string[];
  };
  Images: Array<{ Url: string; ThumbnailUrl: string; AltText: string }>;
};

type DemoXp = {
  Demo: {
    Managed: true;
    SeedID: string;
    Version: number;
    Event: 'RAI Amsterdam';
    ResourceKind: string;
  };
};

type SeedSpec = { spec: Spec<DemoXp>; options: Array<SpecOption<DemoXp>>; defaultOptionID: string };
type SeedProduct = { product: Product<CatalogXp>; priceSchedule: PriceSchedule };
type SeedBundle = { bundle: Bundle<CatalogXp>; components: Array<SeedProduct & { defaultQuantity: number }> };

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

const env = (primary: string, secondary?: string, fallback = ''): string =>
  process.env[primary] ?? (secondary ? process.env[secondary] : undefined) ?? fallback;

const config = {
  apiUrl: env('ORDERCLOUD_API_URL', 'ocApiUrl', DEFAULT_API_URL),
  clientID: env('ORDERCLOUD_CLIENT_ID', 'ocFunctionsClientId'),
  clientSecret: env('ORDERCLOUD_CLIENT_SECRET', 'ocFunctionsClientSecret'),
  buyerID: env('RAI_BUYER_ID', undefined, DEFAULT_BUYER_ID),
  catalogID: env('RAI_CATALOG_ID', undefined, DEFAULT_CATALOG_ID),
};

function catalogXp(kind: CatalogXpKind, specIDs: string[] = [], componentProductIDs: string[] = []): CatalogXp {
  return {
    Demo: {
      Managed: true,
      SeedID: SEED_ID,
      Version: SEED_VERSION,
      Event: 'RAI Amsterdam',
      ResourceKind: kind,
      DisplayGroup: 'RAI Amsterdam Demo',
      SpecIDs: [...specIDs],
      ComponentProductIDs: [...componentProductIDs],
    },
    Images: [],
  };
}

function demoXp(resourceKind: string): DemoXp {
  return { Demo: { Managed: true, SeedID: SEED_ID, Version: SEED_VERSION, Event: 'RAI Amsterdam', ResourceKind: resourceKind } };
}

function validateXp(resourceType: string, resourceID: string, xp: unknown): void {
  if (typeof xp !== 'object' || xp === null || Array.isArray(xp)) {
    throw new Error(`${resourceType} ${resourceID} xp must be a JSON object. Do not pass a JSON string or array.`);
  }

  const serialized = JSON.stringify(xp);
  if (!serialized || serialized === 'null') {
    throw new Error(`${resourceType} ${resourceID} xp serialized to an empty value.`);
  }

  JSON.parse(serialized);

  if (serialized.length > 8000) {
    throw new Error(`${resourceType} ${resourceID} xp is ${serialized.length} characters and exceeds OrderCloud's 8000 character limit.`);
  }
}

function ensureCurrencyNeutral(priceSchedule: PriceSchedule): PriceSchedule {
  // The seed intentionally omits Currency on every price schedule. Treat even Currency: undefined
  // as invalid so the payload shape stays currency-neutral and schema-safe.
  if (Object.prototype.hasOwnProperty.call(priceSchedule, 'Currency')) {
    throw new Error(`Price schedule ${priceSchedule.ID ?? priceSchedule.Name} must not specify Currency. Remove the Currency property entirely.`);
  }

  return priceSchedule;
}

function priceSchedule(
  id: string,
  name: string,
  priceBreaks: NonNullable<PriceSchedule['PriceBreaks']>,
  options: Pick<PriceSchedule, 'MinQuantity' | 'MaxQuantity' | 'RestrictedQuantity'> = {},
): PriceSchedule {
  return ensureCurrencyNeutral({
    ID: id,
    Name: name,
    ApplyTax: false,
    ApplyShipping: false,
    UseCumulativeQuantity: false,
    MinQuantity: options.MinQuantity ?? 1,
    MaxQuantity: options.MaxQuantity,
    RestrictedQuantity: options.RestrictedQuantity ?? false,
    PriceBreaks: priceBreaks,
  });
}

const specProductSpecs: SeedSpec[] = [
  {
    spec: {
      ID: 'rai-demo-spec-monitor-wall-size',
      Name: 'Monitor wall size',
      ListOrder: 1,
      Required: true,
      AllowOpenText: false,
      DefinesVariant: false,
      xp: demoXp('spec'),
    },
    options: [
      { ID: 'single-55', Value: 'Single 55 inch display', ListOrder: 1, PriceMarkupType: 'NoMarkup', xp: demoXp('spec-option') },
      { ID: 'dual-55', Value: 'Dual 55 inch display wall', ListOrder: 2, PriceMarkupType: 'AmountPerQuantity', PriceMarkup: 425, xp: demoXp('spec-option') },
      { ID: 'triple-55', Value: 'Triple 55 inch display wall', ListOrder: 3, PriceMarkupType: 'AmountPerQuantity', PriceMarkup: 825, xp: demoXp('spec-option') },
    ],
    defaultOptionID: 'single-55',
  },
  {
    spec: {
      ID: 'rai-demo-spec-monitor-wall-finish',
      Name: 'Frame finish',
      ListOrder: 2,
      Required: true,
      AllowOpenText: false,
      DefinesVariant: false,
      xp: demoXp('spec'),
    },
    options: [
      { ID: 'matte-black', Value: 'Matte black', ListOrder: 1, PriceMarkupType: 'NoMarkup', xp: demoXp('spec-option') },
      { ID: 'white', Value: 'White', ListOrder: 2, PriceMarkupType: 'AmountPerQuantity', PriceMarkup: 35, xp: demoXp('spec-option') },
      { ID: 'brushed-aluminum', Value: 'Brushed aluminum', ListOrder: 3, PriceMarkupType: 'AmountPerQuantity', PriceMarkup: 95, xp: demoXp('spec-option') },
    ],
    defaultOptionID: 'matte-black',
  },
];

const specProduct: SeedProduct = {
  product: {
    ID: 'rai-demo-configurable-monitor-wall',
    Name: 'RAI Configurable Monitor Wall',
    Description: 'Demo configurable product with required spec options and option-level price markups.',
    Active: true,
    Returnable: false,
    DefaultPriceScheduleID: 'rai-demo-configurable-monitor-wall-ps',
    xp: catalogXp('spec-product', specProductSpecs.map((s) => s.spec.ID ?? ''), []),
  },
  priceSchedule: priceSchedule('rai-demo-configurable-monitor-wall-ps', 'RAI Configurable Monitor Wall Price', [
    { Quantity: 1, Price: 875 },
    { Quantity: 5, Price: 825 },
  ], { MinQuantity: 1 }),
};

const bundleID = 'rai-demo-exhibitor-stand-starter-bundle';

const componentProducts: SeedBundle['components'] = [
  {
    product: {
      ID: 'rai-demo-bundle-stand-frame',
      Name: 'Bundle Component - Stand Frame',
      Description: 'Required stand-frame component for the starter exhibitor bundle.',
      Active: true,
      Returnable: false,
      DefaultPriceScheduleID: 'rai-demo-bundle-stand-frame-ps',
      xp: catalogXp('bundle-component', [], []),
    },
    priceSchedule: priceSchedule('rai-demo-bundle-stand-frame-ps', 'Bundle Component - Stand Frame Price', [
      { Quantity: 1, Price: 450, BundlePrice: 390 },
    ]),
    defaultQuantity: 1,
  },
  {
    product: {
      ID: 'rai-demo-bundle-power-kit',
      Name: 'Bundle Component - Power Kit',
      Description: 'Required power kit component for the starter exhibitor bundle.',
      Active: true,
      Returnable: false,
      DefaultPriceScheduleID: 'rai-demo-bundle-power-kit-ps',
      xp: catalogXp('bundle-component', [], []),
    },
    priceSchedule: priceSchedule('rai-demo-bundle-power-kit-ps', 'Bundle Component - Power Kit Price', [
      { Quantity: 1, Price: 225, BundlePrice: 175 },
    ]),
    defaultQuantity: 1,
  },
  {
    product: {
      ID: 'rai-demo-bundle-network-drop',
      Name: 'Bundle Component - Network Drop',
      Description: 'Required network drop component for the starter exhibitor bundle.',
      Active: true,
      Returnable: false,
      DefaultPriceScheduleID: 'rai-demo-bundle-network-drop-ps',
      xp: catalogXp('bundle-component', [], []),
    },
    priceSchedule: priceSchedule('rai-demo-bundle-network-drop-ps', 'Bundle Component - Network Drop Price', [
      { Quantity: 1, Price: 175, BundlePrice: 125 },
    ]),
    defaultQuantity: 1,
  },
];

const bundle: SeedBundle = {
  bundle: {
    ID: bundleID,
    Name: 'RAI Exhibitor Stand Starter Bundle',
    Description: 'Demo bundle containing three required products with bundle-specific component pricing.',
    Active: true,
    xp: catalogXp('bundle', [], componentProducts.map((c) => c.product.ID ?? '')),
  },
  components: componentProducts,
};

function validateSeed(): void {
  const products = [specProduct, ...bundle.components];

  for (const seedProduct of products) {
    const productID = seedProduct.product.ID;
    if (!productID) throw new Error('A product is missing ID.');
    if (!seedProduct.product.Name) throw new Error(`Product ${productID} is missing Name.`);
    if (!seedProduct.product.DefaultPriceScheduleID) throw new Error(`Product ${productID} is missing DefaultPriceScheduleID.`);
    validateXp('Product', productID, seedProduct.product.xp);
    ensureCurrencyNeutral(seedProduct.priceSchedule);
  }

  if (!bundle.bundle.ID) throw new Error('Bundle is missing ID.');
  if (!bundle.bundle.Name) throw new Error(`Bundle ${bundle.bundle.ID} is missing Name.`);
  validateXp('Bundle', bundle.bundle.ID, bundle.bundle.xp);

  for (const seedSpec of specProductSpecs) {
    const specID = seedSpec.spec.ID;
    if (!specID) throw new Error('A spec is missing ID.');
    if (!seedSpec.spec.Name) throw new Error(`Spec ${specID} is missing Name.`);
    validateXp('Spec', specID, seedSpec.spec.xp);
    if (!seedSpec.options.some((option) => option.ID === seedSpec.defaultOptionID)) {
      throw new Error(`Spec ${specID} default option ${seedSpec.defaultOptionID} does not exist in the seed options.`);
    }

    for (const option of seedSpec.options) {
      if (!option.ID) throw new Error(`Spec ${specID} has an option without ID.`);
      if (!option.Value) throw new Error(`Spec ${specID} option ${option.ID} is missing Value.`);
      validateXp('Spec option', `${specID}/${option.ID}`, option.xp);
    }
  }
}

async function authenticate(): Promise<void> {
  if (!config.clientID || !config.clientSecret) {
    throw new Error('ORDERCLOUD_CLIENT_ID and ORDERCLOUD_CLIENT_SECRET are required unless running with --dry-run.');
  }

  Configuration.Set({ baseApiUrl: config.apiUrl, timeoutInMilliseconds: 30_000 });

  const roles: ApiRole[] = ['FullAccess'];
  const token = await Auth.ClientCredentials(config.clientSecret, config.clientID, roles);
  Tokens.SetAccessToken(token.access_token);
}

async function savePriceSchedule(schedule: PriceSchedule): Promise<void> {
  if (!schedule.ID) throw new Error(`Price schedule ${schedule.Name} is missing ID.`);
  ensureCurrencyNeutral(schedule);
  await PriceSchedules.Save(schedule.ID, schedule);
  console.log(`Saved currency-neutral price schedule ${schedule.ID}`);
}

async function saveProduct(product: Product<CatalogXp>): Promise<void> {
  if (!product.ID) throw new Error(`Product ${product.Name ?? '(unnamed)'} is missing ID.`);
  validateXp('Product', product.ID, product.xp);
  await Products.Save(product.ID, product);

  const assignment: ProductCatalogAssignment = { CatalogID: config.catalogID, ProductID: product.ID };
  await Catalogs.SaveProductAssignment(assignment);

  console.log(`Saved product ${product.ID} and assigned it to catalog ${config.catalogID}`);
}

async function saveSpecs(productID: string, specs: SeedSpec[]): Promise<void> {
  for (const seedSpec of specs) {
    const specID = seedSpec.spec.ID;
    if (!specID) throw new Error(`Spec ${seedSpec.spec.Name} is missing ID.`);

    const initialSpec: Spec<DemoXp> = { ...seedSpec.spec };
    delete initialSpec.DefaultOptionID;

    await Specs.Save(specID, initialSpec);

    for (const option of seedSpec.options) {
      if (!option.ID) throw new Error(`Spec ${specID} has an option without ID.`);
      await Specs.SaveOption(specID, option.ID, option);
    }

    await Specs.Patch(specID, { DefaultOptionID: seedSpec.defaultOptionID });

    const assignment: SpecProductAssignment = { SpecID: specID, ProductID: productID, DefaultOptionID: seedSpec.defaultOptionID };
    await Specs.SaveProductAssignment(assignment);

    console.log(`Saved spec ${specID}, options, and product assignment to ${productID}`);
  }
}

async function saveBundle(seedBundle: SeedBundle): Promise<void> {
  const seededBundle = seedBundle.bundle;
  if (!seededBundle.ID) throw new Error(`Bundle ${seededBundle.Name ?? '(unnamed)'} is missing ID.`);

  await Bundles.Save(seededBundle.ID, seededBundle);

  const catalogAssignment: BundleCatalogAssignment = { CatalogID: config.catalogID, BundleID: seededBundle.ID };
  await Catalogs.SaveBundleAssignment(catalogAssignment);

  const buyerAssignment: BundleAssignment = { BundleID: seededBundle.ID, BuyerID: config.buyerID };
  await Bundles.SaveAssignment(buyerAssignment);

  for (const component of seedBundle.components) {
    if (!component.product.ID) throw new Error(`Bundle component ${component.product.Name ?? '(unnamed)'} is missing ID.`);

    const productAssignment: BundleProductAssignment = {
      BundleID: seededBundle.ID,
      ProductID: component.product.ID,
      Required: true,
      DefaultQuantity: component.defaultQuantity,
    };
    await Bundles.SaveProductAssignment(productAssignment);
  }

  console.log(`Saved bundle ${seededBundle.ID}, catalog assignment, buyer assignment, and ${seedBundle.components.length} required products`);
}

async function ensureCatalogAssignedToBuyer(): Promise<void> {
  await Catalogs.SaveAssignment({ CatalogID: config.catalogID, BuyerID: config.buyerID });
  console.log(`Ensured catalog ${config.catalogID} is assigned to buyer ${config.buyerID}`);
}

async function run(): Promise<void> {
  validateSeed();

  const priceSchedules = [specProduct.priceSchedule, ...bundle.components.map((component) => component.priceSchedule)];
  const products = [specProduct.product, ...bundle.components.map((component) => component.product)];

  if (dryRun) {
    console.log('Dry run only. Validated seed payloads without saving to OrderCloud.');
    console.log(JSON.stringify({
      apiUrl: config.apiUrl,
      buyerID: config.buyerID,
      catalogID: config.catalogID,
      priceSchedules: priceSchedules.map((schedule) => ({
        ID: schedule.ID,
        hasCurrencyProperty: Object.prototype.hasOwnProperty.call(schedule, 'Currency'),
        priceBreaks: schedule.PriceBreaks,
      })),
      products: products.map((product) => product.ID),
      specs: specProductSpecs.map((seedSpec) => ({
        ID: seedSpec.spec.ID,
        defaultOptionID: seedSpec.defaultOptionID,
        optionIDs: seedSpec.options.map((option) => option.ID),
      })),
      bundle: {
        ID: bundle.bundle.ID,
        requiredProductIDs: bundle.components.map((component) => component.product.ID),
      },
    }, null, 2));
    return;
  }

  await authenticate();
  await ensureCatalogAssignedToBuyer();

  for (const schedule of priceSchedules) {
    await savePriceSchedule(schedule);
  }

  for (const product of products) {
    await saveProduct(product);
  }

  await saveSpecs(specProduct.product.ID ?? '', specProductSpecs);
  await saveBundle(bundle);

  console.log('RAI Amsterdam demo product/spec/bundle seed completed.');
}

run().catch((error: unknown) => {
  if (error instanceof OrderCloudError) {
    const details = {
      status: error.status,
      statusText: error.statusText,
      errorCode: error.errorCode,
      message: error.message,
      errors: error.errors,
    };
    console.error(JSON.stringify(details, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : error);
  }

  process.exit(1);
});
