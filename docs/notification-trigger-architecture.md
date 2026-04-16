# Notification Trigger Architecture

How campaigns stored in Firestore (`campaigns` collection) are actually dispatched to users — for both **immediate** and **scheduled** modes.

---

## Overview

The dashboard only **writes campaign documents** to Firestore. It does not send anything directly. All actual dispatching (FCM, email, popup injection, etc.) must happen in **Firebase Cloud Functions** running server-side.

```
Dashboard  →  Firestore (campaigns/{id})  →  Cloud Function  →  FCM / Email / etc.
```

---

## Immediate Campaigns

**Trigger:** `onDocumentCreated` (or `onDocumentWritten` filtered by status)

When the admin clicks **Send / Schedule** and `scheduleMode === "immediate"`, the dashboard writes the document with `status: "sent"`. A Cloud Function reacts to that write and dispatches immediately.

### Recommended function

```ts
// functions/src/notifications/onCampaignCreated.ts
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sendCampaign } from "./dispatch";

export const triggerImmediateCampaign = onDocumentCreated(
  "campaigns/{campaignId}",
  async (event) => {
    const campaign = event.data?.data();
    if (!campaign) return;

    // Only handle immediate campaigns
    if (campaign.schedule?.mode !== "immediate") return;
    if (campaign.status !== "sent") return;

    await sendCampaign(campaign);
  }
);
```

> Use `onDocumentCreated` (not `onDocumentWritten`) so it only fires once on creation, not on every edit.

### Flow

```
1. Admin clicks "Send / Schedule" (immediate mode)
2. Dashboard writes:  { status: "sent", schedule: { mode: "immediate" } }
3. onDocumentCreated fires
4. Function queries matching users (applies audience filters)
5. Sends FCM / writes popup doc / sends email
6. Function updates campaign:  { sentAt: Timestamp.now() }
```

---

## Scheduled Campaigns

**Trigger:** Cloud Scheduler (cron) + `onDocumentWritten` for status changes

When `scheduleMode === "scheduled"`, the document is written with `status: "scheduled"` and `schedule.sendAt` set to a future timestamp. A cron job polls for due campaigns.

### Recommended function

```ts
// functions/src/notifications/scheduledDispatcher.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { sendCampaign } from "./dispatch";

export const dispatchScheduledCampaigns = onSchedule("every 1 minutes", async () => {
  const db = getFirestore();
  const now = Timestamp.now();

  const snap = await db
    .collection("campaigns")
    .where("status", "==", "scheduled")
    .where("schedule.sendAt", "<=", now)
    .get();

  for (const docSnap of snap.docs) {
    const campaign = docSnap.data();

    // Mark as in-progress immediately to prevent double-dispatch
    await docSnap.ref.update({ status: "sending" });

    try {
      await sendCampaign(campaign);
      await docSnap.ref.update({ status: "sent", sentAt: Timestamp.now() });
    } catch (err) {
      console.error(`Failed to send campaign ${docSnap.id}`, err);
      await docSnap.ref.update({ status: "scheduled" }); // requeue or handle error
    }
  }
});
```

### Flow

```
1. Admin clicks "Send / Schedule" (scheduled mode, future sendAt)
2. Dashboard writes:  { status: "scheduled", schedule: { mode: "scheduled", sendAt: <future> } }
3. Cron runs every minute
4. Query: status == "scheduled" AND sendAt <= now
5. For each match: mark "sending" → dispatch → mark "sent"
```

> **Why mark "sending" first?** Prevents a second cron tick from picking up the same document if dispatching takes >1 minute.

---

## Why Not Use `onDocumentCreated` for Scheduled Campaigns?

`onDocumentCreated` fires immediately on write — before `sendAt` is reached. It would need to either:
- Set up a Cloud Tasks delay per document (more complex, but valid for one-off scheduling), or
- Simply ignore documents where `schedule.mode !== "immediate"` and rely on the cron for the rest.

**Recommendation: use both.**

| Mode        | Trigger mechanism                        | Why                                                  |
| ----------- | ---------------------------------------- | ---------------------------------------------------- |
| `immediate` | `onDocumentCreated` filtered by status   | Reacts instantly, no polling delay                   |
| `scheduled` | Cron job (`every 1 minutes`)             | Simple, reliable, handles arbitrary future times     |

If you want sub-minute precision for scheduled campaigns, use **Cloud Tasks** instead of a cron — the function enqueues a task with the exact `sendAt` time when the document is created. This is more infrastructure but avoids polling entirely.

---

## Dispatch Function (`sendCampaign`)

This is shared by both triggers. It:

1. **Resolves the audience** — queries the `customers` collection applying `audience.storeIds`, `audience.birthdayMonth`, and `audience.filters` (with `filterLogic: AND | OR`)
2. **Sends per channel:**
   - `in_app` → write to `customers/{uid}/notifications`
   - `popup` → write to `customers/{uid}/popups` (app reads on next open)
   - `email` → call SendGrid / Resend API
   - `sms` → call Twilio API
3. **Resolves template variables** — replace `{{firstName}}`, `{{credits}}`, etc. per user
4. **Writes delivery logs** to `campaigns/{campaignId}/logs/{uid}`

```ts
// functions/src/notifications/dispatch.ts
export async function sendCampaign(campaign: NotificationCampaign) {
  const users = await resolveAudience(campaign.audience);

  for (const user of users) {
    const rendered = renderTemplate(campaign.template, user);

    for (const channel of campaign.channels) {
      await dispatchChannel(channel, user, rendered, campaign.docId);
    }
  }
}
```

---

## Firestore Indexes Required

For the scheduled cron query to work, add a composite index:

| Collection | Fields                                   | Order |
| ---------- | ---------------------------------------- | ----- |
| `campaigns`    | `status` ASC, `schedule.sendAt` ASC      | Both  |

Add via `firestore.indexes.json` or the Firebase Console.

---

## Summary

```
Immediate  →  onDocumentCreated  →  sendCampaign()
Scheduled  →  Cron (1 min)       →  query due docs  →  sendCampaign()
```

- **Yes**, use `onDocumentCreated` — but only for immediate campaigns.
- **Yes**, use a cron job — for scheduled campaigns polled by `sendAt`.
- Both call the same `sendCampaign` dispatch function.
