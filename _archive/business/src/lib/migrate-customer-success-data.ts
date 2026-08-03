/**
 * Katana Customers – Data Migration Script
 * Blank system: no sample data is inserted. Add clients via the app or API.
 */

import * as api from './customer-success-api'

export async function migrateCustomerSuccessData() {
  console.log('🚀 Katana Customers migration (blank system)...')

  try {
    const existingClients = await api.getAllClients()
    if (existingClients.length > 0) {
      console.log(`✅ ${existingClients.length} client(s) already in database. No sample data added.`)
    } else {
      console.log('✅ Blank system – no sample data inserted. Add clients via the app.')
    }
    console.log('🎉 Migration check completed.')
    return true
  } catch (error) {
    console.error('❌ Error during migration:', error)
    return false
  }
}

// Auto-run if called directly
if (typeof window !== 'undefined') {
  (window as any).migrateCustomerSuccessData = migrateCustomerSuccessData
}
