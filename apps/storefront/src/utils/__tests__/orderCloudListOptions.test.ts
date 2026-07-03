import { describe, expect, it } from 'vitest'
import { mapRouteParamsToOrderCloudListOptions } from '../orderCloudListOptions'

describe('mapRouteParamsToOrderCloudListOptions', () => {
  it('maps React Router catalog/category params to OrderCloud SDK option casing', () => {
    expect(
      mapRouteParamsToOrderCloudListOptions({
        catalogId: 'buyer',
        categoryId: 'rai-devworld-cat-power-sockets',
      }),
    ).toEqual({
      catalogID: 'buyer',
      categoryID: 'rai-devworld-cat-power-sockets',
    })
  })

  it('does not emit lowercase OrderCloud list option keys', () => {
    const options = mapRouteParamsToOrderCloudListOptions({
      catalogId: 'buyer',
      categoryId: 'rai-devworld-cat-food-breakfast-catering',
    })

    expect(options).not.toHaveProperty('catalogId')
    expect(options).not.toHaveProperty('categoryId')
  })
})
