# Notifications Redesign Plan

Target feature: Admin "Campaigns" flow at `/dashboard/notifications`.
Backing collection: `campaigns` (Firestore).
Send execution: lives in a separate backend repo — this dashboard only writes config.

---

## 1. Context

`app/dashboard/notifications/page.tsx` is a 1038-line monolith with one giant dialog
that conditionally reveals fields for four channels (`in_app`, `popup`, `email`,
`sms`). The goals of this redesign:

- Retire `popup` and `sms` from the UI.
- Give each active channel its own configuration card (Push, Email).
- Email uses the existing Email Templates system — pick one from a dropdown
  instead of re-entering subject / body / imageUrl.
- Richer audience targeting: grouped AND/OR filters so admins can express
  `(email == X OR firstName == Y) AND (lastName == Z)`.
- Schedule is one-time only: `immediate` or `scheduled`.
- Clarify action buttons, especially **Test** — which should trigger the send
  via the backend API without persisting a campaign doc.
- Split the monolithic page into smaller composable files.

What stays the same:
- Firestore collection (`campaigns`) and `NotificationService`.
- Zustand real-time store pattern.
- Admin role gating for create / edit / delete.
- The list table, search, channel / status filter pills, sort.

---

## 2. Data Model Changes

File: `app/dashboard/notifications/interface/notification.ts`

```ts
// UI exposes these two; legacy values stay in the union so we can deserialize
// old docs without throwing.
export type NotificationChannel = "in_app" | "popup" | "email" | "sms";
export const ACTIVE_CHANNELS: NotificationChannel[] = ["in_app", "email"];

// One-time only going forward. Legacy "recurring" left in the union solely so
// old docs in Firestore don't break the type when read.
export type ScheduleMode = "immediate" | "scheduled" | "recurring";

export type CampaignStatus = "draft" | "scheduled" | "sent" | "cancelled";

export type FilterCombinator = "AND" | "OR";

export interface UserFilter {
  field: string;
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<" | "array-contains";
  value: string | number | boolean;
}

export interface FilterGroup {
  combinator: FilterCombinator; // within a group: how its rows combine
  filters: UserFilter[];
}

export interface NotificationCampaign {
  docId: string;
  name: string;
  channels: NotificationChannel[];

  audience: {
    storeIds?: string[];
    birthdayMonth?: number; // 1–12

    // NEW — preferred shape
    filterGroups?: FilterGroup[];
    groupLogic?: FilterCombinator; // top-level: how groups combine

    // LEGACY (read-only; migrated on form load, never written back)
    filters?: UserFilter[];
    filterLogic?: FilterCombinator;
  };

  // NEW — per-channel configuration replaces the flat `template` object.
  channelConfig: {
    push?: {
      title: string;
      body: string;
      imageUrl?: string;
    };
    email?: {
      emailTemplateId: string; // docId of an EmailTemplate in `emails` collection
    };
  };

  // LEGACY — older docs still have `template`; kept optional so reads don't
  // throw. We never write this on new saves.
  template?: {
    title?: string;
    body?: string;
    buttonText?: string;
    buttonUrl?: string;
    imageUrl?: string;
    subject?: string;
    preheader?: string;
  };

  schedule: {
    mode: ScheduleMode;
    sendAt?: Timestamp;
    recurrence?: "daily" | "weekly" | "monthly"; // legacy-only
  };

  status: CampaignStatus;
  createdBy: string;
  createdAt: Timestamp;
  sentAt?: Timestamp;
}
```

### 2.1 Why `channelConfig` instead of extending `template`

- The word "template" already means `EmailTemplate` (a doc in the `emails`
  collection). Overloading it is confusing.
- Per-channel cards map 1:1 to `channelConfig.push` / `channelConfig.email`.
- Adding future channels is additive, not another conditional branch in a flat bag.

### 2.2 Migration approach — on-load only

