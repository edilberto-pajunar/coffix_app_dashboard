"use client";

import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";
import { useEmailTemplateStore } from "./store/useEmailTemplateStore";
import { EmailTemplateService } from "./service/EmailTemplateService";
import { EmailTemplate } from "./interface/emailTemplate";
import { useAuth } from "@/app/lib/AuthContext";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";
import { formatDateTime } from "@/app/utils/formatting";
import { exportRowsToCSV } from "@/app/utils/import";
import { EMAIL_TEMPLATE_EXPORTABLE_FIELDS } from "./constants/emailTemplateFieldConstants";
import { Button } from "@/components/ui/button";
import { EmailTemplatesFilterBar } from "./components/EmailTemplatesFilterBar";
import { renderEmailTemplate } from "@/app/lib/renderEmailTemplate";
import { sanitizeHtml } from "@/app/lib/sanitize";
import { TemplateDialog } from "./components/TemplateDialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract all {{ token }} names from a string. */
export function extractTokens(content: string): string[] {
  const matches = content.matchAll(/{{\s*(\w+)\s*}}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateForm = { name: string; subject: string; content: string; notes: string };
export type TemplateFormErrors = { name?: boolean; subject?: boolean; content?: boolean };
const emptyForm: TemplateForm = { name: "", subject: "", content: "", notes: "" };

function validateForm(form: TemplateForm): TemplateFormErrors {
  const emptyContent =
    !form.content.trim() ||
    form.content === "<p></p>" ||
    form.content === "<p><br></p>";
  return {
    name: !form.name.trim(),
    subject: !form.subject.trim(),
    content: emptyContent,
  };
}
function hasErrors(e: TemplateFormErrors) { return Object.values(e).some(Boolean); }



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
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const { log } = useActivityLog();
  const templates = useEmailTemplateStore((s) => s.templates);

  const [search, setSearch] = useState("");

  const anyFilterActive = search.trim() !== "";

  function clearAllFilters() {
    setSearch("");
  }

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

  function exportToCSV() {
    exportRowsToCSV(displayed, EMAIL_TEMPLATE_EXPORTABLE_FIELDS, "email-templates");
  }

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
        {
          name: createForm.name.trim(),
          subject: createForm.subject.trim(),
          content: createForm.content.trim(),
          ...(createForm.notes.trim() ? { notes: createForm.notes.trim() } : {}),
        },
        user?.uid ?? ""
      );
      log({
        category: LOG_CATEGORY.EMAIL_TEMPLATES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Create Email Template",
        notes: `Admin created email template ${createForm.name.trim()}`,
        page: LOG_PAGE.EMAIL_TEMPLATES,
      });
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
    setEditForm({
      name: template.name,
      subject: template.subject ?? "",
      content: template.content,
      notes: template.notes ?? "",
    });
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
    // Captured before closeEdit() nulls editTarget.
    const templateName = editTarget.name;
    setEditLoading(true);
    try {
      await EmailTemplateService.updateTemplate(
        editTarget.docId,
        {
          subject: editForm.subject.trim(),
          content: editForm.content.trim(),
          notes: editForm.notes.trim() || "",
        },
        user?.uid ?? ""
      );
      log({
        category: LOG_CATEGORY.EMAIL_TEMPLATES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Edit Email Template",
        notes: `Admin edited email template ${templateName}`,
        page: LOG_PAGE.EMAIL_TEMPLATES,
      });
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
      log({
        category: LOG_CATEGORY.EMAIL_TEMPLATES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Delete Email Template",
        notes: `Admin deleted email template ${template.name}`,
        page: LOG_PAGE.EMAIL_TEMPLATES,
      });
      toast.success("Template deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template.");
    }
  }

  // ── Preview
  function openPreview(template: EmailTemplate) {
    const tokens = [...new Set([...extractTokens(template.subject ?? ""), ...extractTokens(template.content)])];
    const sampleVars = Object.fromEntries(tokens.map((v) => [v, `[${v}]`]));
    setPreviewHtml(sanitizeHtml(renderEmailTemplate(template.content, sampleVars)));
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
        <div className="flex gap-2">
<Button
            onClick={exportToCSV}
            disabled={displayed.length === 0}
            variant="outline"
          >
            Export CSV
          </Button>
          <Button
            onClick={openCreate}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            + New Template
          </Button>
        </div>
      </div>

      <EmailTemplatesFilterBar
        search={search} setSearch={setSearch}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

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
              <th className="px-5 py-3 text-left font-medium text-light-grey">Subject</th>
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
                  <td className="px-5 py-3 text-black">
                    {template.subject
                      ? template.subject.length > 60
                        ? template.subject.slice(0, 60) + "…"
                        : template.subject
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-black">
                    {template.notes
                      ? template.notes.length > 60
                        ? template.notes.slice(0, 60) + "…"
                        : template.notes
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-black">
                    {template.updatedAt ? formatDateTime(template.updatedAt ): "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPreview(template)}
                      >
                        Preview
                      </Button> */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(template)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(template)}
                      >
                        Delete
                      </Button>
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
          onChangeSubject={(v) => { setCreateForm((f) => ({ ...f, subject: v })); setCreateErrors((e) => ({ ...e, subject: false })); }}
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
          onChangeSubject={(v) => { setEditForm((f) => ({ ...f, subject: v })); setEditErrors((e) => ({ ...e, subject: false })); }}
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
