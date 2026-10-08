import type { OpenAPIV3 } from 'openapi-types'

// Deliberately synthetic data: no marketplace, order or credential from a live environment.
export const apiUrl = 'https://admin-fixture.invalid'
export const clientId = 'admin-runtime-test'
export const order = {
  ID: 'fixture-order',
  Status: 'Open',
  Total: 95,
  Comments: 'Pickup order',
  xp: {
    Pickup: { Location: 'Fixture warehouse', Time: '2026-10-09T12:00:00Z' },
    Payment: { Status: 'Approved', Simulated: true },
    Promotion: { Code: 'FIXTURE10', Discount: 5 },
  },
}
export const priceSchedule = {
  ID: 'fixture-prices', Name: 'Wholesale prices', MinQuantity: 1, MaxQuantity: 100,
  PriceBreaks: [{ Quantity: 1, Price: 12.5 }, { Quantity: 10, Price: 10 }],
}
export const promotion = {
  ID: 'fixture-promo', Code: 'FIXTURE10', Name: 'Fixture promotion',
  LineItemLevel: false, EligibleExpression: 'Order.Total > 50', ValueExpression: '5',
}
export const assignment = { ProductID: 'fixture-product', Quantity: 2 }

const orderSchema: OpenAPIV3.SchemaObject = {
  type: 'object', properties: {
    ID: { type: 'string', readOnly: true },
    Status: { type: 'string', readOnly: true },
    Total: { type: 'number', readOnly: true },
    Comments: { type: 'string' },
    xp: { type: 'object' },
  },
}
const priceSchema: OpenAPIV3.SchemaObject = {
  type: 'object', required: ['Name', 'MinQuantity', 'PriceBreaks'], properties: {
    ID: { type: 'string' }, Name: { type: 'string', maxLength: 100 },
    MinQuantity: { type: 'integer', minimum: 1 }, MaxQuantity: { type: 'integer' },
    PriceBreaks: { type: 'array', items: {
      type: 'object', required: ['Quantity', 'Price'], properties: {
        Quantity: { type: 'integer', minimum: 1 }, Price: { type: 'number' },
      },
    } },
  },
}
const promotionSchema: OpenAPIV3.SchemaObject = {
  type: 'object', required: ['Code'], properties: {
    ID: { type: 'string' }, Code: { type: 'string' }, Name: { type: 'string' },
    LineItemLevel: { type: 'boolean' },
    EligibleExpression: { type: 'string', maxLength: 1000 },
    ValueExpression: { type: 'string', maxLength: 1000 },
  },
}
const assignmentSchema: OpenAPIV3.SchemaObject = {
  type: 'object', required: ['ProductID'], properties: {
    ProductID: { type: 'string' }, Quantity: { type: 'integer', minimum: 1 },
  },
}

const response = (schema: OpenAPIV3.SchemaObject) => ({
  description: 'Fixture response', content: { 'application/json': { schema } },
})
const operation = (
  operationId: string,
  schema: OpenAPIV3.SchemaObject,
  parameters: string[] = [],
): OpenAPIV3.OperationObject => ({
  operationId,
  tags: [operationId.split('.')[0]],
  security: [{ OAuth2: ['FullAccess', 'OrderAdmin', 'OrderReader', 'PriceScheduleAdmin', 'PromotionAdmin', 'ProductAdmin'] }],
  parameters: parameters.map(name => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
  responses: { '200': response(schema) },
})
const save = (operationId: string, schema: OpenAPIV3.SchemaObject, parameters: string[]) => ({
  ...operation(operationId, schema, parameters),
  requestBody: { content: { 'application/json': { schema: {
    type: 'object' as const, required: schema.required, allOf: [schema],
  } } } },
})
const resourcePaths = (resource: string, path: string, schema: OpenAPIV3.SchemaObject, parameters: string[]) => ({
  [path]: {
    get: operation(`${resource}.Get`, schema, parameters),
    put: save(`${resource}.Save`, schema, parameters),
    delete: operation(`${resource}.Delete`, schema, parameters),
  },
  [path.slice(0, path.lastIndexOf('/'))]: {
    get: operation(`${resource}.List`, { type: 'object', properties: {
      Items: { type: 'array', items: schema },
    } }),
  },
})

// A cached, dereferenced OpenAPI fixture exercises the SDK's real schema and resolver code.
export const spec: OpenAPIV3.Document = {
  openapi: '3.0.1', info: { title: 'Admin runtime fixture', version: 'fixture' },
  servers: [{ url: `${apiUrl}/v1` }],
  paths: {
    ...resourcePaths('Orders', '/orders/{direction}/{orderID}', orderSchema, ['direction', 'orderID']),
    ...resourcePaths('PriceSchedules', '/priceschedules/{priceScheduleID}', priceSchema, ['priceScheduleID']),
    ...resourcePaths('Promotions', '/promotions/{promotionID}', promotionSchema, ['promotionID']),
    ...resourcePaths('Products', '/products/{productID}', { type: 'object', properties: { ID: { type: 'string' } } }, ['productID']),
    '/products/assignments': {
      post: save('Products.SaveAssignment', assignmentSchema, []),
      get: operation('Products.ListAssignments', assignmentSchema),
    },
  },
  components: {
    schemas: Object.fromEntries([
      'LineItemProduct', 'LineItem', 'Variant', 'User', 'Order', 'OrderReturn',
      'Address', 'ApprovalRule', 'SellerApprovalRule', 'CostCenter',
    ].map(name => [name, name === 'Order' ? orderSchema : { type: 'object', properties: {} }])),
  },
}

export function fixtureToken(roles = ['FullAccess']) {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    exp: 4102444800, role: roles, usr: 'fixture-admin', cid: clientId,
  })}.fixture-signature`
}
