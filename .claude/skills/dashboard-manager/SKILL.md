# Dashboard Manager — CRUD Feature Standard

This document defines the canonical pattern for implementing any new CRUD feature in the Coffix dashboard. Follow it exactly; do not deviate without a documented reason.

---

## 1. Rule Zero: CRUD = View Page + Inline Dialogs

| Operation | Implementation |
|-----------|---------------|
| **View / List** | New `page.tsx` route under `app/dashboard/<feature>/` |
| **View / Detail** | New `page.tsx` route under `app/dashboard/<feature>/[id]/` |
| **Add** | Dialog rendered inside the list page — never a new route |
| **Edit** | Dialog rendered inside the detail page (or list page if no detail exists) |
| **Delete** | Confirmation dialog rendered inside the detail page |

**Never** navigate to a separate `/new` or `/edit` URL for Add/Edit/Delete.

---

## 2. File Structure

Create exactly these files for a feature named `<feature>` (e.g. `categories`):

```
app/dashboard/<feature>/
├── page.tsx                        # List page — includes Add dialog
├── [<featureId>]/
│   └── page.tsx                    # Detail page — includes Edit + Delete dialogs
├── interface/
│   └── <Feature>.ts                # TypeScript type
├── service/
│   └── <Feature>Service.ts         # Firestore CRUD + listeners
└── store/
    └── use<Feature>Store.ts        # Zustand store
```

All page files must be `.tsx` (they render JSX) and include `"use client";` at the top.

---

## 3. Interface

```ts
// app/dashboard/<feature>/interface/<Feature>.ts
export type <Feature> = {
  docId: string;          // always required — set from Firestore document ID
  name?: string;          // most other fields optional (may be absent in older docs)
  // ...other fields
};
```

**Rules:**
- `docId` is **always** `string` (not `string | undefined`) — it is injected by `snapToArray` before the object is used anywhere.
- All other fields should be optional (`?`) unless the business logic strictly requires them.
- Use `??` null-coalescing when reading optional fields in JSX (e.g. `store.name ?? "—"`).

---

## 4. Service Layer

```ts
// app/dashboard/<feature>/service/<Feature>Service.ts
import { db } from "@/app/lib/firebase";
import {
  addDoc, collection, deleteDoc, doc,
  DocumentData, onSnapshot, QuerySnapshot, Unsubscribe, updateDoc,
} from "firebase/firestore";
import { <Feature> } from "../interface/<Feature>";

// Always use this helper — never map snapshot.docs manually
function snapToArray<T>(snapshot: QuerySnapshot<DocumentData, DocumentData>): T[] {
  return snapshot.docs.map((d) => ({ ...d.data(), docId: d.id })) as T[];
}

export const <Feature>Service = {
  listenTo<Feature>s: (onUpdate: (items: <Feature>[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "<firestoreCollection>"), (snap) =>
      onUpdate(snapToArray<<Feature>>(snap)),
    ),

  create<Feature>: (data: Omit<<Feature>, "docId">) =>
    addDoc(collection(db, "<firestoreCollection>"), data),

  update<Feature>: (docId: string, data: Partial<Omit<<Feature>, "docId">>) =>
    updateDoc(doc(db, "<firestoreCollection>", docId), data as DocumentData),

  delete<Feature>: (docId: string) =>
    deleteDoc(doc(db, "<firestoreCollection>", docId)),
};
```

**Rules:**
- Always use `snapToArray` — it injects `docId` from `d.id`.
- Service methods are plain async functions; no error handling inside — let callers handle it.
- `create` takes `Omit<T, "docId">`, `update` takes `Partial<Omit<T, "docId">>`.

---

## 5. Zustand Store

```ts
// app/dashboard/<feature>/store/use<Feature>Store.ts
import { create } from "zustand";
import { <Feature> } from "../interface/<Feature>";
import { <Feature>Service } from "../service/<Feature>Service";

interface <Feature>State {
  <feature>s: <Feature>[];
  listenTo<Feature>s: () => () => void;
}

export const use<Feature>Store = create<<Feature>State>((set) => ({
  <feature>s: [],
  listenTo<Feature>s: () =>
    <Feature>Service.listenTo<Feature>s((<feature>s) => set({ <feature>s })),
}));
```