No bulk Firestore migration. When an old doc is opened for edit, the form loader
(`campaignToForm`) normalizes:

1. `channels` → drop `"popup"` and `"sms"` from the selection.
2. If `channelConfig.push` missing AND legacy `template.title`/`template.body`
   present AND doc has `in_app` channel → hydrate push card from legacy
   `template`.
3. If `channelConfig.email?.emailTemplateId` missing → leave empty; admin must
   pick a template before saving.
4. `audience.filterGroups` missing but legacy `audience.filters` present →
   wrap legacy rows in a single group using legacy `filterLogic` as that
   group's combinator; set top-level `groupLogic = "AND"`.
5. `schedule.mode === "recurring"` → coerce to `"scheduled"` with empty
   `sendAt`; toast: "This campaign used a legacy recurring mode — please
   choose a one-time send date."

On save, we write only the new shape. Legacy fields are not rewritten — reads
remain tolerant until the doc is edited.

### 2.3 Display-time adapters

New file: `app/dashboard/notifications/utils/campaignAdapters.ts`

- `getDisplayChannels(c) → NotificationChannel[]` — filters out `popup` / `sms`.
- `getDisplayTitle(c) → string` — prefers `channelConfig.push.title`, falls back to `template?.title`, then `name`.
- `formatSchedule(c) → string` — same logic as current helper; coerces legacy `"recurring"` to a readable label.

---

## 3. UI Structure — File Organization

Split `page.tsx` into focused modules under `app/dashboard/notifications/`:

```
notifications/
├── page.tsx                         (list page + dialog host — ~180 lines)
├── interface/
│   └── notification.ts              (updated types, §2)
├── service/
│   └── NotificationService.ts       (unchanged)
├── store/
│   └── useNotificationStore.ts      (unchanged)
├── utils/
│   ├── campaignAdapters.ts          (display helpers, formatSchedule)
│   ├── campaignForm.ts              (CampaignForm type, emptyForm,
│   │                                  campaignToForm, formToPayload, validators)
│   └── filterFields.ts              (USER_FILTER_FIELDS, OPERATORS,
│                                     MONTH_NAMES, CHANNEL_LABELS, STATUS_STYLES)
└── components/
    ├── CampaignDialog.tsx           (form shell: header, sections, footer)
    ├── CampaignBasicsSection.tsx    (name + active channel multi-select)
    ├── AudienceSection.tsx          (stores + birthday month + filter groups)
    ├── FilterGroupList.tsx          (list of groups + top-level AND/OR)
    ├── FilterGroupCard.tsx          (single group: rows + per-group AND/OR)
    ├── FilterRow.tsx                (field / operator / value / remove)
    ├── ChannelCards.tsx             (renders one card per selected channel)
    ├── PushChannelCard.tsx          (title, body, imageUrl)
    ├── EmailChannelCard.tsx         (template dropdown + "Manage templates" link)
    ├── ScheduleSection.tsx          (immediate | scheduled + datetime)
    ├── CampaignActions.tsx          (Cancel / Save Draft / Test / Send)
    └── DeleteCampaignDialog.tsx     (lifted from page.tsx)
```

Rules:
- `CampaignDialog` owns `useState<CampaignForm>`, `errors`, and `loading`.
- Children take `form` and `setForm` (or slice + setter) as props. No global state.
- Channel cards render only when their channel is present in `form.channels`.
- Replace the ad-hoc `fixed inset-0` overlay with `components/ui/dialog.tsx`
  (Radix) for free ESC-close and focus trap.
- Replace hand-rolled footer buttons with `components/ui/button.tsx` variants.

---

## 4. Per-Channel Card Specs

### 4.1 Push Notification card — `PushChannelCard.tsx`

Rendered when `form.channels` includes `"in_app"`.

Fields:
- **Title** (required) — text input.
  Placeholder: `"Happy Birthday, {{firstName}}! 🎂"`.
