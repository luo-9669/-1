import {
  buildAdminExport,
  buildAdminSummary
} from '../services/admin-dashboard.js'
import {
  createAdminRecord,
  deleteAdminRecords,
  deleteAdminRecord,
  listAdminRecords,
  updateAdminRecord
} from '../services/workspace-store.js'

export function adminRoutes(store, options = {}) {
  return {
    'GET /api/admin/summary': async () => buildAdminSummary(store, options),
    'GET /api/admin/export': async () => buildAdminExport(store),
    'GET /api/admin/records/:collection': async (payload) => ({
      collection: payload.collection,
      records: listAdminRecords(store, payload.collection)
    }),
    'POST /api/admin/records/:collection': async (payload) => ({
      collection: payload.collection,
      record: await createAdminRecord(store, payload.collection, payload)
    }),
    'POST /api/admin/records/:collection/batch-delete': async (payload) =>
      await deleteAdminRecords(store, payload.collection, payload.ids),
    'PATCH /api/admin/records/:collection/:id': async (payload) => ({
      collection: payload.collection,
      record: await updateAdminRecord(store, payload.collection, payload.id, payload)
    }),
    'DELETE /api/admin/records/:collection/:id': async (payload) =>
      await deleteAdminRecord(store, payload.collection, payload.id)
  }
}