**Rules:**
- One store per collection. Keep it minimal: array state + one listener function.
- The listener returns an unsubscribe function — callers must call it in `useEffect` cleanup.
- For features that need data from **multiple** collections (like Products needing Categories), use a single `listenToAll` method that sets up all listeners and returns a combined unsubscribe:

```ts
listenToAll: () => {
  const u1 = <Feature>Service.listenTo<Feature>s((items) => set({ items }));
  const u2 = OtherService.listenToOthers((others) => set({ others }));
  return () => { u1(); u2(); };
},
```

---

## 6. List Page

**File:** `app/dashboard/<feature>/page.tsx`

### Structure

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { use<Feature>Store } from "./store/use<Feature>Store";
import { <Feature>FormType>, emptyForm } from "./..."; // define locally

export default function <Feature>sPage() {
  const items = use<Feature>Store((s) => s.<feature>s);
  const listenTo<Feature>s = use<Feature>Store((s) => s.listenTo<Feature>s);
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<<Feature>Form>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof <Feature>Form, boolean>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = listenTo<Feature>s();
    return () => unsub();
  }, [listenTo<Feature>s]);

  // ... filter, setField, handleCreate

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* Search / Filter bar (if needed) */}
      {/* Table */}
      {/* Create Dialog */}
    </div>
  );
}
```

### Header

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-semibold text-black"><Feature>s</h1>
    <p className="mt-1 text-sm text-light-grey">
      {items.length} item{items.length !== 1 ? "s" : ""} total
    </p>
  </div>
  <button
    onClick={() => setShowCreate(true)}
    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
  >
    + New <Feature>
  </button>
</div>
```

### Table Shell

```tsx
<div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-border bg-background">
        <th className="px-5 py-3 text-left font-medium text-light-grey">Name</th>
        {/* ...other columns */}
        <th className="px-5 py-3 text-right font-medium text-light-grey">Action</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border">
      {items.length === 0 ? (
        <tr>
          <td colSpan={N} className="px-5 py-10 text-center text-light-grey">
            No items found.
          </td>
        </tr>
      ) : (
        items.map((item) => (
          <tr key={item.docId} className="transition-colors hover:bg-background">
            {/* Image/Initials + Name cell */}
            <td className="px-5 py-3">
              <div className="flex items-center gap-3">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} width={36} height={36}
                    alt={item.name ?? ""} className="rounded-lg object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft-grey text-xs font-bold text-light-grey">
                    {(item.name ?? "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-black">{item.name ?? "—"}</span>
              </div>
            </td>
            {/* View button */}
            <td className="px-5 py-3 text-right">
              <button
                onClick={() => router.push(`/dashboard/<feature>s/${item.docId}`)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-black transition-colors hover:border-primary hover:text-primary"
              >
                View
              </button>
            </td>
          </tr>
        ))
      )}
    </tbody>
  </table>
</div>
```

---

## 7. Detail Page

**File:** `app/dashboard/<feature>/[<featureId>]/page.tsx`

### Header

```tsx
<div className="flex items-start justify-between">
  <div>
    <button
      onClick={() => router.push("/dashboard/<feature>s")}
      className="mb-2 text-xs text-light-grey hover:text-black"
    >
      ← Back to <Feature>s
    </button>
    <h1 className="text-2xl font-semibold text-black">{item.name ?? "—"}</h1>
    <p className="mt-1 text-sm text-light-grey">{item.subtitle ?? ""}</p>
  </div>
  <div className="flex gap-2">
    <button
      onClick={openEdit}
      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:border-primary hover:text-primary"
    >
      Edit
    </button>
    <button
      onClick={() => setDialog("delete")}
      className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
    >
      Delete
    </button>
  </div>
</div>
```

