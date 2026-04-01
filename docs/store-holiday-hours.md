# Store holiday hours (per branch)

## Goal

Allow **Admin** and **Store Manager** to manage **branch-specific** holiday days/times in the WebApp. Examples:

- **April 2** -- open **8:00-12:00** (short day)
- **April 3** -- **closed** all day

**Holiday entries override** the normal recurring `openingHours` (weekday map) for that **calendar date** only.

---

## `HolidayHours` type

`HolidayHours` extends the existing `DayHours` shape with two optional display fields:

```typescript
interface HolidayHours extends DayHours {
  title?: string;        // e.g. "Good Friday"
  description?: string;  // e.g. "Reduced hours for public holiday"
}
```

| Field | Required | Purpose |
|-------|----------|---------|
| `title` | Optional | Short name shown in dashboard / app ("Good Friday", "Staff Training Day"). |
| `description` | Optional | Longer note for staff or customers ("We open late today!"). |
| `isOpen` | Required | `true` = custom hours apply; `false` = closed all day. |
| `open` | When `isOpen: true` | Opening time `"HH:mm"`. |
| `close` | When `isOpen: true` | Closing time `"HH:mm"`. |

`open` / `close` / overnight logic is **identical** to `DayHours`. Flutter's existing `DayHours.fromJson` silently ignores `title` and `description` -- only the display layer needs them (dashboard UI, app info screen, etc.).

---

## Practical examples

### Firestore `stores/{storeId}` document

```json
{
  "docId": "store_auckland_001",
  "name": "Coffix Auckland CBD",
  "storeCode": "AKL01",
  "timezone": "Pacific/Auckland",
  "openingHours": {
    "monday":    { "isOpen": true,  "open": "07:00", "close": "17:00" },
    "tuesday":   { "isOpen": true,  "open": "07:00", "close": "17:00" },
    "wednesday": { "isOpen": true,  "open": "07:00", "close": "17:00" },
    "thursday":  { "isOpen": true,  "open": "07:00", "close": "17:00" },
    "friday":    { "isOpen": true,  "open": "07:00", "close": "18:00" },
    "saturday":  { "isOpen": true,  "open": "08:00", "close": "15:00" },
    "sunday":    { "isOpen": false }
  },
  "holidayHours": {
    "2026-04-02": { "title": "Good Friday",    "description": "Reduced hours for public holiday",      "isOpen": true,  "open": "08:00", "close": "12:00" },
    "2026-04-03": { "title": "Holy Saturday",  "description": "Store closed for the Easter weekend",   "isOpen": false },
    "2026-04-06": { "title": "Easter Monday",  "description": "Reduced hours -- public holiday",       "isOpen": true,  "open": "09:00", "close": "14:00" },
    "2026-12-25": { "title": "Christmas Day",  "description": "Closed -- Merry Christmas!",            "isOpen": false },
    "2026-12-26": { "title": "Boxing Day",     "description": "Closed -- see you tomorrow",            "isOpen": false },
    "2027-01-01": { "title": "New Year's Day", "description": "Closed -- Happy New Year!",             "isOpen": false }
  }
}
```

### What each holiday entry means

| Date key | Title | Hours | Effective behaviour |
|----------|-------|-------|---------------------|
| `2026-04-02` | Good Friday | `08:00-12:00` | Short day -- overrides normal Friday hours. |
| `2026-04-03` | Holy Saturday | closed | Overrides normal Saturday `08:00-15:00`. |
| `2026-04-06` | Easter Monday | `09:00-14:00` | Reduced hours -- overrides normal Monday hours. |
| `2026-12-25` | Christmas Day | closed | -- |
| `2026-12-26` | Boxing Day | closed | -- |
| `2027-01-01` | New Year's Day | closed | -- |

### Two stores -- same holiday, different hours

Each store has **its own** `holidayHours` map so branches can differ:

**City branch (`store_auckland_001`)**
```json
"2026-04-02": {
  "title": "Good Friday",
  "description": "Reduced hours for CBD foot traffic",
  "isOpen": true,
  "open": "08:00",
  "close": "12:00"
}
```

**Suburbs branch (`store_auckland_002`)**
```json
"2026-04-02": {
  "title": "Good Friday",
  "description": "Closed for public holiday",
  "isOpen": false
}
```

Good Friday: City opens for a half-day; Suburbs closes entirely.

---

## Resolution rule (single source of truth)

For "is the store open **right now**?" evaluate in this order:

1. **Holiday for today's date** -- if `holidayHours["yyyy-mm-dd"]` exists for this store, use it (closed or custom `HolidayHours`).
2. **Else** -- use `openingHours` for the weekday of that date (existing Flutter / `store.ts` logic).

All clients (Flutter, dashboard, backend jobs) must use the same order.

---

## Recommended Firestore shape

Keep holidays **on the store document** next to `openingHours` -- one read loads all schedule data.

| Field | Type | Meaning |
|-------|------|---------|
| `holidayHours` | `Record<string, HolidayHours>` | Keys are `"yyyy-mm-dd"` calendar dates; values are `HolidayHours`. |

**Key format:** ISO local calendar date, e.g. `"2026-04-02"`, interpreted in the **store's timezone**.

### Optional: subcollection instead

`stores/{storeId}/exceptions/{yyyy-mm-dd}` is fine if you expect very large histories or need per-date audit logs. For typical retail use, the map on the store document is simpler.

---

## Timezone

Holiday keys are calendar dates -- "April 2" must mean April 2 **at that branch**, not the user's device timezone.

- Add a `timezone` field (IANA, e.g. `"Pacific/Auckland"`) to each store and resolve "today's key" using that zone in app and dashboard.
- If you can't add timezone yet, document one assumed zone for all stores and apply it consistently.

---

## WebApp behaviour

- **List / calendar UI:** show upcoming `holidayHours` entries; allow add, edit, delete.
- **Form fields:** date, title, description, closed toggle, open/close times (times hidden when closed is checked).
- **Permissions:** Admin and Store Manager for their assigned store(s) only.

**Pruning:** optionally remove past entries on save or via a scheduled job to keep document size small; not required for MVP.

---

## Flutter app changes (conceptual)

Add `holidayHours` deserialization to `Store` (same pattern as `openingHours`). Then in `isOpenAt()`:

1. Build today's date key in **store timezone** -> `"yyyy-MM-dd"`.
2. If `holidayHours?[key] != null` -> use that entry's `isOpen` / `open` / `close` (reuse `DayHours.contains`).
3. Else -> existing weekday path from `openingHours`.

Also update `minutesUntilClose`, `todayCloseFormatted`, and `nextOpeningFormatted` to check holidays for "today" and upcoming days.

---

## Dashboard (TypeScript)

- Add `HolidayHours` interface to `app/dashboard/stores/interface/store.ts` (extends `DayHours` with `title?` and `description?`).
- Extend `Store` with `holidayHours?: Record<string, HolidayHours>`.
- Add a helper (e.g. `effectiveHoursFor(store, date)`) that applies the resolution rule and returns `HolidayHours | DayHours | undefined`.

---

## Summary

| Topic | Recommendation |
|-------|----------------|
| Type | `HolidayHours` extends `DayHours` + `title?` + `description?` |
| Storage | `holidayHours: Record<"yyyy-mm-dd", HolidayHours>` on each store document |
| Override | Holiday date key first; else `openingHours` weekday |
| Roles | Admin + Store Manager (branch-scoped) |
| Clients | Flutter + WebApp use same resolution order |
