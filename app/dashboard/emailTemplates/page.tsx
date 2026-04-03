"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useEmailTemplateStore } from "./store/useEmailTemplateStore";
import { EmailTemplateService } from "./service/EmailTemplateService";
import { EmailTemplate } from "./interface/emailTemplate";
import { useAuth } from "@/app/lib/AuthContext";
import { formatDocId } from "@/app/utils/formatting";
import { renderEmailTemplate } from "@/app/lib/renderEmailTemplate";

// ─── Variable Token Registry ──────────────────────────────────────────────────

type TokenDef = {
  token: string;       // e.g. "firstName"
  label: string;       // displayed on chip
  description: string;
  category: "Standard" | "Gift" | "Welcome" | "Top-Up" | "Birthday" | "Notification";
  required?: boolean;
};

const TOKEN_REGISTRY: TokenDef[] = [
  // Standard — always available
  { token: "firstName",    label: "First Name",     description: "Recipient's first name",         category: "Standard", required: true },
  { token: "lastName",     label: "Last Name",      description: "Recipient's last name",           category: "Standard" },
  { token: "email",        label: "Email",          description: "Recipient's email address",       category: "Standard" },
  { token: "credits",      label: "Credits",        description: "Current credit balance",          category: "Standard" },
  { token: "storeName",    label: "Store Name",     description: "Customer's preferred store",      category: "Standard" },
  { token: "appUrl",       label: "App URL",        description: "Deep-link / app download URL",    category: "Standard" },
  { token: "currentYear",  label: "Current Year",   description: "4-digit year (for footers)",      category: "Standard" },
  // Gift Email
  { token: "amount",       label: "Amount",         description: "Gift credit amount",              category: "Gift" },
  { token: "newBalance",   label: "New Balance",    description: "Balance after gift/top-up",       category: "Gift" },
  // Welcome Email
  { token: "verifyUrl",    label: "Verify URL",     description: "Email verification link",         category: "Welcome" },
  // Top-Up Email
  { token: "topUpAmount",  label: "Top-Up Amount",  description: "Amount added in top-up",          category: "Top-Up" },
  // Birthday Email
  { token: "birthdayMonth",label: "Birthday Month", description: "Recipient's birthday month",      category: "Birthday" },
  { token: "promoCode",    label: "Promo Code",     description: "Birthday promo code",             category: "Birthday" },
  // Notification Email
  { token: "subject",      label: "Subject",        description: "Notification subject line",       category: "Notification" },
  { token: "body",         label: "Body",           description: "Free-form notification content",  category: "Notification" },
];

const KNOWN_TOKENS = new Set(TOKEN_REGISTRY.map((t) => t.token));

const CATEGORY_ORDER: TokenDef["category"][] = [
  "Standard", "Gift", "Welcome", "Top-Up", "Birthday", "Notification",
];

const CATEGORY_COLORS: Record<TokenDef["category"], string> = {
  Standard:     "bg-primary/10 text-primary border-primary/20",
  Gift:         "bg-amber-50 text-amber-700 border-amber-200",
  Welcome:      "bg-green-50 text-green-700 border-green-200",
  "Top-Up":     "bg-blue-50 text-blue-700 border-blue-200",
  Birthday:     "bg-pink-50 text-pink-700 border-pink-200",
  Notification: "bg-purple-50 text-purple-700 border-purple-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PREVIEW_VARIABLES: Record<string, string | number> = {
  firstName: "Jane", lastName: "Doe", email: "jane@example.com",
  credits: 150, storeName: "Coffix Main", appUrl: "https://app.coffix.com",
  currentYear: new Date().getFullYear(),
  amount: 50, newBalance: 200,
  verifyUrl: "https://app.coffix.com/verify?token=abc",
  topUpAmount: 100, birthdayMonth: "April", promoCode: "BDAY20",
  subject: "A message from Coffix", body: "This is a preview notification body.",
};

