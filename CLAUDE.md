# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test runner is configured yet.

## Architecture

**Coffix** is a Next.js 16 (App Router) dashboard for managing coffee shop operations, backed by Firebase.

### Tech Stack
- **Next.js 16** with React 19, TypeScript 5 (strict mode)
- **Tailwind CSS v4** — no `tailwind.config.*`; theme is defined via CSS custom properties in `app/globals.css`
- **Firebase 12** — Auth + Firestore, initialized in `app/lib/firebase.ts`, configured via `NEXT_PUBLIC_*` env vars in `.env.local`

### Routing (App Router)
```
app/
├── page.tsx                     # Home (placeholder)
├── layout.tsx                   # Root layout — Geist fonts
├── globals.css                  # Tailwind + CSS vars
├── lib/firebase.ts              # Firebase init (Auth + Firestore)
└── dashboard/
    ├── page.ts                  # Dashboard index (empty)
    ├── layout.ts                # Dashboard layout (empty)
    ├── products/
    │   ├── page.ts              # Products page (empty)
    │   └── interface/product.ts # Product type definition
    └── stores/
        ├── page.ts              # Stores page (empty)
        └── interface/store.ts   # Store type + hours utilities
```

> Most dashboard `page.ts` files are empty placeholders. They use `.ts` extensions but will need to be `.tsx` once they render JSX.

### Data Models

**Product** (`app/dashboard/products/interface/product.ts`) — all fields optional except `docId` in some contexts. Key fields: `name`, `price`, `cost`, `categoryId`, `modifierGroupIds`, `availableToStores`.

**Store** (`app/dashboard/stores/interface/store.ts`) — `docId` is required. Includes `openingHours: Record<string, DayHours>` where keys are weekday names. The file also exports helpers: `isStoreOpenAt(store, date)`, `toMinutes(hhmm)`, `dayHoursContains(hours, date)` — these handle overnight shifts (close < open).

### Path Aliases
`@/*` resolves to the repo root (configured in `tsconfig.json`). Use `@/app/lib/firebase` etc.
