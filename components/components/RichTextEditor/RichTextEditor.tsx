"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Toolbar } from "./Toolbar";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  hasError?: boolean;
  onEditorReady?: (editor: Editor | null) => void;
};

export function RichTextEditor({ value, onChange, placeholder, hasError, onEditorReady }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    onCreate({ editor }) {
      onEditorReady?.(editor);
    },
    onDestroy() {
      onEditorReady?.(null);
    },
    editorProps: {
      attributes: {
        class: [
          "min-h-[200px] px-3 py-2 text-sm text-black outline-none",
          // headings
          "[&_h2]:text-xl [&_h2]:mt-3 [&_h2]:mb-1",
          "[&_h3]:text-lg [&_h3]:mt-2 [&_h3]:mb-1",
          // lists
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1",
          "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1",
          "[&_li]:my-0.5",
        ].join(" "),
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
