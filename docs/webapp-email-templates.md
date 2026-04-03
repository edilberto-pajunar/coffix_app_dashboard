# WebApp: Dynamic Email Templates

## Overview

Email content is stored in Firestore and edited entirely from the dashboard — no redeployment or code changes needed. When an email is triggered (e.g. welcome, gift, top-up), the system fetches the matching template document, injects runtime variables, wraps it in the global shell, and sends it.

---

## Global Email Shell

Every email shares the same outer wrapper regardless of template content.

| Property         | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Background       | Very light grey (`#f5f5f5`) surrounding the content card             |
| Content card     | White (`#ffffff`), 900 px wide, no border, centered                  |
| Logo             | Orange Coffix logo, top-center of every email                        |
| Body text        | Black (`#1a1a1a`) on white                                           |
| Font             | System sans-serif stack (or brand font if embedded)                  |

The shell is hardcoded in the sending service and never stored in Firestore. Only the inner `content` block comes from the template document.

### Shell structure (simplified)

```html
<body style="background:#f5f5f5; margin:0; padding:32px 0;">
  <table width="900" align="center" style="background:#fff; border:none;">
    <tr>
      <td align="center" style="padding:32px 0 16px;">
        <!-- Coffix logo -->
        <img src="{{LOGO_URL}}" alt="Coffix" height="48" />
      </td>
    </tr>
    <tr>
      <td style="padding:24px 48px 48px; color:#1a1a1a;">
        <!-- ↓ template content injected here -->
        {{{content}}}
      </td>
    </tr>
  </table>
</body>
```

`LOGO_URL` is an environment variable pointing to the hosted Coffix logo asset.

---

## Firestore Data Model

### `emails` collection

```ts
interface EmailTemplate {
  docId: string;           // auto-generated or slug, e.g. "welcome-email"
  name: string;            // human label, e.g. "Welcome Email", "Gift Email"
  content: string;         // raw HTML (or plain text) with {{ variable }} tokens
  notes?: string;          // internal notes — promotion details, usage context, etc.
  updatedAt?: Timestamp;   // set on every save for audit trail
  updatedBy?: string;      // staff uid who last saved
}
```

### Example document

```json
{
  "docId": "gift-email",
  "name": "Gift Email",
  "notes": "Sent when a staff member issues a manual credit gift to a customer.",
  "content": "<p>Hi {{ firstName }},</p><p>You've received a gift of <strong>${{ amount }}</strong> in Coffix credits. Enjoy your next coffee on us!</p><p>Your new balance is <strong>${{ newBalance }}</strong>.</p>",
  "updatedAt": "2026-04-01T00:00:00Z",
  "updatedBy": "uid_admin_001"
}
```

---

## Variable Tokens

Use `{{ variableName }}` syntax (Handlebars-style, double curly braces). The sending service performs a simple find-and-replace before wrapping in the shell.

### Standard tokens (always available)

| Token              | Resolves to                              |
| ------------------ | ---------------------------------------- |
| `{{ firstName }}`  | Recipient's first name                   |
| `{{ lastName }}`   | Recipient's last name                    |
| `{{ email }}`      | Recipient's email address                |
| `{{ credits }}`    | Current credit balance                   |
| `{{ storeName }}`  | Customer's preferred store               |
| `{{ appUrl }}`     | Deep-link / app download URL             |
| `{{ currentYear }}`| Current 4-digit year (for footers)       |

### Template-specific tokens

Defined per template. Document them in the `notes` field so editors know what is available at send time.

| Template          | Extra tokens                                      |
| ----------------- | ------------------------------------------------- |
| Gift Email        | `{{ amount }}`, `{{ newBalance }}`                |
| Welcome Email     | `{{ verifyUrl }}`                                 |
| Top-Up Email      | `{{ topUpAmount }}`, `{{ newBalance }}`           |
| Birthday Email    | `{{ birthdayMonth }}`, `{{ promoCode }}`          |
| Notification Email| `{{ subject }}`, `{{ body }}` (free-form content) |

---

## How Dynamic Rendering Works

```
1. Trigger (action in dashboard or app event)
       ↓
2. Look up emails/{templateId} in Firestore
       ↓
3. Replace all {{ token }} occurrences with runtime values
       ↓
4. Inject rendered content into the global HTML shell
       ↓
5. Send via email provider (use resendAPI) to recipient
```

The substitution logic lives in a single server-side utility (e.g. `app/lib/renderEmailTemplate.ts`) so it can be unit-tested independently of the sending provider.

```ts
// app/lib/renderEmailTemplate.ts
export function renderTemplate(
  content: string,
  variables: Record<string, string | number>
): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    String(variables[key] ?? `{{ ${key} }}`)
  );
}
```

Unresolved tokens are left as-is (not silently removed) so missing data is visible during QA.

---

## Dashboard: Email Templates Page

### List view

- Table of all `emails` documents: **Name**, **Notes preview**, **Last updated**, **Updated by**.
- **+ New Template** button — opens the editor with a blank document.

### Editor

- **Name** — text input.
- **Notes** — multi-line text area for internal context.
- **Content** — full HTML editor (WYSIWYG toggle ↔ raw HTML). Toolbar includes Insert Variable dropdown populated from the standard token list.
- **Preview** button — renders the template inside the global shell with sample data so editors see exactly what recipients receive.
- **Save** — writes back to Firestore, stamping `updatedAt` and `updatedBy`.

### Preview sample data

The preview modal fills tokens with placeholder values:

```json
{
  "firstName": "Alex",
  "lastName": "Smith",
  "email": "alex@example.com",
  "credits": "24.50",
  "amount": "10.00",
  "newBalance": "34.50",
  "storeName": "Coffix CBD",
  "promoCode": "BIRTHDAY20",
  "appUrl": "https://coffix.app"
}
```

---

## Access Control

- **Admin only** — full read, create, edit, delete on `emails` documents.
- **Store Manager** — no access.

Firestore rule outline:

```js
match /emails/{docId} {
  allow read, write: if isAdmin();
}
```

---

## Notes

- The global shell (logo, background, 900 px width) is **never** stored in Firestore — it lives in code so a design update can be shipped without touching every template document.
- Keep `content` as valid HTML fragments (not full `<html>` documents) — the shell provides the outer structure.
- Plain-text fallback: store a `contentText` field with a stripped-down version for email clients that block HTML.
- Avoid inline `<style>` blocks; use inline `style=""` attributes for maximum email client compatibility.
- Test renders in at least Gmail, Apple Mail, and Outlook before marking a template production-ready.
