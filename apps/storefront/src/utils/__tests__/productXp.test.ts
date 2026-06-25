import { describe, expect, it } from 'vitest'
import { parseProductXp } from '../productXp'

describe('parseProductXp', () => {
  it('returns object xp without breaking existing data', () => {
    const xp = { Images: [{ ThumbnailUrl: 'thumb.jpg', Url: 'image.jpg' }], RAI: { Managed: true } }

    expect(parseProductXp(xp)).toEqual(xp)
  })

  it('parses compact JSON string xp', () => {
    const xp = '{"Images":[{"ThumbnailUrl":"thumb.jpg","Url":"image.jpg"}],"RAI":{"Managed":true}}'

    expect(parseProductXp(xp)).toEqual({ Images: [{ ThumbnailUrl: 'thumb.jpg', Url: 'image.jpg' }], RAI: { Managed: true } })
  })
})
