# TipTap Rich Text Editor — Email Templates

Replaces the raw `<textarea>` in the email template dialog with a WYSIWYG editor backed by TipTap. The stored value remains serialized HTML (compatible with the existing `content` field in Firestore and the `renderEmailTemplate` utility). HTML is sanitized with DOMPurify before any render that uses `dangerouslySetInnerHTML`.

---

## Why TipTap

- Outputs real HTML — no conversion layer needed before saving to Firestore.
- Headless: works with the existing Tailwind styling system.
- First-class React/Next.js support via `@tiptap/react`.
- Extensible toolbar (bold, italic, links, lists) without shipping a full editor bundle.

---

## Packages

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder isomorphic-dompurify
```

| Package | Purpose |
| --- | --- |
| `@tiptap/react` | React bindings (`useEditor`, `EditorContent`) |
| `@tiptap/pm` | ProseMirror peer dependency |
| `@tiptap/starter-kit` | Bold, italic, headings, lists, blockquote, code, history |
| `@tiptap/extension-link` | Hyperlink support |
| `@tiptap/extension-placeholder` | Placeholder text when editor is empty |
| `isomorphic-dompurify` | XSS sanitization — works in both Node (SSR) and browser |

> **Why `isomorphic-dompurify`?** Next.js renders on the server where `window` is not available. The isomorphic variant shims JSDOM on the server so the same `sanitize()` call works in both environments.

---

## File Structure

```
app/
└── components/
    └── RichTextEditor/
        ├── RichTextEditor.tsx      ← editor component (TipTap + toolbar)
        └── Toolbar.tsx             ← formatting buttons
app/
└── lib/
    └── sanitize.ts                 ← DOMPurify wrapper
```

---

## 1. Sanitize Utility

```ts
// app/lib/sanitize.ts
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s",
  "h1", "h2", "h3",
  "ul", "ol", "li",
  "a", "blockquote", "code", "pre",
  "span", "div",
];

const ALLOWED_ATTR = ["href", "target", "rel", "style", "class"];

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
```

**Rules:**

- `ALLOW_DATA_ATTR: false` — blocks `data-*` attributes that can carry payloads.
- `target` on `<a>` is allowed but DOMPurify automatically adds `rel="noopener noreferrer"` when `target="_blank"` is present (configure via `ADD_ATTR: ["target"]` if needed).
- Inline `style=""` is permitted because email HTML relies on it; tighten this for any non-email rendering surface.

**Never skip sanitization** before:
- `dangerouslySetInnerHTML={{ __html: ... }}`
- `iframe srcDoc`
- Any server-side HTML injection into the email shell

---

## 2. RichTextEditor Component

```tsx
// app/components/RichTextEditor/RichTextEditor.tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Toolbar } from "./Toolbar";

type Props = {
  value: string;           // HTML string (from Firestore / form state)
  onChange: (html: string) => void;
  placeholder?: string;
  hasError?: boolean;
};

export function RichTextEditor({ value, onChange, placeholder, hasError }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
    ],
    content: value,
    onUpdate({ editor }) {
      // getHTML() returns an HTML string — same shape as the current textarea value
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[200px] px-3 py-2 text-sm text-black outline-none",
      },
    },
  });

  return (
    <div
      className={`rounded-lg border bg-white ${
        hasError ? "border-error" : "border-border"
      } focus-within:border-primary`}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Key decisions:**

- `content` is set once on mount (initial value from Firestore). It is **not** a controlled prop — TipTap manages internal state. If the form is reset (e.g. after closing the dialog), destroy and remount the editor by keying the component: `<RichTextEditor key={dialogOpenKey} … />`.
- `getHTML()` returns the same HTML that was previously stored in the `content` textarea — no schema migration needed.
- `openOnClick: false` on the Link extension prevents the editor from navigating away when a link is clicked inside the canvas.

---

## 3. Toolbar Component

```tsx
// app/components/RichTextEditor/Toolbar.tsx
"use client";

import type { Editor } from "@tiptap/react";

type Props = { editor: Editor | null };

export function Toolbar({ editor }: Props) {
  if (!editor) return null;

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-xs font-medium transition-colors ${
      active ? "bg-primary text-white" : "text-black hover:bg-soft-grey"
    }`;

  return (
    <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>B</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>I</button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))}>S</button>
      <span className="mx-1 self-stretch border-l border-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>H2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))}>H3</button>
      <span className="mx-1 self-stretch border-l border-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>• List</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>1. List</button>
    </div>
  );
}
```

Add more buttons (link, blockquote, undo/redo) following the same `chain().focus()` pattern.

---

## 4. Inserting `{{ variable }}` Tokens

The current `VariableChips` component calls `onInsert(newContent)` after injecting a token at the textarea cursor. With TipTap, pass the `editor` instance instead and use `insertContent`:

```tsx
function insertVariable(varName: string) {
  editor?.chain().focus().insertContent(`{{ ${varName} }}`).run();
}
```

Update `VariableChipsProps` to accept `editor: Editor | null` and remove the `textareaRef` dependency entirely.

---

## 5. Using It in `TemplateDialog`

Replace the `<textarea>` for `Content (HTML)` with `<RichTextEditor>`:

```tsx
// Inside TemplateDialog
import { RichTextEditor } from "@/app/components/RichTextEditor/RichTextEditor";

