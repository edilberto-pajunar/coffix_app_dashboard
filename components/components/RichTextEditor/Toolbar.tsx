"use client";

import { type Editor, useEditorState } from "@tiptap/react";

type Props = { editor: Editor | null };

export function Toolbar({ editor }: Props) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      strike: e?.isActive("strike") ?? false,
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      h3: e?.isActive("heading", { level: 3 }) ?? false,
      bulletList: e?.isActive("bulletList") ?? false,
      orderedList: e?.isActive("orderedList") ?? false,
    }),
  });

  if (!editor || !state) return null;

  const btn = (active: boolean) =>
    `cursor-pointer rounded px-2 py-1 text-xs font-medium transition-colors ${
      active ? "bg-primary text-white" : "text-black hover:bg-black/5"
    }`;

  return (
    <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5 ">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(state.bold)}>B</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(state.italic)}>I</button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(state.strike)}>S</button>
      <span className="mx-1 self-stretch border-l border-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(state.h2)}>H2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(state.h3)}>H3</button>
      <span className="mx-1 self-stretch border-l border-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(state.bulletList)}>• List</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(state.orderedList)}>1. List</button>
    </div>
  );
}
