
// ─── Template Dialog ──────────────────────────────────────────────────────────

import { EMAIL_VARIABLE_GROUPS, SUBJECT_VARIABLES } from "@/app/utils/constant";
import { RichTextEditor } from "@/components/components/RichTextEditor/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Editor } from "@tiptap/react";
import { RefObject, useRef, useState } from "react";
import { extractTokens, TemplateForm, TemplateFormErrors } from "../page";

type TemplateDialogProps = {
    title: string;
    form: TemplateForm;
    errors: TemplateFormErrors;
    loading: boolean;
    isEdit: boolean;
    onClose: () => void;
    onSubmit: () => void;
    onChangeName: (v: string) => void;
    onChangeSubject: (v: string) => void;
    onChangeContent: (v: string) => void;
    onChangeNotes: (v: string) => void;
  };
  
  export function TemplateDialog({
    title, form, errors, loading, isEdit,
    onClose, onSubmit, onChangeName, onChangeSubject, onChangeContent, onChangeNotes,
  }: TemplateDialogProps) {
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
    const subjectRef = useRef<HTMLInputElement>(null);
  
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-lg font-semibold text-black">{title}</h3>
          </div>
  
          <div className="max-h-[80vh] space-y-4 overflow-y-auto px-6 py-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="e.g. Welcome Email"
                disabled={isEdit}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary disabled:cursor-not-allowed  ${
                  errors.name ? "border-error" : "border-border"
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-error">Name is required.</p>
              )}
            </div>
  
            {/* Subject */}
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">Subject *</label>
              <SubjectVariableChips
                variables={SUBJECT_VARIABLES}
                subject={form.subject}
                inputRef={subjectRef}
                onInsert={(v) => onChangeSubject(v)}
              />
              <input
                ref={subjectRef}
                type="text"
                value={form.subject}
                onChange={(e) => onChangeSubject(e.target.value)}
                placeholder="e.g. Welcome to Coffix!"
                className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${
                  errors.subject ? "border-error" : "border-border"
                }`}
              />
              {errors.subject && (
                <p className="mt-1 text-xs text-error">Subject is required.</p>
              )}
            </div>
  
            {/* Content */}
            <div className="space-y-2">
              <label className="block text-xs text-light-grey">Content (HTML) *</label>
  
              {/* Variable groups */}
              <div className="space-y-3">
                {EMAIL_VARIABLE_GROUPS.map((group) => (
                  <div key={group.key}>
                    <p className="mb-1.5 text-xs font-medium text-light-grey">{group.label}</p>
                    <VariableChips
                      variables={group.variables}
                      content={form.content}
                      editor={editorInstance}
                    />
                  </div>
                ))}
              </div>
  
              <RichTextEditor
                key={isEdit ? "edit" : "new"}
                value={form.content}
                onChange={onChangeContent}
                hasError={!!errors.content}
                placeholder="Hi {{ first_name }}, …"
                onEditorReady={setEditorInstance}
              />
  
              {errors.content && (
                <p className="text-xs text-error">Content is required.</p>
              )}
            </div>
  
            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">
                Notes (internal)
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => onChangeNotes(e.target.value)}
                placeholder="Describe when this template is sent and which tokens it uses…"
                className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
              />
            </div>
          </div>
  
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={loading}>
              {loading
                ? isEdit ? "Saving…" : "Creating…"
                : isEdit ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </div>
      </div>
    );
  }


// ─── Variable Chips ───────────────────────────────────────────────────────────

type VariableChipsProps = {
    variables: string[];
    content: string;
    editor: Editor | null;
  };
  
  function VariableChips({ variables, content, editor }: VariableChipsProps) {
    function insertVariable(varName: string) {
      editor?.chain().focus().insertContent(`{{ ${varName} }}`).run();
    }
  
    const usedTokens = new Set(extractTokens(content));
  
    return (
      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <div className="flex flex-wrap gap-1.5 p-3">
          {variables.length === 0 ? (
            <p className="text-xs text-light-grey">
              No variables available for this group.
            </p>
          ) : (
            variables.map((varName) => {
              const used = usedTokens.has(varName);
              return (
                <button
                  key={varName}
                  type="button"
                  title={`Insert {{ ${varName} }}`}
                  onClick={() => insertVariable(varName)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-70 bg-primary/10 text-primary border-primary/20 ${used ? "opacity-60" : ""}`}
                >
                  {varName}
                  {used && <span className="ml-0.5 text-[10px] opacity-70">✓</span>}
                </button>
              );
            })
          )}
        </div>
        {variables.length > 0 && (
          <p className="border-t border-border px-3 py-1.5 text-[11px] text-light-grey">
            Click a variable to insert it at the cursor.{" "}
            <span className="opacity-60">✓</span> = already used.
          </p>
        )}
      </div>
    );
  }
  


// ─── Subject Variable Chips ───────────────────────────────────────────────────

type SubjectVariableChipsProps = {
    variables: string[];
    subject: string;
    inputRef: RefObject<HTMLInputElement | null>;
    onInsert: (newValue: string) => void;
  };
  
  function SubjectVariableChips({ variables, subject, inputRef, onInsert }: SubjectVariableChipsProps) {
    const usedTokens = new Set(extractTokens(subject));
  
    function insertAt(varName: string) {
      const el = inputRef.current;
      const token = `{{ ${varName} }}`;
      if (!el) {
        onInsert(subject + token);
        return;
      }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + token + el.value.slice(end);
      onInsert(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    }
  
    return (
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {variables.map((varName) => {
          const used = usedTokens.has(varName);
          return (
            <button
              key={varName}
              type="button"
              title={`Insert {{ ${varName} }}`}
              onClick={() => insertAt(varName)}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-70 bg-primary/10 text-primary border-primary/20 ${used ? "opacity-60" : ""}`}
            >
              {varName}
              {used && <span className="ml-0.5 text-[10px] opacity-70">✓</span>}
            </button>
          );
        })}
      </div>
    );
  }
  