// Replace:
// <textarea ref={textareaRef} value={form.content} onChange={...} />

// With:
<RichTextEditor
  key={isEdit ? editTarget?.docId : "new"}  // remount on open
  value={form.content}
  onChange={onChangeContent}
  hasError={errors.content}
  placeholder={"<p>Hi {{ firstName }},</p>"}
/>
```

The `onChange` callback receives the HTML string from `editor.getHTML()`, which feeds directly into the existing form state and the `EmailTemplateService.createTemplate` / `updateTemplate` calls — no changes needed there.

---

## 6. Sanitization Points

### In the Dashboard Preview

`PreviewModal` currently uses an `<iframe srcDoc={html}>`. The iframe provides natural sandboxing, but sanitize anyway for defence-in-depth:

```tsx
import { sanitizeHtml } from "@/app/lib/sanitize";

// In openPreview():
const rendered = renderEmailTemplate(template.content, sampleVars);
setPreviewHtml(sanitizeHtml(rendered));
```

### Anywhere `dangerouslySetInnerHTML` is used

```tsx
import { sanitizeHtml } from "@/app/lib/sanitize";

<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(template.content) }} />
```

Never pass raw Firestore content to `dangerouslySetInnerHTML` without going through `sanitizeHtml` first, even if you trust the authors — Firestore documents can be edited directly by any admin with console access.

### In the Email Sending Service (server-side)

Even on the server, sanitize before injecting into the shell:

```ts
import { sanitizeHtml } from "@/app/lib/sanitize";

const safeContent = sanitizeHtml(rawContent);
const body = emailShell.replace("{{{content}}}", safeContent);
```

---

## 7. Firestore — No Schema Changes Required

The `content` field stays as a raw HTML string. TipTap reads it on mount (`content: value`) and writes it back via `getHTML()`. The existing `EmailTemplateService` and `EmailTemplate` interface are unchanged.

---

## 8. SSR Consideration

TipTap uses browser APIs (`document`, `window`). Mark any file that imports `useEditor` or `EditorContent` with `"use client"`. If you need to render editor output during SSR, only import `sanitizeHtml` (which is SSR-safe via `isomorphic-dompurify`) — never `useEditor`.

---

## Checklist

- [ ] Install packages (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `isomorphic-dompurify`)
- [ ] Create `app/lib/sanitize.ts`
- [ ] Create `app/components/RichTextEditor/RichTextEditor.tsx`
- [ ] Create `app/components/RichTextEditor/Toolbar.tsx`
- [ ] Update `TemplateDialog` to use `<RichTextEditor>`
- [ ] Update `VariableChips` to accept `editor` instead of `textareaRef`
- [ ] Wrap `renderEmailTemplate` output in `sanitizeHtml` before `PreviewModal`
- [ ] Wrap every `dangerouslySetInnerHTML` usage in `sanitizeHtml`
- [ ] Add `sanitizeHtml` call in the server-side email sending service
- [ ] Test: create a template, type content, save → verify Firestore `content` field is valid HTML
- [ ] Test: inject `<script>alert(1)</script>` via Firestore console → verify it is stripped in preview
