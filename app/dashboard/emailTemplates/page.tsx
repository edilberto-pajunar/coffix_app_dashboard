"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useEmailTemplateStore } from "./store/useEmailTemplateStore";
import { EmailTemplateService } from "./service/EmailTemplateService";
import { EmailTemplate } from "./interface/emailTemplate";
import { useAuth } from "@/app/lib/AuthContext";
import { formatDocId } from "@/app/utils/formatting";
import { renderEmailTemplate } from "@/app/lib/renderEmailTemplate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract all {{ token }} names from a string. */
function extractTokens(content: string): string[] {
  const matches = content.matchAll(/{{\s*(\w+)\s*}}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateForm = { name: string; content: string; notes: string };
type TemplateFormErrors = { name?: boolean; content?: boolean };
const emptyForm: TemplateForm = { name: "", content: "", notes: "" };

function validateForm(form: TemplateForm): TemplateFormErrors {
  return { name: !form.name.trim(), content: !form.content.trim() };
}
function hasErrors(e: TemplateFormErrors) { return Object.values(e).some(Boolean); }

// ─── Variable Chips ───────────────────────────────────────────────────────────

type VariableChipsProps = {
  variables: string[];
  content: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (newContent: string) => void;
};

function VariableChips({ variables, content, textareaRef, onInsert }: VariableChipsProps) {
  function insertVariable(varName: string) {
    const el = textareaRef.current;
    const insertion = `{{ ${varName} }}`;
    if (!el) {
      onInsert(content + insertion);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + insertion + content.slice(end);
    onInsert(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insertion.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const usedTokens = new Set(extractTokens(content));

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex flex-wrap gap-1.5 p-3">
        {variables.length === 0 ? (
          <p className="text-xs text-light-grey">
            No variables defined for this template. A developer can add them directly in Firestore.
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
                {`{{ ${varName} }}`}
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

// ─── Template Dialog ──────────────────────────────────────────────────────────

type TemplateDialogProps = {
  title: string;
  form: TemplateForm;
  errors: TemplateFormErrors;
  loading: boolean;
  isEdit: boolean;
  variables: string[];
  onClose: () => void;
  onSubmit: () => void;
  onChangeName: (v: string) => void;
  onChangeContent: (v: string) => void;
  onChangeNotes: (v: string) => void;
};

function TemplateDialog({
  title, form, errors, loading, isEdit, variables,
  onClose, onSubmit, onChangeName, onChangeContent, onChangeNotes,
}: TemplateDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
              className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-soft-grey ${
                errors.name ? "border-error" : "border-border"
              }`}
            />
            {!isEdit && (
              <p className="mt-1 text-xs text-light-grey">
                Will be saved as:{" "}
                <span className="font-mono">
                  {form.name.trim() ? formatDocId(form.name) : "…"}
                </span>
              </p>
            )}
            {errors.name && (
              <p className="mt-1 text-xs text-error">Name is required.</p>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="block text-xs text-light-grey">Content (HTML) *</label>

            {/* Variable chips */}
            <VariableChips
              variables={variables}
              content={form.content}
              textareaRef={textareaRef}
              onInsert={onChangeContent}
            />

            <textarea
              ref={textareaRef}
              rows={12}
              value={form.content}
              onChange={(e) => onChangeContent(e.target.value)}
              placeholder={"<p>Hi {{ firstName }},</p>\n<p>Your balance is <strong>{{ credits }}</strong>.</p>"}
              className={`w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs text-black outline-none focus:border-primary ${
                errors.content ? "border-error" : "border-border"
              }`}
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
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
          >
            {loading
              ? isEdit ? "Saving…" : "Creating…"
              : isEdit ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-black">Template Preview</h3>
          <p className="mt-0.5 text-xs text-light-grey">Rendered with sample data</p>
        </div>
        <div className="p-4">
          <iframe
            srcDoc={html}
            className="h-[60vh] w-full rounded-lg border border-border"
            title="Email preview"
          />
        </div>
        <div className="flex justify-end border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const templates = useEmailTemplateStore((s) => s.templates);

  const [search, setSearch] = useState("");
  type TemplateSortKey = "name" | "updatedAt";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<TemplateSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: TemplateSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = templates.filter((t) => {
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.docId.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
      );
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else {
        const at = a.updatedAt?.toDate().getTime() ?? 0;
        const bt = b.updatedAt?.toDate().getTime() ?? 0;
        cmp = at - bt;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [templates, search, sortKey, sortDir]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<TemplateForm>(emptyForm);
  const [createErrors, setCreateErrors] = useState<TemplateFormErrors>({});
  const [createLoading, setCreateLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<EmailTemplate | null>(null);
  const [editForm, setEditForm] = useState<TemplateForm>(emptyForm);
  const [editErrors, setEditErrors] = useState<TemplateFormErrors>({});
  const [editLoading, setEditLoading] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // ── Create
  function openCreate() {
    setCreateForm(emptyForm);
    setCreateErrors({});
    setShowCreate(true);
  }
  function closeCreate() {
    setShowCreate(false);
    setCreateForm(emptyForm);
    setCreateErrors({});
  }
  async function handleCreate() {
    const errs = validateForm(createForm);
    if (hasErrors(errs)) { setCreateErrors(errs); toast.error("Please fix the errors before submitting."); return; }
    setCreateLoading(true);
    try {
      await EmailTemplateService.createTemplate(
        { name: createForm.name.trim(), content: createForm.content.trim(), ...(createForm.notes.trim() ? { notes: createForm.notes.trim() } : {}) },
        user?.uid ?? ""
      );
      toast.success("Template created.");
      closeCreate();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create template. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Edit
  function openEdit(template: EmailTemplate) {
    setEditTarget(template);
    setEditForm({ name: template.name, content: template.content, notes: template.notes ?? "" });
    setEditErrors({});
  }
  function closeEdit() {
    setEditTarget(null);
    setEditForm(emptyForm);
    setEditErrors({});
  }
  async function handleUpdate() {
    if (!editTarget) return;
    const errs = validateForm(editForm);
    if (hasErrors(errs)) { setEditErrors(errs); toast.error("Please fix the errors before submitting."); return; }
    setEditLoading(true);
    try {
      await EmailTemplateService.updateTemplate(
        editTarget.docId,
        { content: editForm.content.trim(), notes: editForm.notes.trim() || "" },
        user?.uid ?? ""
      );
      toast.success("Template updated.");
      closeEdit();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update template. Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete
  async function handleDelete(template: EmailTemplate) {
    if (!window.confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    try {
      await EmailTemplateService.deleteTemplate(template.docId);
      toast.success("Template deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template.");
    }
  }

  // ── Preview
  function openPreview(template: EmailTemplate) {
    const sampleVars = Object.fromEntries(
      (template.variables ?? []).map((v) => [v, `[${v}]`])
    );
    setPreviewHtml(renderEmailTemplate(template.content, sampleVars));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Email Templates</h1>
          <p className="mt-1 text-sm text-light-grey">
            {templates.length} template{templates.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
        >
          + New Template
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, ID or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary sm:max-w-xs"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th
                onClick={() => toggleSort("name")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Name {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Doc ID</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Variables</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Notes</th>
              <th
                onClick={() => toggleSort("updatedAt")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Last Updated {sortKey === "updatedAt" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-light-grey">
                  No email templates found.
                </td>
              </tr>
            ) : (
              displayed.map((template) => (
                <tr key={template.docId} className="transition-colors hover:bg-background">
                  <td className="px-5 py-3 font-medium text-black">{template.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-light-grey">{template.docId}</td>
                  <td className="px-5 py-3">
                    {template.variables && template.variables.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((v) => (
                          <span
                            key={v}
                            className="inline-block rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                          >
                            {`{{ ${v} }}`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-light-grey">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-black">
                    {template.notes
                      ? template.notes.length > 60
                        ? template.notes.slice(0, 60) + "…"
                        : template.notes
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-black">
                    {template.updatedAt ? template.updatedAt.toDate().toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openPreview(template)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-black transition-colors hover:border-primary hover:text-primary"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => openEdit(template)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-black transition-colors hover:border-primary hover:text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-error transition-colors hover:border-error hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <TemplateDialog
          title="New Template"
          form={createForm}
          errors={createErrors}
          loading={createLoading}
          isEdit={false}
          variables={[]}
          onClose={closeCreate}
          onSubmit={handleCreate}
          onChangeName={(v) => { setCreateForm((f) => ({ ...f, name: v })); setCreateErrors((e) => ({ ...e, name: false })); }}
          onChangeContent={(v) => { setCreateForm((f) => ({ ...f, content: v })); setCreateErrors((e) => ({ ...e, content: false })); }}
          onChangeNotes={(v) => setCreateForm((f) => ({ ...f, notes: v }))}
        />
      )}

      {/* Edit Dialog */}
      {editTarget && (
        <TemplateDialog
          title="Edit Template"
          form={editForm}
          errors={editErrors}
          loading={editLoading}
          isEdit={true}
          variables={editTarget.variables ?? []}
          onClose={closeEdit}
          onSubmit={handleUpdate}
          onChangeName={() => {}}
          onChangeContent={(v) => { setEditForm((f) => ({ ...f, content: v })); setEditErrors((e) => ({ ...e, content: false })); }}
          onChangeNotes={(v) => setEditForm((f) => ({ ...f, notes: v }))}
        />
      )}

      {/* Preview Modal */}
      {previewHtml !== null && (
        <PreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />
      )}
    </div>
  );
}
