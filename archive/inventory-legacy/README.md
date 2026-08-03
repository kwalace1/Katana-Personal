# Archived inventory UI (legacy)

These files were removed from the active app tree on 2026-06-14.

The live inventory module is:

- `src/pages/Inventory*.tsx`
- `src/components/inventory/*`
- `src/lib/inventory-*.ts`

## Contents

| Path | Notes |
|------|--------|
| `components-inventory/` | Pre-Supabase mock components (duplicate of early UI) |
| `app-inventory/` | Next.js-style route stubs; not used by Vite `src/App.tsx` |
| `inventory-dashboard.tsx` | Unrouted dashboard using empty mock data |
| `lib-inventory-data.ts` | Legacy camelCase types and empty export arrays |

Do not import from this folder in new code.
