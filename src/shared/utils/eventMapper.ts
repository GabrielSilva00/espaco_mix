import type { Event } from '../../types';
import { STATUS_FROM_DB, STATUS_TO_DB } from '../constants/app';

export function mapDbEventToApp(db: any): Event {
  return {
    id: db.id,
    title: db.title ?? '',
    description: db.description ?? '',
    date: db.date ?? '',
    endDate: db.end_date ?? db.endDate,
    time: db.time,
    endTime: db.end_time ?? db.endTime,
    location: db.location ?? '',
    status: STATUS_FROM_DB[db.status] ?? 'Em breve',
    img: db.img ?? '',
    assignedStaffIds: db.assigned_staff ?? db.assignedStaffIds ?? [],
    priceType: db.price_type ?? db.priceType ?? 'unique',
    batches: (db.batches ?? []).map((b: any) => ({
      id: b.id,
      name: b.name ?? '',
      startDate: b.start_date ?? b.startDate ?? '',
      endDate: b.end_date ?? b.endDate ?? '',
      is_active: b.is_active ?? true,
      sort_order: b.sort_order,
      sectors: (b.sectors ?? []).map((s: any) => ({
        id: s.id,
        name: s.name ?? '',
        quantity: s.quantity ?? 0,
        price: s.price ?? 0,
        priceMale: s.price_male ?? s.priceMale,
        priceFemale: s.price_female ?? s.priceFemale,
        convenienceFee: s.convenience_fee ?? s.convenienceFee,
        limitPerUser: s.limit_per_user ?? s.limitPerUser,
        visibility: s.visibility ?? 'public',
        description: s.description,
      })),
    })),
    hasTables: db.has_tables ?? db.hasTables ?? false,
    tableConfig:
      (db.has_tables ?? db.hasTables) && (db.table_total || db.tableConfig)
        ? {
            totalTables: db.table_total ?? db.tableConfig?.totalTables ?? 20,
            seatsPerTable: db.table_seats ?? db.tableConfig?.seatsPerTable ?? 4,
            gridRows: db.table_rows ?? db.tableConfig?.gridRows ?? 0,
            gridCols: db.table_cols ?? db.tableConfig?.gridCols ?? 0,
            totalBistros: db.total_bistros ?? db.tableConfig?.totalBistros ?? 5,
            tablePrice: db.table_price ?? db.tableConfig?.tablePrice ?? 300,
            bistroPrice: db.bistro_price ?? db.tableConfig?.bistroPrice ?? 150,
          }
        : undefined,
    tableLayout: db.table_layout ?? db.tableLayout,
    ageRating: db.age_rating ?? db.ageRating,
    importantNotes: db.important_notes ?? db.importantNotes,
    entryRules: db.entry_rules ?? db.entryRules,
    additionalInfo: db.additional_info ?? db.additionalInfo,
    posLocations: db.pos_locations ?? db.posLocations,
    category: db.category,
    capacity: db.capacity,
    isRecurring: db.is_recurring ?? db.isRecurring,
    customUrl: db.custom_url ?? db.customUrl,
    refundPolicy: db.refund_policy ?? db.refundPolicy,
    socialLinks:
      db.social_instagram || db.social_spotify || db.socialLinks
        ? {
            instagram: db.social_instagram ?? db.socialLinks?.instagram,
            spotify: db.social_spotify ?? db.socialLinks?.spotify,
          }
        : undefined,
  };
}

export function mapAppEventToDb(evt: Event): any {
  return {
    id: evt.id,
    title: evt.title,
    description: evt.description,
    date: evt.date,
    end_date: evt.endDate,
    time: evt.time,
    end_time: evt.endTime,
    location: evt.location,
    status: STATUS_TO_DB[evt.status] ?? evt.status,
    img: evt.img,
    assigned_staff: evt.assignedStaffIds,
    price_type: evt.priceType,
    has_tables: evt.hasTables,
    table_total: evt.tableConfig?.totalTables,
    table_seats: evt.tableConfig?.seatsPerTable,
    table_rows: evt.tableConfig?.gridRows,
    table_cols: evt.tableConfig?.gridCols,
    table_layout: evt.tableLayout,
    age_rating: evt.ageRating,
    important_notes: evt.importantNotes,
    entry_rules: evt.entryRules,
    additional_info: evt.additionalInfo,
    pos_locations: evt.posLocations,
    category: evt.category,
    capacity: evt.capacity ?? null,
    is_recurring: evt.isRecurring,
    custom_url: evt.customUrl,
    refund_policy: evt.refundPolicy,
    social_instagram: evt.socialLinks?.instagram,
    social_spotify: evt.socialLinks?.spotify,
  };
}