### Key-Value Info Card

```tsx
<div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
  {/* Optional image or initials banner */}
  <div className="divide-y divide-border p-0">
    {[
      { label: "Field One", value: item.fieldOne },
      { label: "Field Two", value: item.fieldTwo },
    ].map(({ label, value }) => (
      <div key={label} className="flex items-center justify-between px-4 py-3">
        <span className="text-xs text-light-grey">{label}</span>
        <span className="text-sm font-medium text-black">{value ?? "—"}</span>
      </div>
    ))}
  </div>
</div>
```

### Not-Found Guard

```tsx
if (!item) {
  return (
    <div className="flex h-64 items-center justify-center text-light-grey">
      <Feature> not found.
    </div>
  );
}
```

---

## 8. Dialog Patterns

### `DialogMode` Union Type

For detail pages with multiple dialogs, use a discriminated union instead of multiple booleans:

```ts
type DialogMode = "edit" | "delete" | "add-sub-item" | "edit-sub-item" | "delete-sub-item" | null;
const [dialog, setDialog] = useState<DialogMode>(null);
```

For list pages with only one dialog (create), a simple `boolean` is fine:
```ts
const [showCreate, setShowCreate] = useState(false);
```

### Overlay Wrapper

All dialogs share this outer shell:

```tsx
{/* boolean variant */}
{showCreate && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    onClick={closeDialog}         // clicking backdrop closes
  >
    <div
      className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
      onClick={(e) => e.stopPropagation()}   // prevent backdrop click
    >
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-lg font-semibold text-black">New <Feature></h3>
      </div>
      {/* Scrollable body */}
      <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
        {/* form fields */}
      </div>
      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <button onClick={closeDialog}
          className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey">
          Cancel
        </button>
        <button onClick={handleCreate} disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
          {loading ? "Creating…" : "Create <Feature>"}
        </button>
      </div>
    </div>
  </div>
)}
```

### `DialogMode` variant (single overlay, multiple inner views)

```tsx
{dialog && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    onClick={() => setDialog(null)}
  >
    <div
      className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {dialog === "edit" && ( /* edit form */ )}
      {dialog === "delete" && ( /* confirm */ )}
      {dialog === "add-sub-item" && ( /* sub-item form */ )}
    </div>
  </div>
)}
```

### Long-Form Dialog (create / edit with many fields)

- Use the header / scrollable-body / footer structure above.
- Max width: `max-w-lg` for standard forms.
- Body max-height: `max-h-[70vh] overflow-y-auto`.

### Short Confirmation Dialog (delete)

```tsx
{dialog === "delete" && (
  <>
    <h3 className="mb-2 text-lg font-semibold text-black">Delete <Feature></h3>
    <p className="text-sm text-light-grey">
      Are you sure you want to delete <strong className="text-black">{item.name}</strong>?{" "}
      This cannot be undone.
    </p>
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={() => setDialog(null)}
        className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey">
        Cancel
      </button>
      <button onClick={handleDelete} disabled={loading}
        className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
        {loading ? "Deleting…" : "Delete"}
      </button>
    </div>
  </>
)}
```

---

## 9. Form Pattern

### `FormType` and `emptyForm`

Define form types locally in the page file (not in the interface file). All numeric fields are stored as `string` in the form to allow empty/partial input, then parsed on submit.

```ts
type <Feature>Form = {
  name: string;
  imageUrl: string;
  price: string;   // numeric fields as string in form
  count: string;
  categoryId: string;
  relatedIds: string[];   // multi-select arrays stay as string[]
};

const emptyForm: <Feature>Form = {
  name: "",
  imageUrl: "",
  price: "",
  count: "",
  categoryId: "",
  relatedIds: [],
};
```

### Pre-Populating Edit Forms

When opening an Edit dialog, convert the existing record to a form object. Never mutate the live Zustand state.

