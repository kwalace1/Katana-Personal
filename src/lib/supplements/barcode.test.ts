import { describe, expect, it, vi } from 'vitest'
import { handleSupplementBarcodeRequest } from '../../../api/supplement-barcode-core'
import { healthApi } from '@/modules/health/api'
import { decodeBarcodeFromRgba } from './decode-barcode'
import {
  acceptCameraCode,
  applySupplementMatch,
  barcodeSearchPhrases,
  fetchSupplementBarcode,
  gs1CheckDigitOk,
  InvalidBarcodeError,
  lookupSupplementByBarcode,
  normalizeProductBarcode,
  pickMatchingLabel,
  SUPPLEMENT_NOT_FOUND_MESSAGE,
  SupplementLookupError,
  upcMatches,
  type DsldLabel,
} from './barcode'

const UPC = '012345678905'

function label(patch: Partial<DsldLabel> = {}): DsldLabel {
  return {
    fullName: 'Vitamin D3',
    brandName: "Nature's Bounty",
    upcSku: '0 12345 67890 5',
    offMarket: 0,
    entryDate: '2024-06-01',
    servingSizes: [{ minQuantity: 1, maxQuantity: 1, unit: 'Tablet(s)' }],
    ...patch,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function dsldFetch(options: {
  onMarket?: DsldLabel | null
  anyMarket?: DsldLabel | null
  fail?: boolean
}): typeof fetch {
  const onMarket = options.onMarket
  const anyMarket = options.anyMarket
  return (async (input: RequestInfo | URL) => {
    if (options.fail) throw new Error('offline')
    const url = String(input)
    if (url.includes('/search-filter')) {
      const source = url.includes('status=1') ? onMarket : anyMarket
      return jsonResponse({ hits: source ? [{ _id: '25' }] : [] })
    }
    if (url.includes('/label/25')) {
      const source = onMarket || anyMarket
      return jsonResponse(source || {})
    }
    return jsonResponse({ error: 'missing' }, 404)
  }) as typeof fetch
}

const UPC_L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
]

function invertBits(pattern: string): string {
  return pattern.replace(/0/g, 'x').replace(/1/g, '0').replace(/x/g, '1')
}

/** Draw a UPC-A so the decoder test does not depend on a barcode writer. */
function upcAImage(code: string, module = 2): { data: Uint8ClampedArray; width: number; height: number } {
  const left = code
    .slice(0, 6)
    .split('')
    .map((digit) => UPC_L[Number(digit)])
    .join('')
  const right = code
    .slice(6)
    .split('')
    .map((digit) => invertBits(UPC_L[Number(digit)]!))
    .join('')
  const modules = `000000000101${left}01010${right}101000000000`
  const width = modules.length * module
  const height = 90
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shade = modules[Math.floor(x / module)] === '1' ? 0 : 255
      const i = (y * width + x) * 4
      data[i] = shade
      data[i + 1] = shade
      data[i + 2] = shade
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

describe('supplement barcodes', () => {
  it('accepts UPC and EAN codes and rejects everything else', () => {
    expect(gs1CheckDigitOk(UPC)).toBe(true)
    expect(gs1CheckDigitOk('4006381333931')).toBe(true)
    expect(normalizeProductBarcode('0 12345 67890 5')).toBe(UPC)
    expect(normalizeProductBarcode('4006381333931')).toBe('4006381333931')
    expect(normalizeProductBarcode('123')).toBeNull()
    expect(normalizeProductBarcode('abcdefghijkl')).toBeNull()
    expect(normalizeProductBarcode('012345678906')).toBeNull()
    expect(barcodeSearchPhrases(UPC)).toContain('0 12345 67890 5')
  })

  it('matches a spaced DSLD UPC and ignores a different product', () => {
    expect(upcMatches(UPC, '0 12345 67890 5')).toBe(true)
    expect(upcMatches(`0${UPC}`, UPC)).toBe(true)
    expect(upcMatches(UPC, '999999999993')).toBe(false)
    const chosen = pickMatchingLabel(UPC, [
      label({ offMarket: 1, entryDate: '2025-01-01', fullName: 'Old bottle' }),
      label({ offMarket: 0, entryDate: '2023-01-01', fullName: 'Current bottle' }),
      label({ upcSku: '999999999993', fullName: 'Unrelated' }),
    ])
    expect(chosen?.fullName).toBe('Current bottle')
  })

  it('reads a UPC from image pixels', async () => {
    const image = upcAImage(UPC)
    const decoded = await decodeBarcodeFromRgba(image.data, image.width, image.height)
    expect(decoded && upcMatches(UPC, decoded)).toBe(true)
    await expect(decodeBarcodeFromRgba(new Uint8ClampedArray(80), 10, 2)).resolves.toBeNull()
  })

  it('returns the product name and label serving when DSLD has both', async () => {
    const match = await lookupSupplementByBarcode(UPC, dsldFetch({ onMarket: label() }))
    expect(match).toEqual({
      name: "Nature's Bounty Vitamin D3",
      labelServing: '1 Tablet(s)',
    })
  })

  it('returns a name without inventing a serving when the label omits it', async () => {
    const match = await lookupSupplementByBarcode(
      UPC,
      dsldFetch({
        onMarket: label({
          brandName: '',
          servingSizes: [],
          ingredientRows: [{ name: 'Vitamin D', quantity: 1000 }],
        } as DsldLabel),
      }),
    )
    expect(match).toEqual({ name: 'Vitamin D3' })
  })

  it('treats a valid code with no UPC match as not found', async () => {
    await expect(
      lookupSupplementByBarcode(UPC, dsldFetch({ onMarket: null, anyMarket: null })),
    ).resolves.toBeNull()
    await expect(
      lookupSupplementByBarcode(
        UPC,
        dsldFetch({ onMarket: label({ upcSku: '4006381333931' }), anyMarket: null }),
      ),
    ).resolves.toBeNull()
  })

  it('can use an off-market label when that UPC is the only match', async () => {
    const match = await lookupSupplementByBarcode(
      UPC,
      dsldFetch({ onMarket: null, anyMarket: label({ offMarket: 1, brandName: '' }) }),
    )
    expect(match?.name).toBe('Vitamin D3')
  })

  it('reports a network failure instead of an empty product', async () => {
    await expect(lookupSupplementByBarcode(UPC, dsldFetch({ fail: true }))).rejects.toBeInstanceOf(
      SupplementLookupError,
    )
    await expect(lookupSupplementByBarcode('nope')).rejects.toBeInstanceOf(InvalidBarcodeError)
  })

  it('fills empty form fields and leaves time of day and existing notes alone', () => {
    expect(
      applySupplementMatch(
        { name: '', doseNotes: '', timeOfDay: 'evening' },
        { name: "Nature's Bounty Vitamin D3", labelServing: '1 Tablet(s)' },
      ),
    ).toEqual({
      name: "Nature's Bounty Vitamin D3",
      doseNotes: 'Label serving: 1 Tablet(s)',
      timeOfDay: 'evening',
    })
    expect(
      applySupplementMatch(
        { name: 'My note name', doseNotes: '2 drops with food', timeOfDay: 'afternoon' },
        { name: 'Other product', labelServing: '1 Tablet(s)' },
      ),
    ).toEqual({
      name: 'Other product',
      doseNotes: '2 drops with food',
      timeOfDay: 'afternoon',
    })
    expect(SUPPLEMENT_NOT_FOUND_MESSAGE).toBe('Supplement not found. You can still add it manually.')
  })

  it('ignores a second camera read of the same code', () => {
    expect(acceptCameraCode(null, `  ${UPC} `)).toBe(UPC)
    expect(acceptCameraCode(UPC, UPC)).toBeNull()
    expect(acceptCameraCode(UPC, 'not-a-barcode')).toBeNull()
    expect(acceptCameraCode(UPC, '4006381333931')).toBe('4006381333931')
  })

  it('does not change saved supplements or completion history', () => {
    const userId = 'supplement-barcode-history'
    const existing = healthApi.addSupplement(userId, {
      name: 'Existing Vitamin D',
      dose_notes: '2 drops',
      time_of_day: 'evening',
    })
    expect(existing).not.toBeNull()
    healthApi.toggleTaken(userId, existing!.id, '2026-10-31', true)

    const draft = applySupplementMatch(
      { name: '', doseNotes: '', timeOfDay: 'morning' },
      { name: "Nature's Bounty Vitamin D3", labelServing: '1 Tablet(s)' },
    )
    const checklist = healthApi.getDayChecklist(userId, '2026-10-31')
    expect(checklist.map((row) => [row.item.name, row.taken, row.item.time_of_day])).toEqual([
      ['Existing Vitamin D', true, 'evening'],
    ])

    expect(healthApi.addSupplement(userId, { name: '   ' })).toBeNull()
    const added = healthApi.addSupplement(userId, {
      name: draft.name,
      dose_notes: draft.doseNotes,
      time_of_day: draft.timeOfDay,
    })
    expect(added?.name).toBe("Nature's Bounty Vitamin D3")
    expect(added?.time_of_day).toBe('morning')
    const after = healthApi.getDayChecklist(userId, '2026-10-31')
    expect(after.find((row) => row.item.id === existing!.id)?.taken).toBe(true)
    expect(after.find((row) => row.item.id === existing!.id)?.item.dose_notes).toBe('2 drops')
    expect(after).toHaveLength(2)
  })
})

describe('supplement barcode API', () => {
  it('rejects an invalid code before calling the product database', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await handleSupplementBarcodeRequest(
      new Request('http://localhost/api/supplement-barcode?code=123'),
    )
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('returns not found and found without inventing a record', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      dsldFetch({ onMarket: null, anyMarket: null }),
    )
    const missing = await handleSupplementBarcodeRequest(
      new Request(`http://localhost/api/supplement-barcode?code=${UPC}`),
    )
    expect(missing.status).toBe(200)
    expect(await missing.json()).toEqual({ found: false })

    fetchSpy.mockImplementation(dsldFetch({ onMarket: label() }))
    const found = await handleSupplementBarcodeRequest(
      new Request(`http://localhost/api/supplement-barcode?code=${UPC}`),
    )
    expect(found.status).toBe(200)
    expect(await found.json()).toEqual({
      found: true,
      name: "Nature's Bounty Vitamin D3",
      labelServing: '1 Tablet(s)',
    })
    fetchSpy.mockRestore()
  })

  it('maps a client lookup failure separately from a missing product', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ found: false }))
    await expect(fetchSupplementBarcode(UPC)).resolves.toEqual({ status: 'not_found' })
    fetchSpy.mockResolvedValue(
      jsonResponse({ found: true, name: "Nature's Bounty Vitamin D3", labelServing: null }),
    )
    await expect(fetchSupplementBarcode(UPC)).resolves.toEqual({
      status: 'found',
      match: { name: "Nature's Bounty Vitamin D3" },
    })
    fetchSpy.mockRejectedValue(new Error('offline'))
    await expect(fetchSupplementBarcode(UPC)).rejects.toBeInstanceOf(SupplementLookupError)
    fetchSpy.mockRestore()
    await expect(fetchSupplementBarcode('12')).rejects.toBeInstanceOf(InvalidBarcodeError)
  })
})