- **Body** (required) — textarea, 3 rows.
- **Image URL** (optional) — plain URL string; no file upload in this pass.

Validation: `errors.pushTitle`, `errors.pushBody` when channel is active.
Writes to: `form.channelConfig.push`.
Payload: `channelConfig.push = { title, body, imageUrl? }`.

### 4.2 Email card — `EmailChannelCard.tsx`

Rendered when `form.channels` includes `"email"`.

Fields:
- **Template dropdown** (required) — `<select>` populated from
  `useEmailTemplateStore().templates`.
  - Option label: `"{template.name} — {template.subject}"`.
  - Option value: `template.docId`.
  - First option: `"Select a template…"` (disabled placeholder).
  - Empty state (no templates exist): disable the select, show helper text
    "No email templates yet — create one first."
- **Manage Email Templates** secondary button next to the dropdown:
  - Next `<Link href="/dashboard/emailTemplates" target="_blank" rel="noopener noreferrer">`
    so in-progress form state is preserved.
- **Inline preview** (collapsible, read-only): when a template is selected,
  show its `subject` and the first ~200 chars of `content` so admins can
  confirm the choice without leaving the page.

No free-form subject, preheader, imageUrl, or body on this card.

Validation: `errors.emailTemplateId` when channel is active but no template selected.
Writes to: `form.channelConfig.email.emailTemplateId`.

Subscription: `page.tsx` calls `useEmailTemplateStore(s => s.listenToTemplates)()`
in an effect (same pattern as existing pages).

### 4.3 Channel card container — `ChannelCards.tsx`

- Vertical stack. Each card is a bordered `rounded-xl` container matching
  the existing audience / message card styling.
- Card header: channel label + a small `X` that unchecks the channel in
  `form.channels`.
- If no active channel is selected: muted empty state — "Select at least one
  channel above to configure its message."

---

## 5. Audience Filter Groups

### 5.1 Data shape

```ts
audience.filterGroups: FilterGroup[]
audience.groupLogic: "AND" | "OR"   // default "AND"
```

A `FilterGroup` is `{ combinator: "AND" | "OR", filters: UserFilter[] }`.

Interpretation:
```
groups.map(g => g.filters.join(g.combinator)).join(groupLogic)
```

Example — `(email == X OR firstName == Y) AND (lastName == Z)`:
```ts
filterGroups: [
  { combinator: "OR", filters: [
      { field: "email",     operator: "==", value: "X" },
      { field: "firstName", operator: "==", value: "Y" },
  ]},
  { combinator: "AND", filters: [
      { field: "lastName",  operator: "==", value: "Z" },
  ]},
],
groupLogic: "AND",
```

### 5.2 UI layout

`FilterGroupList` (inside `AudienceSection`):
- Header: "Custom User Filters" label + `[+ Add group]` button.
- When 2+ groups exist, a top-level AND/OR toggle appears next to the header.
- Between adjacent groups, a small centered badge shows the current
  `groupLogic` value (non-interactive; toggled from the header pill).

`FilterGroupCard`:
- Bordered card with faint background (`bg-background/50`) to separate from the
  outer audience card.
- Header: "Group N" + per-group AND/OR pill toggle (visible only when the
  group has 2+ rows) + "Remove group" `X`.
- Body: rows stacked; between adjacent rows, show the group's combinator.
- Footer: `[+ Add condition]` button.

`FilterRow`:
- Same field / operator / value / remove controls as today, extracted from
  `page.tsx` lines 427–473 into a dedicated component.
- Field select uses `USER_FILTER_FIELDS`; operator uses `OPERATORS`.

Empty state: when `filterGroups` is empty, show only the `[+ Add group]`
button. Clicking it creates
`{ combinator: "AND", filters: [{ field: "", operator: "==", value: "" }] }`.

Cleanup on save (in `formToPayload`):
- Drop rows with blank `field` or blank `value`.
- Drop groups that become empty after row cleanup.
- If no groups remain, omit `audience.filterGroups` and `audience.groupLogic`.

