# WebApp: Notifications ↔ Email Templates Integration

## Overview

The **Notifications** feature (`notif` collection) drives campaign dispatch across multiple channels. When the `email` channel is selected, the campaign does **not** store the full HTML body itself — it references an **Email Template** document (`emails` collection) and supplies only the runtime variable values. The template's `content` is fetched, variables are resolved, wrapped in the global shell, and sent.

This keeps email design in one place (Email Templates) while campaigns stay lean and reusable.

---

## How They Connect

```
NotificationCampaign (notif/{id})
  └─ channels: ["email", ...]
  └─ template.emailTemplateId  ──────────► EmailTemplate (emails/{id})
  └─ template.variables: { ... }               └─ content: "Hi {{ firstName }}..."
                │
                ▼
        renderTemplate(content, variables)
                │
                ▼
        inject into global HTML shell
                │
                ▼
        send via email provider
```

### Change to `NotificationCampaign.template`

Add two fields to the existing `template` object:

```ts
template: {
  title: string;           // in-app / push title
  body: string;            // in-app / push body
  buttonText?: string;     // popup only
  buttonUrl?: string;      // popup only
  imageUrl?: string;       // popup / email header image
  subject?: string;        // email subject line
  preheader?: string;      // email preheader text

  // ↓ NEW — email channel only
  emailTemplateId?: string;              // docId of the EmailTemplate to use
  variables?: Record<string, string>;    // runtime values to inject into the template
}
```

### Updated `NotificationCampaign` interface

```ts
// app/dashboard/notifications/interface/notification.ts

export interface NotificationCampaign {
  docId: string;
  name: string;
  channels: NotificationChannel[];
  audience: {
    storeIds?: string[];
    birthdayMonth?: number;
    filters?: UserFilter[];
  };
  template: {
    title: string;
    body: string;
    buttonText?: string;
    buttonUrl?: string;
    imageUrl?: string;
    subject?: string;
    preheader?: string;
    emailTemplateId?: string;           // ← reference to emails/{docId}
    variables?: Record<string, string>; // ← static overrides or defaults
  };
  schedule: {
    mode: ScheduleMode;
    sendAt?: Timestamp;
    recurrence?: "daily" | "weekly" | "monthly";
  };
  status: CampaignStatus;
  createdBy: string;
  createdAt: Timestamp;
  sentAt?: Timestamp;
}
```

---

## Controlling Variables in Freely Written Content

This is the core challenge: the template editor can write **any** `{{ token }}` they want. The system needs to know which tokens are present so it can:

1. Validate that all tokens will be resolvable at send time.
2. Show the campaign editor which values to supply.
3. Prevent silent blanks in sent emails.

### Strategy: parse tokens from `content` on save

When an `EmailTemplate` document is saved, extract all `{{ token }}` occurrences and store them as a `variables` array on the document itself.

```ts
// app/lib/parseTemplateVariables.ts

export function parseTemplateVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}
```

Update `EmailTemplate` to persist this:

```ts
// app/dashboard/emailTemplates/interface/emailTemplate.ts

export interface EmailTemplate {
  docId: string;
  name: string;
  content: string;
  variables: string[];   // ← auto-derived on save, e.g. ["firstName","amount","newBalance"]
  notes?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}
```

On every save in the email template editor:

```ts
const variables = parseTemplateVariables(content);
await EmailTemplateService.save({ ...form, variables });
```

---

## Campaign Editor: Email Channel UX

When the `email` channel is toggled on in a campaign:

1. **Template picker** — dropdown lists all `EmailTemplate` documents by `name`.
2. On selection, the campaign editor reads `emailTemplate.variables` and renders an **input field for each variable**.
3. Variables sourced automatically from the audience (e.g. `firstName`, `email`, `credits`) are pre-filled and marked **"auto"** — the sending service resolves them from the customer's Firestore document at send time.
4. Variables not in the auto list are **"manual"** — the campaign editor must supply a static value (e.g. `amount = "10.00"`).

### Variable resolution order (at send time)

