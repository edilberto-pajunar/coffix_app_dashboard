# WebApp: Notification Management

## Overview

Admins can compose and dispatch targeted notifications to app users through multiple channels. Notifications are configured in the dashboard and delivered based on user criteria — no code changes required.

---

## Channels

| Channel        | Description                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| **In-App**     | Notification appears inside the mobile app (notification bell / feed).      |
| **Popup**      | Full-screen or modal overlay shown on the next app launch or on a trigger.  |
| **Email**      | Sent to the user's registered email address.                                |
| **SMS**        | Sent to the user's registered mobile number.                                |

A single campaign can target **one or more channels simultaneously**.

---

## Audience Targeting

Notifications can be scoped to a subset of users using any combination of the filters below.

### Location

- Filter by **preferred store** or the **last-used store** on the customer's profile.
- Multiple stores can be selected (OR logic — any matching store qualifies).

### Birthday month

- Send to all users whose birthday falls **in the current month** (or a specified month).
- Useful for birthday reward pushes without manual list exports.

### Custom user criteria

Any field on the `customers` document can be used as a filter:

| Example criterion       | Field              | Operator        | Value         |
| ----------------------- | ------------------ | --------------- | ------------- |
| High-value customers    | `totalTopUp`       | `>=`            | `500`         |
| Inactive users          | `lastLoginAt`      | `<=`            | `[date]`      |
| Loyalty level           | `loyaltyLevel`     | `==`            | `2`           |
| Credit balance          | `credits`          | `>`             | `0`           |
| Specific membership tag | `tags`             | `array-contains`| `"vip"`       |

Multiple criteria are combined with **AND** logic by default. OR groups can be supported via filter groups (future enhancement).

---

## Message Templates

Each channel has its own template format. Templates support **variable interpolation** using `{{variable}}` placeholders.

### Available variables

| Variable          | Resolves to                              |
| ----------------- | ---------------------------------------- |
| `{{firstName}}`   | Customer's first name                    |
| `{{lastName}}`    | Customer's last name                     |
| `{{credits}}`     | Current credit balance                   |
| `{{storeName}}`   | Customer's preferred / nearest store     |
| `{{month}}`       | Current month name                       |
| `{{promoCode}}`   | Attached promo code (if any)             |
| `{{appUrl}}`      | Deep-link into the app                   |

### In-app notification template

```
Title:   Happy Birthday, {{firstName}}! 🎂
Body:    Your birthday gift is waiting — redeem {{credits}} credits at {{storeName}}.
```

### Popup template

```
Title:       It's your month, {{firstName}}!
Body:        Enjoy a special treat this {{month}}.
Button text: Claim Now
Button URL:  {{appUrl}}
Image URL:   (optional banner image)
```

### Email template

Full HTML or plain-text body. The editor supports a WYSIWYG/HTML toggle. Minimum recommended fields:

- **Subject** — supports `{{variable}}` interpolation.
- **Preheader** — short preview text shown in the inbox.
- **Body** — full content with optional image and CTA button.

### SMS template

Plain text only, 160-character limit per segment. Example:

```
Hi {{firstName}}, your Coffix credits are ready! Visit {{storeName}} to redeem. Reply STOP to opt out.
```

---

## Scheduling

| Mode          | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| **Immediate** | Notification is dispatched as soon as the campaign is saved.    |
| **Scheduled** | Deliver at a specific date and time (stored in Firestore).      |
| **Recurring** | Repeat on a cadence (daily, weekly, monthly) — e.g. birthday.  |

---

## Firestore Data Model

### `notifications` collection — campaign definitions

```ts
interface NotificationCampaign {
  id: string;
  name: string;                          // Internal campaign label
  channels: ("in_app" | "popup" | "email" | "sms")[];
  audience: {
    storeIds?: string[];                 // Target specific stores
    birthdayMonth?: number;              // 1–12
    filters?: UserFilter[];             // Custom criteria
  };
  template: {
    title: string;
    body: string;
    buttonText?: string;                 // Popup only
    buttonUrl?: string;                  // Popup only
    imageUrl?: string;                   // Popup / email only
    subject?: string;                    // Email only
    preheader?: string;                  // Email only
  };
  schedule: {
    mode: "immediate" | "scheduled" | "recurring";
    sendAt?: Timestamp;                  // For scheduled
    recurrence?: "daily" | "weekly" | "monthly";
  };
  status: "draft" | "scheduled" | "sent" | "cancelled";
  createdBy: string;                     // Staff uid
  createdAt: Timestamp;
  sentAt?: Timestamp;
}

interface UserFilter {
  field: string;                         // Firestore field path on customers doc
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<" | "array-contains";
  value: string | number | boolean;
}
```

### `notifications/{campaignId}/logs` sub-collection — delivery receipts

```ts
interface NotificationLog {
  userId: string;
  channel: "in_app" | "popup" | "email" | "sms";
  status: "sent" | "delivered" | "failed" | "opened";
  sentAt: Timestamp;
  error?: string;
}
```

---

## Access Control

- **Admin only** — full create, edit, delete, and send.
- **Store Manager** — read-only visibility into campaigns targeting their assigned store(s). No send or edit access.

Firestore rule outline:

```js
match /notifications/{campaignId} {
  allow read: if isAdmin() || isManagedStoreMatch(resource);
  allow write: if isAdmin();
}
```

---

## Dashboard Flow

1. Go to **Notifications** in the sidebar.
2. Click **New Campaign**.
3. **Select channels** — In-App, Popup, Email, SMS (multi-select).
4. **Build audience** — add store filter, birthday month toggle, and/or custom user field criteria.
5. **Write message** — pick a template per channel and fill in or customise the content using `{{variable}}` tokens.
6. **Set schedule** — Immediate, Scheduled date/time, or Recurring.
7. **Preview** — see a rendered preview for each channel before sending.
8. **Save as Draft** or **Send / Schedule**.

---

## Notes

- SMS and Email delivery depend on an integrated third-party provider (e.g. Twilio for SMS, SendGrid for Email). Credentials are stored as environment variables, not in Firestore.
- `opt-out` / unsubscribe state per channel should be respected before dispatch (`customers.smsOptOut`, `customers.emailOptOut`).
- In-app notifications are written directly to a `customers/{uid}/notifications` sub-collection; the mobile app listens in real time.
- Popup notifications are stored and served on the next app open; only one active popup per user at a time is recommended.
