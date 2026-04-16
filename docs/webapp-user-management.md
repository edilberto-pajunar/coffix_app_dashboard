# WebApp: User management & roles

## Overview

The Coffix dashboard supports **user management** with **role-based access**. Admins onboard users, assign roles, and delegate store-level duties to Store Managers. Store Managers operate within a limited scope tied to their assigned store(s).

## Roles


| Role              | Purpose                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| **Admin**         | Full control over users, stores, products, and assignments.                                       |
| **Store Manager** | Day-to-day operations for assigned store(s): hours, holidays, and temporary product availability. |


### Adding roles

- **Admin** creates or invites users and **assigns a role** (Admin or Store Manager).
- **Store Manager** is bound to one or more stores by **email** (or account) — Admins **assign Store Manager emails** to the relevant store(s) so those users only see and edit what they manage.

### Firestore: which collection?

You already use `**customers`** for app users (ordering, loyalty, profile). **Do not put Admins or Store Managers in `customers`.** That collection should stay for retail customers only — different rules, queries, and lifecycle.

**Recommended:** a single internal collection for everyone who signs into the **dashboard**, with a `**role`** field:


| Collection      | Who                           | Typical fields                                                                                                           |
| --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `**customers**` | App / ordering users          | Existing profile, credits, preferred store, etc.                                                                         |
| `**staffs**`    | Admins **and** Store Managers | `email`, `role`: `admin` | `store_manager`, `storeIds` (for managers), `disabled`, `createdAt`, optional mirror of `uid` |


- **Admins** and **Store Managers** are **both** documents under this one collection; they differ only by `role` (and managers have `storeIds` / store assignment).
- Document ID is usually the **Firebase Auth `uid`** so it matches login and security rules cleanly.

**Optional:** duplicate `role` (and maybe `storeIds`) into **Auth custom claims** after writes for fast client checks; keep **Firestore `staff` as the source of truth** for assignments and audits.

**Avoid:** separate `admins` and `storeManagers` collections unless you have a strong reason — one `staff` collection with `role` is simpler to query and rule against.

Enforce access in **Firestore security rules** (and the Admin SDK for sensitive actions) using `staff/{uid}` + custom claims as you prefer.

---

## Admin

Admins can **add, remove, and update** users, roles, and store assignments. Specifically:

- **Users & roles**: create/disable users, change roles, remove access.
- **Stores**: full CRUD; **assign Store Manager email(s)** to each store.
- **Products**: full CRUD, permanent enable/disable, categories, modifiers, pricing, and store availability as designed by the product model.
- **Everything else** the app exposes for global configuration (reports, integrations, etc.), unless restricted by a separate policy.

---

## Store Manager

Store Managers **cannot** permanently delete products or change global catalog structure. They may:


| Area                        | Allowed                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Opening / closing times** | Update per store (including overnight rules if the model supports them).                                                    |
| **Holidays**                | Add, edit, or remove holiday closures or special hours for their store(s).                                                  |
| **Products**                | **Temporarily disable** a product for their store (e.g. “out of stock today”) — **not** permanent removal or catalog edits. |


Anything outside this list (user management, other stores they are not assigned to, permanent product changes, pricing strategy, etc.) should be **denied** in UI and backend rules.

---

## Summary

1. **Admin**: full user management, role assignment, store manager email assignment, and unrestricted product/store administration.
2. **Store Manager**: hours, holidays, and **temporary** product disablement only for assigned store(s).

