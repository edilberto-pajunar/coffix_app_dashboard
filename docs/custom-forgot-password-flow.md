# Custom Forgot Password Flow

## Overview

Replace Firebase's built-in `sendPasswordResetEmail` with a fully custom flow so the reset email uses our own template. The API logic (token generation, email sending, password update) lives entirely on the **external backend** — this dashboard repo only owns the two UI pages that talk to it.

**Current state:** `app/api/forgot-password/page.tsx` calls `sendPasswordResetEmail` directly from the client.

**Target state:** The page calls the external backend API. The backend sends the branded email; the link in that email lands on a page in this repo (`/reset-password`) which calls the backend again to apply the new password.

---

## Responsibility Split

| Concern | Owner |
| ------- | ----- |
| Token generation & storage | External backend |
| Email sending (template + Resend) | External backend |
| Firebase Admin password update | External backend |
| Forgot-password form UI | This repo |
| Reset-password landing page UI | This repo |

---

## Flow

```
[Any client — web / mobile / other app]
        |
        | POST <BACKEND_BASE_URL>/auth/forgot-password  { email }
        ↓
[External Backend]
  1. Look up user by email in Firebase Auth (Admin SDK)
  2. Generate a secure random token
  3. Store token with { uid, email, expiresAt: now + 1h, used: false }
  4. Render "forgot-password" email template, inject {{ resetUrl }}
     resetUrl = https://<dashboard-domain>/reset-password?token=<token>
  5. Send email via Resend
  6. Return 200 (always — never reveal whether the email exists)
        |
        | Email delivered to user
        ↓
[User clicks link in email]
  https://<dashboard-domain>/reset-password?token=<token>
        |
        ↓
[This repo — app/reset-password/page.tsx]
  1. On mount: POST <BACKEND_BASE_URL>/auth/verify-reset-token  { token }
     → { valid: true } or { valid: false, reason }
  2. If invalid → show error state, link back to /forgot-password
  3. If valid → show new-password form
        |
        | User submits new password
        ↓
[External Backend]
  1. Re-validate token (not used, not expired)
  2. auth.updateUser(uid, { password })
  3. Mark token used
  4. Return 200
        |
        ↓
[This repo] redirect to /login with success toast
```

---

## Backend API Contract

These are the endpoints the external backend must implement. This repo only calls them.

### `POST /auth/forgot-password`

**Request**
```json
{ "email": "user@example.com" }
```

**Response** — always `200`
```json
{ "message": "If that email is registered, a reset link has been sent." }
```

---

### `POST /auth/verify-reset-token`

**Request**
```json
{ "token": "<token>" }
```

**Response**
```json
{ "valid": true }
// or
{ "valid": false, "reason": "expired" | "used" | "not_found" }
```

---

### `POST /auth/reset-password`

**Request**
```json
{ "token": "<token>", "password": "<new-password>" }
```

**Response**
```json
{ "message": "Password updated successfully." }
```

**Errors**
| Status | Reason |
| ------ | ------ |
| `400` | Token invalid / expired / already used |
| `422` | Password too short (minimum 8 characters) |
| `500` | Firebase Admin or provider error |

---

## Pages in This Repo

### `app/api/forgot-password/page.tsx` (existing — update)

- Remove `sendPasswordResetEmail` and `firebase/auth` import.
- On submit, call:
  ```ts
  fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  ```
- Always show the success message regardless of response (no enumeration).

### `app/reset-password/page.tsx` (new)

- Reads `?token` query param on mount.
- On mount calls `verify-reset-token`; shows an error card if `valid: false`.
- If valid, renders a form: **New password** + **Confirm password**.
- On submit calls `reset-password`; on `200` redirects to `/login` with a success toast.
- On `400`/`422` shows inline error.

---

## Environment Variable

Add to `.env.local` (and production env):

```
NEXT_PUBLIC_BACKEND_URL=https://api.your-backend.com
```

---

## Email Template (backend side)

The backend should send a `forgot-password` email with at minimum:

| Token | Value |
| ----- | ----- |
| `{{ firstName }}` | User's first name |
| `{{ resetUrl }}` | `https://<dashboard-domain>/reset-password?token=<token>` |
| `{{ expiresInMinutes }}` | `60` |

The `resetUrl` must point to this dashboard's `/reset-password` page — that is the landing page the backend-generated link will open.

---

## Security Notes

- The backend must never confirm whether an email is registered.
- Tokens are single-use and expire in 1 hour.
- All validation (token check, password update) is server-side on the backend — this repo sends no Firebase credentials.
- The backend should rate-limit `/auth/forgot-password` (e.g. 5 requests / 15 min per IP).
