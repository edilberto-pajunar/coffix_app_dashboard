"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useDashboardStore } from "../products/store/useDashboardStore";
import { ProductService } from "../products/service/ProductService";
import { Category } from "../products/interface/category";
import { formatDocId } from "@/app/utils/formatting";
import {
  CATEGORY_PROTECTED_FIELDS,
  CATEGORY_IMPORTABLE_FIELDS,
  CATEGORY_REQUIRED_FIELDS,
  CATEGORY_EXPORTABLE_FIELDS,
} from "./constants/categoryFieldConstants";
import { parseCSVText } from "@/app/utils/csvUtils";
import { exportRowsToCSV } from "@/app/utils/import";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoriesFilterBar } from "./components/CategoriesFilterBar";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";

type ImportError = { row: number; field: string; reason: string };
type ImportPreview = { validRows: Record<string, string>[]; errors: ImportError[] } | null;

export default function CategoriesPage() {
  const categories = useDashboardStore((s) => s.categories);
  const { log } = useActivityLog();

  const [search, setSearch] = useState("");

  const anyFilterActive = search.trim() !== "";

  function clearAllFilters() {
    setSearch("");
  }

  const [orderedCategories, setOrderedCategories] = useState(
    [...categories].sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999))
  );
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    setOrderedCategories(
      [...categories].sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999))
    );
  }, [categories]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orderedCategories;
    return orderedCategories.filter((c) => (c.name ?? "").toLowerCase().includes(q));
  }, [orderedCategories, search]);

  const [categoryDialog, setCategoryDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryErrors, setCategoryErrors] = useState<{ name?: boolean }>({});
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openEdit(docId: string, name: string) {
    setActiveCategoryId(docId);
    setCategoryForm({ name: name ?? "" });
    setCategoryDialog("edit");
  }

  async function handleDrop(dropIndex: number) {
    if (dragIndex.current === null || dragIndex.current === dropIndex) return;
    const reordered = [...orderedCategories];
    const [moved] = reordered.splice(dragIndex.current, 1);
    reordered.splice(dropIndex, 0, moved);
    dragIndex.current = null;
    setOrderedCategories(reordered);
    await Promise.all(
      reordered.map((cat, i) =>
        ProductService.updateCategory(cat.docId!, { order: i + 1 })
      )
    );
  }

  async function handleSaveCategory() {
    if (!categoryForm.name.trim()) {
      setCategoryErrors({ name: true });
      return;
    }
    setCategoryErrors({});
    setCategoryLoading(true);
    try {
      const data = { name: categoryForm.name.trim() };
      if (categoryDialog === "create") { 
        await ProductService.createCategory({
          name: categoryForm.name.trim(),
          createdAt: new Date(),
        });
      } else if (categoryDialog === "edit" && activeCategoryId) {
        await ProductService.updateCategory(activeCategoryId, data);
      }
      log({
        category: LOG_CATEGORY.CATEGORIES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: categoryDialog === "create" ? "Create Category" : "Edit Category",
        notes:
          categoryDialog === "create"
            ? `Admin added new category ${data.name}`
            : `Admin edited category ${data.name}`,
        page: LOG_PAGE.CATEGORIES,
      });
      toast.success(categoryDialog === "create" ? "Category created." : "Category updated.");
      setCategoryDialog(null);
      setCategoryForm({ name: "" });
      setActiveCategoryId(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save category.");
    } finally {
      setCategoryLoading(false);
    }
  }

  async function handleDeleteCategory() {
    if (!activeCategoryId) return;
    setCategoryLoading(true);
    // Resolved before the delete — the row leaves the store once it's gone.
    const categoryName =
      categories.find((c) => c.docId === activeCategoryId)?.name ?? activeCategoryId;
    try {
      await ProductService.deleteCategory(activeCategoryId);
      log({
        category: LOG_CATEGORY.CATEGORIES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Delete Category",
        notes: `Admin deleted ${categoryName} category`,
        page: LOG_PAGE.CATEGORIES,
      });
      toast.success("Category deleted.");
      setCategoryDialog(null);
      setActiveCategoryId(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete category.");
    } finally {
      setCategoryLoading(false);
    }
  }

  function exportToCSV() {
    exportRowsToCSV(orderedCategories, CATEGORY_EXPORTABLE_FIELDS, "categories");
  }

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCSVText(text);

        const protectedInFile = headers.filter((h) =>
          (CATEGORY_PROTECTED_FIELDS as readonly string[]).includes(h)
        );
        if (protectedInFile.length > 0) {
          toast.error(`CSV contains protected columns: ${protectedInFile.join(", ")}. Remove them and re-upload.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const existingCategoryIds = useDashboardStore.getState().categories.map((c) => c.docId!);
        const existingCategoryNames = useDashboardStore.getState().categories.map((c) =>
          formatDocId(c.name ?? "")
        );
        const validImportCols = new Set([...(CATEGORY_IMPORTABLE_FIELDS as readonly string[]), "docId"]);

        const validRows: Record<string, string>[] = [];
        const errors: ImportError[] = [];

        rows.forEach((cols, idx) => {
          const rowNum = idx + 2;
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

          headers.filter((h) => !validImportCols.has(h)).forEach((col) =>
            errors.push({ row: rowNum, field: col, reason: `Unknown column "${col}" will be ignored` })
          );

          let hasError = false;

          if (row.docId && !existingCategoryIds.includes(row.docId)) {
            errors.push({ row: rowNum, field: "docId", reason: "Category not found — cannot update" });
            hasError = true;
          }

          if (!row.docId) {
            if (!(CATEGORY_REQUIRED_FIELDS as readonly string[]).every((f) => row[f]?.trim())) {
              errors.push({ row: rowNum, field: "name", reason: "name is required for new categories" });
              hasError = true;
            } else {
              const derivedId = formatDocId(row.name);
              if (existingCategoryNames.includes(derivedId)) {
                errors.push({ row: rowNum, field: "name", reason: `Category "${row.name}" already exists` });
                hasError = true;
              }
            }
          }

          if (row.order && isNaN(Number(row.order))) {
            errors.push({ row: rowNum, field: "order", reason: "Must be a valid number" });
            hasError = true;
          }

          if (!hasError) validRows.push(row);
        });

        setImportPreview({ validRows, errors });
      } catch {
        toast.error("Failed to read CSV file.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    if (!importPreview || importPreview.validRows.length === 0) return;
    setImportLoading(true);
    try {
      let count = 0;
      for (const row of importPreview.validRows) {
        if (row.docId) {
          const update: Partial<Omit<Category, "docId">> = {};
          if (row.name) update.name = row.name;
          if (row.order) update.order = Number(row.order);
          await ProductService.updateCategory(row.docId, update);
        } else {
          await ProductService.createCategory({
            name: row.name,
            ...(row.order ? { order: Number(row.order) } : {}),
          });
        }
        count++;
      }
      log({
        category: LOG_CATEGORY.IMPORT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Import Categories",
        notes: `Admin imported ${count} categor${count !== 1 ? "ies" : "y"} via CSV`,
        page: LOG_PAGE.CATEGORIES,
      });
      toast.success(`Imported ${count} categor${count !== 1 ? "ies" : "y"}.`);
      setImportPreview(null);
    } catch {
      toast.error("Failed to import categories.");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Categories</h1>
          <p className="mt-1 text-sm text-light-grey">
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"} total
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportInfo(true)}
            disabled={importLoading}
          >
            {importLoading ? "Importing…" : "Import CSV"}
          </Button> */}
          <div className="flex gap-2">
          <Button variant="outline"  onClick={exportToCSV}>Export CSV</Button>
          <Button
              onClick={() => {
                setCategoryForm({ name: "" });
                setCategoryDialog("create");
              }}
            >
              + New Category
            </Button>
        </div>
        </div>
      </div>

      <CategoriesFilterBar
        search={search} setSearch={setSearch}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-5 py-3 text-left font-medium text-light-grey">Name</th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-light-grey">
                  No categories found.
                </td>
              </tr>
            ) : (
              displayed.map((c, i) => (
                <tr
                  key={c.docId}
                  draggable={!anyFilterActive}
                  onDragStart={() => { if (!anyFilterActive) dragIndex.current = i; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (!anyFilterActive) handleDrop(i); }}
                  onClick={() => openEdit(c.docId ?? "", c.name ?? "")}
                  className="cursor-pointer transition-colors hover:bg-background"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0 cursor-grab text-light-grey active:cursor-grabbing" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5.5" cy="3.5" r="1.25" />
                        <circle cx="10.5" cy="3.5" r="1.25" />
                        <circle cx="5.5" cy="8" r="1.25" />
                        <circle cx="10.5" cy="8" r="1.25" />
                        <circle cx="5.5" cy="12.5" r="1.25" />
                        <circle cx="10.5" cy="12.5" r="1.25" />
                      </svg>
                      <span className="font-medium text-black">{c.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCategoryId(c.docId ?? null);
                          setCategoryDialog("delete");
                        }}
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

      {/* CSV Field Guide Dialog */}
      <Dialog open={showImportInfo} onOpenChange={setShowImportInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV Import Guide — Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium text-black">Editable fields</p>
              <div className="flex flex-wrap gap-1.5">
                {(["name", "order"] as const).map((f) => (
                  <span key={f} className="rounded-md bg-background border border-border px-2 py-0.5 text-xs text-black font-mono">{f}</span>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-black">Required fields <span className="text-xs font-normal text-light-grey">(for new rows)</span></p>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-md bg-amber-50 border border-amber-300 px-2 py-0.5 text-xs text-amber-800 font-mono">name</span>
              </div>
            </div>
            <p className="text-xs text-light-grey leading-relaxed">
              Include <span className="font-mono text-black">docId</span> to update an existing category. Omit it to create a new one.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportInfo(false)}>Cancel</Button>
            <Button onClick={() => { setShowImportInfo(false); fileInputRef.current?.click(); }}>
              Choose File →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importPreview !== null} onOpenChange={() => setImportPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {importPreview && importPreview.errors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-black">Errors</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-3 space-y-1">
                  {importPreview.errors.map((e, i) => (
                    <p key={i} className="text-xs text-black">
                      <span className="font-medium">Row {e.row}</span> — {e.field}: {e.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm text-black">
              <span className="font-medium">{importPreview?.validRows.length ?? 0}</span> row(s) will be imported.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)} disabled={importLoading}>
              Cancel
            </Button>
            {(importPreview?.validRows.length ?? 0) > 0 && (
              <Button onClick={handleConfirmImport} disabled={importLoading}>
                {importLoading ? "Importing…" : `Import ${importPreview?.validRows.length} row(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Category Dialog ── */}
      <Dialog
        open={categoryDialog === "create" || categoryDialog === "edit"}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryDialog(null);
            setCategoryErrors({});
            setCategoryForm({ name: "" });
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {categoryDialog === "create" ? "New Category" : "Edit Category"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">Name *</label>
              <input
                className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${categoryErrors.name ? "border-error" : "border-border"}`}
                placeholder="e.g. Drinks"
                value={categoryForm.name}
                onChange={(e) => {
                  setCategoryForm((f) => ({ ...f, name: e.target.value }));
                  setCategoryErrors({});
                }}
              />
              {categoryErrors.name && (
                <p className="mt-1 text-xs text-error">Name is required.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCategoryDialog(null);
                setCategoryErrors({});
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={categoryLoading}>
              {categoryLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Category Confirmation Dialog ── */}
      <Dialog
        open={categoryDialog === "delete"}
        onOpenChange={(open) => {
          if (!open) setCategoryDialog(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this category? This action cannot be undone.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={categoryLoading}
            >
              {categoryLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