> Out of scope here: push-notification topic subscription is owned by the
> separate backend API repo. The dashboard only writes filter config.

---

## 6. Schedule Section

File: `ScheduleSection.tsx`.

- Two radio options only: `immediate`, `scheduled`. No "recurring" anywhere.
- When `scheduled` is selected, show the existing `datetime-local` input and
  require a non-empty value (`errors.sendAt`).
- On save, explicitly clear `schedule.recurrence` from the payload — new docs
  must never carry it.

---

## 7. Action Buttons (Footer)

File: `CampaignActions.tsx`. Order is preserved. All buttons use
`components/ui/button.tsx` variants.

| Button         | Writes to Firestore?        | Triggers send? | Close dialog? |
|----------------|-----------------------------|----------------|---------------|
| Cancel         | No                          | No             | Yes           |
| Save as Draft  | Yes, status=`draft`         | No             | Yes           |
| **Test**       | **No**                      | **Yes (API)**  | **No**        |
| Send / Schedule| Yes, status=`sent`/`scheduled` | Yes (backend reads doc) | Yes |

### 7.1 Test button

Per user decision: **tests do NOT create a `campaigns` doc.** A test click
should reach the send backend directly so the admin can verify delivery
without polluting the campaigns list.

Behavior:
- Runs full form validation. On failure: no action, errors highlighted,
  dialog stays open.
- On valid form: build the same payload `formToPayload(form, { status: "sent" })`
  would produce, then POST it to the backend test endpoint (see below).
- Dialog **does not close**.
- Toast on success: "Test notification sent — check your device / inbox."
- Toast on failure: surface the error message.
- After success: show a small "Last test sent HH:mm:ss" chip next to the Test
  button.

**Open question — trigger mechanism.** The send API lives in a separate repo.
Before implementation we need to decide which of the following the backend
already exposes (or will expose):

- A dedicated POST endpoint (e.g. `POST /notifications/test`) that accepts the
  campaign payload plus a `testRecipient` (admin user id / FCM token / email)
  and sends only to that recipient.
- An existing endpoint we can call with a transient flag.

The implementation requires at least one of these. If neither exists, we
coordinate with the backend repo before shipping Test. Do not fall back to
writing a test doc — that contradicts the user's requirement.

Environment variable (suggested): `NEXT_PUBLIC_NOTIFICATIONS_API_URL`.
Auth: Firebase ID token on the admin's current session
(`auth.currentUser?.getIdToken()`), sent as `Authorization: Bearer …`.

### 7.2 Send / Schedule

- Writes to `campaigns` via `NotificationService.createCampaign` /
  `updateCampaign` (same as today).
- `status = "sent"` when `schedule.mode === "immediate"`, else `"scheduled"`.
- Closes the dialog on success.
- Backend watches the `campaigns` collection and performs the send.

### 7.3 Save as Draft