```
1. Per-recipient auto values  (resolved from customers/{uid} at send time)
   firstName, lastName, email, credits, storeName, birthday …

2. Campaign-level static values  (template.variables in the notif document)
   amount, promoCode, expiryDate …

3. System values  (injected by the sending service, never stored)
   currentYear, appUrl, logoUrl …

4. Unresolved tokens  → left as {{ tokenName }} so QA can catch them
```

### Auto-resolved tokens (no manual input needed)

| Token              | Source field on `customers` doc |
| ------------------ | ------------------------------- |
| `{{ firstName }}`  | `firstName`                     |
| `{{ lastName }}`   | `lastName`                      |
| `{{ email }}`      | `email`                         |
| `{{ credits }}`    | `creditAvailable`               |
| `{{ storeName }}`  | resolved from `preferredStoreId`|
| `{{ mobile }}`     | `mobile`                        |
| `{{ suburb }}`     | `suburb`                        |
| `{{ city }}`       | `city`                          |

---

## Send Flow (server-side)

```ts
// Pseudocode — lives in an API route or Cloud Function

async function sendEmailCampaign(campaign: NotificationCampaign, recipient: AppUser) {
  const templateDoc = await getDoc(doc(db, "emails", campaign.template.emailTemplateId!));
  const template = templateDoc.data() as EmailTemplate;

  const variables: Record<string, string> = {
    // 1. auto values from recipient
    firstName:   recipient.firstName ?? "",
    lastName:    recipient.lastName ?? "",
    email:       recipient.email ?? "",
    credits:     String(recipient.creditAvailable ?? 0),
    storeName:   await resolveStoreName(recipient.preferredStoreId),

    // 2. static values from campaign
    ...campaign.template.variables,

    // 3. system values
    currentYear: String(new Date().getFullYear()),
    appUrl:      process.env.APP_URL!,
  };

  const renderedContent = renderTemplate(template.content, variables);
  const fullHtml = wrapInShell(renderedContent, campaign.template.subject);

  await emailProvider.send({
    to:       recipient.email!,
    subject:  campaign.template.subject ?? template.name,
    html:     fullHtml,
  });
}
```

---

## Validation Rules

| Rule                                          | Where enforced              |
| --------------------------------------------- | --------------------------- |
| All `{{ tokens }}` in content must be in `variables` list | Email Template editor on save |
| Campaign must supply values for all "manual" variables | Campaign editor before send |
| `emailTemplateId` required when `email` in channels | Campaign editor validation  |
| `subject` required when `email` in channels   | Campaign editor validation  |
| Unresolved tokens block send (not silently blanked) | Sending service pre-flight  |

---

## Example: "Gift Email" Campaign

### `emails/gift-email` document

```json
{
  "docId": "gift-email",
  "name": "Gift Email",
  "variables": ["firstName", "amount", "newBalance"],
  "content": "<p>Hi {{ firstName }},</p><p>You've received a gift of <strong>${{ amount }}</strong> in Coffix credits!</p><p>Your new balance is <strong>${{ newBalance }}</strong>.</p>",
  "notes": "Triggered by staff when issuing a manual credit gift."
}
```

### `notif/abc123` campaign document

```json
{
  "name": "March Gift Drop",
  "channels": ["email", "in_app"],
  "template": {
    "title": "You've got a gift!",
    "body": "Check your Coffix credits — a gift is waiting.",
    "subject": "A gift from Coffix ☕",
    "emailTemplateId": "gift-email",
    "variables": {
      "amount": "10.00",
      "newBalance": "34.50"
    }
  }
}
```

`firstName` is auto-resolved per recipient; `amount` and `newBalance` are static for this campaign.

---

## Notes

- `variables` on `EmailTemplate` is **derived**, not manually entered — always re-parsed on save.
- Renaming a token in the template (e.g. `{{ amount }}` → `{{ giftAmount }}`) immediately breaks any campaign that previously supplied `amount`. The dashboard should warn when a referenced template's `variables` array no longer matches the campaign's `template.variables` keys.
- Future enhancement: a **diff view** in the Email Templates editor that highlights campaigns currently using the template, so editors understand the blast radius of a rename.