/** Extract all {{ token }} names from a string. */
function extractTokens(content: string): string[] {
  const matches = content.matchAll(/{{\s*(\w+)\s*}}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/** Returns token names that are in content but not in the registry. */
function unknownTokens(content: string): string[] {
  return extractTokens(content).filter((t) => !KNOWN_TOKENS.has(t));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateForm = { name: string; content: string; notes: string };
type TemplateFormErrors = { name?: boolean; content?: boolean };
const emptyForm: TemplateForm = { name: "", content: "", notes: "" };

function validateForm(form: TemplateForm): TemplateFormErrors {
  return { name: !form.name.trim(), content: !form.content.trim() };
}
function hasErrors(e: TemplateFormErrors) { return Object.values(e).some(Boolean); }

// ─── Token Chip Toolbar ───────────────────────────────────────────────────────

type TokenToolbarProps = {
  content: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (newContent: string) => void;
};

function TokenToolbar({ content, textareaRef, onInsert }: TokenToolbarProps) {
  const [activeCategory, setActiveCategory] = useState<TokenDef["category"]>("Standard");

  function insertToken(tokenDef: TokenDef) {
    const el = textareaRef.current;
    const insertion = `{{ ${tokenDef.token} }}`;
    if (!el) {
      onInsert(content + insertion);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + insertion + content.slice(end);
    onInsert(next);
    // Restore cursor after the inserted text
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insertion.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const usedTokens = new Set(extractTokens(content));
  const filteredTokens = TOKEN_REGISTRY.filter((t) => t.category === activeCategory);

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Category tabs */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeCategory === cat
                ? "border-primary text-primary bg-white"
                : "border-transparent text-light-grey hover:text-black"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Token chips */}
      <div className="flex flex-wrap gap-1.5 p-3">
        {filteredTokens.map((def) => {
          const used = usedTokens.has(def.token);
          return (
            <button
              key={def.token}
              type="button"
              title={def.description}
              onClick={() => insertToken(def)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-70 ${
                CATEGORY_COLORS[def.category]
              } ${used ? "opacity-60" : ""}`}
            >
              {def.required && (
                <span className="text-[10px] font-bold">*</span>
              )}
              {`{{ ${def.token} }}`}
              {used && (
                <span className="ml-0.5 text-[10px] opacity-70">✓</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="border-t border-border px-3 py-1.5 text-[11px] text-light-grey">
        Click a token to insert it at the cursor. <span className="font-mono">*</span> = required.{" "}
        <span className="opacity-60">✓</span> = already used.
      </p>
    </div>
  );
}

// ─── Token Validation Warning ─────────────────────────────────────────────────

function TokenValidation({ content }: { content: string }) {
  const unknown = unknownTokens(content);
  if (unknown.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-xs font-medium text-amber-700">Unrecognized tokens detected</p>
      <p className="mt-0.5 text-xs text-amber-600">
        The following tokens are not in the standard registry and may not be replaced at send
        time:{" "}
        {unknown.map((t, i) => (
          <span key={t}>
            <span className="font-mono">{`{{ ${t} }}`}</span>
            {i < unknown.length - 1 ? ", " : ""}
          </span>
        ))}
      </p>
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
  onClose: () => void;
  onSubmit: () => void;
  onChangeName: (v: string) => void;
  onChangeContent: (v: string) => void;
  onChangeNotes: (v: string) => void;
};

function TemplateDialog({
  title, form, errors, loading, isEdit,
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

            {/* Token toolbar */}
            <TokenToolbar
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

            {/* Unknown token warning */}
            <TokenValidation content={form.content} />

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
    setPreviewHtml(renderEmailTemplate(template.content, PREVIEW_VARIABLES));
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

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-5 py-3 text-left font-medium text-light-grey">Name</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Doc ID</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Notes</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Last Updated</th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-light-grey">
                  No email templates found.
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.docId} className="transition-colors hover:bg-background">
                  <td className="px-5 py-3 font-medium text-black">{template.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-light-grey">{template.docId}</td>
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