- `status = "draft"`. No send.
- Closes the dialog.
- Full validation still runs (we don't want half-baked drafts).

### 7.4 Shared save pipeline

In `campaignForm.ts`:

```ts
formToPayload(form, { status }):
  Omit<NotificationCampaign, "docId" | "createdBy" | "createdAt">
```

All three "save" buttons (Draft, Send, Schedule) go through this. Test
reuses the same payload builder but sends it to the API instead of Firestore.

---

## 8. Files to Create / Modify

### 8.1 Modify

- `app/dashboard/notifications/interface/notification.ts` — add `FilterGroup`,
  `channelConfig`, `ACTIVE_CHANNELS`; keep legacy fields optional.
- `app/dashboard/notifications/page.tsx` — reduce to list / table / search /
  filter / sort / delete. Delegate the dialog to `CampaignDialog`. Remove the
  inline `CampaignForm` type, helpers, and giant `CampaignDialog` function.
  Trim channel filter pills to `in_app` and `email` only.

### 8.2 Create

- `app/dashboard/notifications/utils/campaignForm.ts`
- `app/dashboard/notifications/utils/campaignAdapters.ts`
- `app/dashboard/notifications/utils/filterFields.ts`
- `app/dashboard/notifications/components/CampaignDialog.tsx`
- `app/dashboard/notifications/components/CampaignBasicsSection.tsx`
- `app/dashboard/notifications/components/AudienceSection.tsx`
- `app/dashboard/notifications/components/FilterGroupList.tsx`
- `app/dashboard/notifications/components/FilterGroupCard.tsx`
- `app/dashboard/notifications/components/FilterRow.tsx`
- `app/dashboard/notifications/components/ChannelCards.tsx`
- `app/dashboard/notifications/components/PushChannelCard.tsx`
- `app/dashboard/notifications/components/EmailChannelCard.tsx`
- `app/dashboard/notifications/components/ScheduleSection.tsx`
- `app/dashboard/notifications/components/CampaignActions.tsx`
- `app/dashboard/notifications/components/DeleteCampaignDialog.tsx`

### 8.3 Do NOT touch

- `service/NotificationService.ts` — Firestore shape is tolerant.
- `store/useNotificationStore.ts`.
- `emailTemplates/*` — we only read its store.
- `stores/store/useStoreStore.ts`.
- Firestore security rules — verify existing admin-write rules cover the new
  keys (`channelConfig`, `filterGroups`, `groupLogic`); they should.

### 8.4 Reuse notes

- `components/ui/dialog.tsx` (Radix) — replace the ad-hoc overlay.
- `components/ui/button.tsx` — consistent variants for all footer actions.
- `useEmailTemplateStore` — already exists; new subscription hook call only.
- Existing store multi-select pattern from current `page.tsx` — lift into
  `AudienceSection` as-is.

---

## 9. Out of Scope

- **Push topic subscription / FCM device targeting.** Owned by the backend API repo.
- **SMS channel.** Removed from UI; legacy docs tolerated on read.
- **Popup channel.** Same as SMS.
- **Recurring schedules.** Removed entirely — one-time only.
- **Image upload for push.** URL field only; Firebase Storage upload deferred.
- **Email template inline authoring.** Admin uses the dedicated
  `/dashboard/emailTemplates` page via the "Manage Email Templates" link.
- **Bulk Firestore migration.** On-load normalization only.
- **Audience size preview / recipient count.** Not in this pass.
- **Persisting test sends.** Per user decision, tests hit the backend API
  directly and never write to Firestore.

---

## 10. Verification (manual — no test runner in repo)

Run `npm run dev`. Exercise each scenario below.

### 10.1 Smoke
- `/dashboard/notifications` loads; table shows existing campaigns; search,
  filter pills, sort still work.

### 10.2 New campaign — push only
1. Click "New Campaign".
2. Name it. Check only "Push Notification".
3. Fill title + body; leave imageUrl empty.
4. Audience: select 2 stores, birthday month = June.
5. Save as Draft → dialog closes, row appears with status `draft`.
6. In Firestore, confirm the doc has:
   - `channels: ["in_app"]`
   - `channelConfig.push: { title, body }` — no `imageUrl` key
   - `audience.storeIds.length === 2`, `audience.birthdayMonth === 6`
   - No `template`, no `filters`, no `filterLogic`.

### 10.3 New campaign — email only
1. Check only "Email". Push card disappears; email card appears.
2. Confirm the dropdown lists all templates from `/dashboard/emailTemplates`.
3. Select one. Click "Manage Email Templates" — opens in a new tab.
4. Save as Draft. In Firestore:
   - `channelConfig.email.emailTemplateId === <selected docId>`
   - No `channelConfig.push`.
5. Empty-template case: rename/delete all templates; confirm the select is
   disabled and email-card validation blocks save.

### 10.4 Both channels
- Check both. Both cards render (Push, then Email).
- Fill both. Save → doc has both `channelConfig.push` and `channelConfig.email`.

### 10.5 Filter groups
1. Audience → Add group. Add two rows:
   `email == a@b.com`, `firstName == Al`. Set group combinator to OR.
2. Add a second group with one row: `lastName == Smith`. Top-level logic AND.
3. Save. Firestore shows:
   ```
   audience.filterGroups: [
     { combinator: "OR",  filters: [email==a@b.com, firstName==Al] },
     { combinator: "AND", filters: [lastName==Smith] },
   ]
   audience.groupLogic: "AND"
   ```
   No legacy `filters`/`filterLogic` keys.
4. Reopen the campaign — UI reflects the exact structure.
5. Delete all rows in one group and save — that group is dropped.
6. Delete all groups and save — `filterGroups` key is absent.

### 10.6 Legacy migration
1. Manually edit a test doc in Firestore to legacy shape:
   ```
   channels: ["in_app", "popup", "sms"]
   template: { title: "Hi", body: "Yo" }
   audience: { filters: [{field:"email",operator:"==",value:"x"}],
               filterLogic: "OR" }
   schedule.mode: "recurring"
   ```
2. Open that campaign for edit. Confirm:
   - Channel checkboxes show only `in_app` checked (popup / sms removed).
   - Push card prefilled from legacy `template`.
   - Audience shows one group with one row `email == x`, combinator `OR`,
     no top-level pill (only 1 group).
   - Schedule radio snaps to `"scheduled"` + toast informs about the legacy
     recurring coercion.
3. Save. New-shape doc is written. Legacy fields remain (stale, ignored).

### 10.7 Schedule
1. Scheduled mode + empty datetime → Send disabled / errors.
2. Scheduled mode + future datetime → doc has
   `schedule.mode: "scheduled"` and correct `sendAt` Timestamp.

### 10.8 Test button
1. Open a new campaign, fill valid fields.
2. Click Test. Dialog STAYS open. Toast: "Test notification sent…"
3. Firestore `campaigns` count **does not change** — no doc written.
4. Admin device / inbox receives the notification (confirms backend call).
5. Invalid form + Test → no API call, errors highlighted, dialog stays open.
6. If backend endpoint is unreachable → error toast surfaces the failure;
   still no Firestore write.

### 10.9 Delete / Cancel
- Delete still works via confirmation dialog.
- Cancel closes without writing.

### 10.10 Role gating
- As non-admin, "New Campaign", Edit, Delete are hidden (existing behavior).

### 10.11 Regression — table display
- Legacy docs (with `template` but no `channelConfig`) still render: channels
  show `in_app`/`email` only, schedule label readable, no runtime errors.

---

## 11. Critical Files for Implementation

- `app/dashboard/notifications/page.tsx`
- `app/dashboard/notifications/interface/notification.ts`
- `app/dashboard/notifications/service/NotificationService.ts`
- `app/dashboard/notifications/store/useNotificationStore.ts`
- `app/dashboard/emailTemplates/store/useEmailTemplateStore.ts`
- `app/dashboard/emailTemplates/interface/emailTemplate.ts`
- `app/dashboard/users/interface/user.ts`
- `app/dashboard/stores/store/useStoreStore.ts`
- `components/ui/dialog.tsx`
- `components/ui/button.tsx`

---

## 12. Open Questions (resolve before implementation)

1. **Test endpoint.** Does the backend repo expose a test-only send endpoint?
   If not, we need one before the Test button can ship per spec. Candidate:
   `POST {NEXT_PUBLIC_NOTIFICATIONS_API_URL}/notifications/test`.
2. **Test recipient scoping.** Should the test go only to the admin triggering
   it (FCM token from `auth.currentUser`, email from their profile), or to a
   configurable "test audience" in global settings?
3. **Auth transport.** Firebase ID token as Bearer header — confirm backend
   accepts this.
