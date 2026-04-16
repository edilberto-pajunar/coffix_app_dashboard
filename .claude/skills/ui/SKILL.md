---
name: ui
description: This should follow the ui guidelines not in a standard way but in what the client wants.
---

# UI Guidelines

These are the client-specific UI rules that must be followed in all UI work for this project:

## Colors
- No grey colors anywhere in the UI
- Use near-black (e.g. `#1a1a1a`, `#111111`, or similar) instead of grey for text, borders, icons, and any other elements that might default to grey
- Do not use `gray-*`, `slate-*`, `zinc-*`, `neutral-*`, or `stone-*` Tailwind color classes
- Replace all grey tones with the near-black equivalent

## Currency Fields
- All currency fields must always display in the format `$00.00` — dollar sign prefix, two decimal places
- Examples: `$1.00`, `$12.50`, `$1,200.00`
- Never display currency values without the `$` prefix
- Always ensure two decimal places are shown (e.g. `$5.00` not `$5` or `$5.0`)

## Typography
- All fonts must be Arial
- Set `font-family: Arial, sans-serif` as the base font
- Do not use Geist, Inter, or any other font family
- Apply Arial consistently across headings, body text, labels, inputs, and buttons