# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Coffix** is a Next.js (App Router) dashboard for managing coffee shop operations, backed by Firebase.

## Conventions

- **Tailwind CSS v4** — there is no `tailwind.config.*`; the theme is defined via CSS custom properties in `app/globals.css`.
- **Path alias** — `@/*` resolves to the repo root, so imports look like `@/app/lib/firebase`.
- Firebase config comes from `NEXT_PUBLIC_*` env vars in `.env.local`.

## Testing

No test runner is configured yet.
