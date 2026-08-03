import { describe, expect, it } from 'vitest'
import {
  buildSwitchHandoffEnvelope,
  isSwitchImportDivertEnabled,
  textToHandoffFile,
} from './switch-handoff'

describe('switch-handoff', () => {
  it('enables divert from org setting or env', () => {
    expect(isSwitchImportDivertEnabled({ settings: { switch_import_divert: true } })).toBe(true)
    expect(isSwitchImportDivertEnabled({ settings: {} })).toBe(
      String(import.meta.env.VITE_SWITCH_IMPORT_DIVERT ?? '').toLowerCase() === 'true',
    )
  })

  it('builds envelope matching handoff contract', () => {
    const envelope = buildSwitchHandoffEnvelope({
      module: 'inventory',
      entity_type: 'inventory_item',
      source_label: 'katana.inventory.csv_import',
      actor: { user_id: 'u1', organization_id: 'o1' },
      file: {
        file_name: 'items.csv',
        mime_type: 'text/csv',
        source: { type: 'signed_url', url: 'https://example.com/x' },
      },
      rows: [{ sku: 'A', product_name: 'Widget' }],
      parsed: true,
      upsert_key: 'sku',
    })
    expect(envelope).toEqual({
      module: 'inventory',
      entity_type: 'inventory_item',
      source_label: 'katana.inventory.csv_import',
      actor: { user_id: 'u1', organization_id: 'o1' },
      parsed: true,
      file: {
        file_name: 'items.csv',
        mime_type: 'text/csv',
        source: { type: 'signed_url', url: 'https://example.com/x' },
      },
      context: {},
      rows: [{ sku: 'A', product_name: 'Widget' }],
      upsert_key: 'sku',
      target: null,
    })
  })

  it('requires file or rows', () => {
    expect(() =>
      buildSwitchHandoffEnvelope({
        module: 'automation',
        entity_type: 'storage_file',
        source_label: 'katana.automation.document_upload',
        actor: { user_id: 'u1', organization_id: 'o1' },
      }),
    ).toThrow(/file and\/or rows/)
  })

  it('creates File from pasted CSV text', () => {
    const f = textToHandoffFile('sku,product_name\nA,Widget\n', 'inventory.csv')
    expect(f.name).toBe('inventory.csv')
    expect(f.type).toBe('text/csv')
  })
})
