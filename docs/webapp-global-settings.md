# WebApp: Global Settings

## Overview

The Coffix dashboard exposes a **Global Settings** panel (Admin-only) that controls app-wide variables stored in a single Firestore document. Changes take effect immediately across the mobile app — no redeployment required.

### Firestore location

```
global/{documentId}/{COLLECTION_GLOBAL_SETTINGS} -> use this as COLLECTION_GLOBAL_SETTINGS
```

A single document holds all fields. Any field left `undefined` falls back to the app's compiled default.

---

## Fields


| Field                | Type     | Description                                                                                  |
| -------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `GST`                | `number` | Goods and Services Tax rate applied at checkout (e.g. `0.09` = 9%).                          |
| `appVersion`         | `string` | Minimum required mobile app version. Users below this version are prompted to update.        |
| `basicDiscount`      | `number` | Default discount rate for Level-1 loyalty members (e.g. `0.05` = 5%).                        |
| `discountLevel2`     | `number` | Discount rate for Level-2 loyalty members.                                                   |
| `discountLevel3`     | `number` | Discount rate for Level-3 loyalty members.                                                   |
| `maxDayBetweenLogin` | `number` | Maximum idle days before a customer account is flagged or deactivated.                       |
| `minCreditToShare`   | `number` | Minimum credit balance a customer must hold before they can share credits with another user. |
| `minTopUp`           | `number` | Minimum top-up amount allowed in a single transaction (e.g. `10` = $10.00).                  |
| `specialUrl`         | `string` | Deep-link or external URL surfaced inside the app for promotions or special events.          |
| `storeUrl`           | `string` | Public storefront / ordering URL shown to customers.                                         |
| `tcUrl`              | `string` | URL to the Terms & Conditions document displayed during onboarding or checkout.              |
| `topupLevel2`        | `number` | Cumulative top-up threshold that qualifies a customer for Level-2 loyalty status.            |
| `topupLevel3`        | `number` | Cumulative top-up threshold that qualifies a customer for Level-3 loyalty status.            |
| `withdrawalFee`      | `number` | Flat or percentage fee deducted when a customer withdraws or redeems credits.                |


---

## Access control

- **Admin only.** Global Settings must be locked behind the `admin` role in both the dashboard UI and Firestore security rules.
- **Store Managers** have no read or write access to this document.

Firestore rule outline:

```js
match /global/{docId} {
  allow read, write: if isAdmin();
}
```

---

## Editing in the dashboard

1. Navigate to **Global Settings** in the sidebar.
2. All current values are pre-filled from the Firestore document.
3. Edit any field and press **Save** — a single `update()` call patches only the changed fields.
4. Changes propagate to the mobile app on the next API/Firestore read (no app restart needed for most variables; `appVersion` takes effect on next app launch).

---

## Notes

- All numeric discount and fee fields should be validated as non-negative.
- `minTopUp` and `minCreditToShare` should be validated as `> 0`.
- `appVersion` should follow **semver** format (`major.minor.patch`).
- URL fields (`specialUrl`, `storeUrl`, `tcUrl`) should be validated as well-formed HTTPS URLs before saving.