```ts
// For simple forms — spread the item directly
function openEdit() {
  setForm({ ...item });   // or Partial<Item> if using that pattern
  setDialog("edit");
}

// For complex forms with nested data — write an explicit converter function (like storeToForm)
function itemToForm(item: Item): ItemForm {
  return {
    name: item.name ?? "",
    price: String(item.price ?? ""),
    // ...
  };
}
function openEdit() {
  setForm(itemToForm(item));
  setErrors({});
  setShowEdit(true);
}
```

### `setField` Helper

```ts
function setField<K extends keyof <Feature>Form>(key: K, value: <Feature>Form[K]) {
  setForm((f) => ({ ...f, [key]: value }));
  setErrors((e) => ({ ...e, [key]: false }));  // clear error on change
}
```

### Validation-on-Submit

Collect all errors at once; never validate field by field on blur.

```ts
async function handleCreate() {
  const newErrors: Partial<Record<keyof <Feature>Form, boolean>> = {
    name: !form.name.trim(),
    price: !form.price,
    categoryId: !form.categoryId,
    relatedIds: form.relatedIds.length === 0,
  };

  if (Object.values(newErrors).some(Boolean)) {
    setErrors(newErrors);
    toast.error("Please fill in all required fields.");
    return;
  }

  setErrors({});
  setLoading(true);
  try {
    await <Feature>Service.create<Feature>({
      name: form.name.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      price: parseFloat(form.price),
      count: parseInt(form.count),
      categoryId: form.categoryId,
      relatedIds: form.relatedIds,
    });
    toast.success("<Feature> created successfully.");
    setForm(emptyForm);
    setShowCreate(false);
  } catch (err) {
    console.error(err);
    toast.error("Failed to create <feature>. Please try again.");
  } finally {
    setLoading(false);
  }
}
```

### Numeric String Parsing

| Form field type | Parse with |
|-----------------|-----------|
| Decimal (price, cost, delta) | `parseFloat(form.price)` |
| Integer (order, count) | `parseInt(form.order)` |

Optional numeric fields that might be empty: `parseFloat(form.price) || undefined`

---

## 10. Toast Rules

### Import

```ts
import { toast } from "sonner";
```

`<Toaster />` is already mounted once in the root layout. **Never** add another `<Toaster />` inside a page or dialog.

### When to Toast

| Trigger | Call |
|---------|------|
| Successful create | `toast.success("<Feature> created successfully.")` |
| Successful update | `toast.success("<Feature> updated successfully.")` |
| Successful delete | *(navigate away immediately — no toast needed)* |
| Validation failed | `toast.error("Please fill in all required fields.")` |
| Service/network error | `toast.error("Failed to <action> <feature>. Please try again.")` |

### Rules

- Use **only** `toast.success` and `toast.error`. Do not use `toast.info`, `toast.warning`, or `toast()`.
- Message ends with a period.
- Error messages follow the pattern: `"Failed to <verb> <noun>. Please try again."`
- For delete operations that navigate away after success (e.g. `router.push(...)`), skip the success toast — the navigation itself is feedback.
- Always call `toast.error(...)` inside the `catch` block, never silently swallow errors.

---

## 11. CSS Variable Usage

Tailwind CSS v4 maps CSS custom properties defined in `app/globals.css` to utility classes. Never use hardcoded hex values in `className`.

| Tailwind Class | CSS Variable | Value |
|----------------|-------------|-------|
| `text-primary` / `bg-primary` | `--primary` | `#f15f2c` (orange) |
| `text-black` / `bg-black` | `--black` | `#0c243e` (dark navy) |
| `text-light-grey` | `--light-grey` | `#b0b0b0` |
| `bg-soft-grey` | `--soft-grey` | `#e8e8e8` |
| `border-border` | `--border` | `#d0d0d0` |
| `bg-background` | `--background` | `#f5f5f5` |
| `text-error` / `bg-error` | `--error` | `#d32f2f` |
| `text-success` | `--success` | `#00c853` |
| `bg-disabled-bg` | `--disabled-bg` | `#e3d9d9` |
| `bg-beige` | `--beige` | `#d9d9d9` |
| `shadow-(--shadow)` | `--shadow` | `0 2px 4px rgba(0,0,0,0.1)` |

