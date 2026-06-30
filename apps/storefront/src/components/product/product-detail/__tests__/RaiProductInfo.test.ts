import { describe, expect, it } from 'vitest'
import { getFirstSourceCategoryPathLabel } from '../RaiProductInfo'

describe('getFirstSourceCategoryPathLabel', () => {
  it('formats the first string path and converts RAI separators', () => {
    expect(getFirstSourceCategoryPathLabel(['Food > Beverage > Coffee'])).toBe(
      'Food › Beverage › Coffee',
    )
  })

  it('formats the first string array path', () => {
    expect(getFirstSourceCategoryPathLabel([['Food', 'Beverage', 'Coffee']])).toBe(
      'Food › Beverage › Coffee',
    )
  })

  it('returns undefined for missing or empty paths', () => {
    expect(getFirstSourceCategoryPathLabel()).toBeUndefined()
    expect(getFirstSourceCategoryPathLabel([])).toBeUndefined()
  })

  it('returns undefined for malformed paths without throwing', () => {
    expect(() => getFirstSourceCategoryPathLabel([42])).not.toThrow()
    expect(() => getFirstSourceCategoryPathLabel([['Food', 42]])).not.toThrow()
    expect(() => getFirstSourceCategoryPathLabel({ path: 'Food' })).not.toThrow()

    expect(getFirstSourceCategoryPathLabel([42])).toBeUndefined()
    expect(getFirstSourceCategoryPathLabel([['Food', 42]])).toBeUndefined()
    expect(getFirstSourceCategoryPathLabel({ path: 'Food' })).toBeUndefined()
  })
})