### Common Patterns

```tsx
// Card / table container
className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)"

// Table header row
className="border-b border-border bg-background"

// Table row hover
className="transition-colors hover:bg-background"

// Input (normal)
className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"

// Input (with error state)
className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.field ? "border-error" : "border-border"}`}

// Error message under input
className="mt-1 text-xs text-error"

// Label above input
className="mb-1.5 block text-xs text-light-grey"

// Primary button
className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"

// Secondary / outline button
className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey"

// Destructive button
className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"

// Disabled state (add to any button)
className="... disabled:opacity-50"

// Status badge — open
className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-success"

// Status badge — closed / neutral
className="inline-flex items-center gap-1.5 rounded-full bg-soft-grey px-2.5 py-1 text-xs font-medium text-light-grey"

// Status badge — disabled
className="inline-flex items-center gap-1.5 rounded-full bg-disabled-bg px-2.5 py-1 text-xs font-medium text-light-grey"

// Category / tag pill
className="rounded-full bg-soft-grey px-2.5 py-1 text-xs font-medium text-black"

// Checkbox accent color
className="accent-primary"
```

---

## 12. Implementation Checklist

Use this checklist before considering a CRUD feature complete.

### Files
- [ ] `interface/<Feature>.ts` — TypeScript type with `docId: string`
- [ ] `service/<Feature>Service.ts` — uses `snapToArray`, has listen/create/update/delete
- [ ] `store/use<Feature>Store.ts` — Zustand store, minimal shape
- [ ] `page.tsx` — list page with Add dialog
- [ ] `[id]/page.tsx` — detail page with Edit + Delete dialogs

### Data Layer
- [ ] `snapToArray` used in all listener methods
- [ ] Service `create` takes `Omit<T, "docId">`
- [ ] Service `update` takes `Partial<Omit<T, "docId">>`
- [ ] Zustand listener returns unsubscribe; `useEffect` calls it in cleanup

### List Page UI
- [ ] Header: title, count, "+ New" button
- [ ] Table: `border-border`, `bg-background` header, `hover:bg-background` rows
- [ ] Image/initials fallback in name cell
- [ ] Empty-state row with `colSpan` covering all columns
- [ ] "View" button navigates to detail page

### Detail Page UI
- [ ] "← Back to …" link at top-left
- [ ] Edit button (outline) + Delete button (error/red) at top-right
- [ ] Not-found guard renders before accessing item fields
- [ ] Key-value card using `divide-y divide-border`

### Dialogs
- [ ] Overlay: `fixed inset-0 z-50 bg-black/40`, click-backdrop-to-close
- [ ] Inner panel: `stopPropagation` on click
- [ ] Long forms: header / scrollable body (`max-h-[70vh] overflow-y-auto`) / footer
- [ ] Delete confirmation: short copy, Cancel + red Delete buttons
- [ ] `DialogMode` union type used if page has ≥ 2 dialogs

### Form
- [ ] `FormType` defined locally in the page file
- [ ] `emptyForm` constant defined
- [ ] Numeric fields stored as `string` in form, parsed (`parseFloat`/`parseInt`) on submit
- [ ] `setField` helper clears corresponding error on change
- [ ] Edit dialog pre-populates via spread or explicit converter function
- [ ] On submit: collect all errors at once → show `toast.error` if any → call service
- [ ] `loading` state disables submit button and shows "…" label

### Toasts
- [ ] `toast.success("<Feature> created successfully.")` on create
- [ ] `toast.success("<Feature> updated successfully.")` on update
- [ ] `toast.error("Please fill in all required fields.")` on validation failure
- [ ] `toast.error("Failed to <verb> <noun>. Please try again.")` in catch block
- [ ] No `<Toaster />` added to any page (it's in root layout)
- [ ] Only `toast.success` and `toast.error` used — no other variants
