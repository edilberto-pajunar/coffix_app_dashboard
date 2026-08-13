"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useDashboardStore } from "../products/store/useDashboardStore";
import { ProductService } from "../products/service/ProductService";
import { Category, isCategoryNameTaken, productIdsReferencingCategory } from "../products/interface/category";
import {
  CATEGORY_PROTECTED_FIELDS,
  CATEGORY_IMPORTABLE_FIELDS,
  CATEGORY_REQUIRED_FIELDS,
  CATEGORY_EXPORTABLE_FIELDS,
} from "./constants/categoryFieldConstants";
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
import { useAuth } from "@/app/lib/AuthContext";
import { ImportCsvDialog, firstExampleRecord } from "@/components/import/ImportCsvDialog";
import { isFileError, parseImportFile } from "@/components/import/parseImportFile";
import type { ImportError, ImportPreview } from "@/components/import/types";
import { classifyDocIdTarget, validateDocIdFormat } from "@/components/import/storeRefs";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";

export default function CategoriesPage() {
  const categories = useDashboardStore((s) => s.categories);
  const products = useDashboardStore((s) => s.products);
  const { currentStaff } = useAuth();
  const isAdmin = currentStaff?.role === "admin";
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
  const [categoryErrors, setCategoryErrors] = useState<{ name?: boolean; nameMessage?: string }>({});
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productsUsingCategory = useMemo(
    () => products.filter((p) => p.categoryId === activeCategoryId),
    [products, activeCategoryId],
  );

  function openEdit(docId: string, name: string) {
    setActiveCategoryId(docId);
    setCategoryForm({ name: name ?? "" });
    setCategoryErrors({});
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
      setCategoryErrors({ name: true, nameMessage: "Name is required." });
      return;
    }
    if (
      isCategoryNameTaken(
        categories,
        categoryForm.name,
        categoryDialog === "edit" ? (activeCategoryId ?? undefined) : undefined,
      )
    ) {
      setCategoryErrors({ name: true, nameMessage: "This category name is already in use." });
      toast.error("This category name is already in use.");
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

  /**
   * Returns a fresh validator per import. Names claimed by earlier rows are held in
   * the closure, so a file cannot introduce duplicates among its own rows — the
   * database check alone would pass every row and then write the collision.
   */
  function makeCategoryRowValidator() {
    const claimedNames = new Map<string, number>();

    return function validateCategoryRow(
      row: Record<string, string>,
      rowNum: number,
    ): ImportError[] {
        const errors: ImportError[] = [];
        const existing = useDashboardStore.getState().categories;
        const existingCategoryIds = existing.map((c) => c.docId!);
        const allCategoryIds = useDashboardStore.getState().allCategories.map((c) => c.docId!);

        // Format first: a wrong-entity ID gets a message naming the right section, instead
        // of the membership check's generic "not found". A soft-deleted target is not an
        // error — the row restores it on write. Only an unknown ID fails.
        const docIdFormatError = validateDocIdFormat(row.docId, "productCategories", rowNum);
        if (docIdFormatError) {
          errors.push(docIdFormatError);
        } else if (
          row.docId &&
          classifyDocIdTarget(row.docId, existingCategoryIds, allCategoryIds) === "unknown"
        ) {
          errors.push({ row: rowNum, field: "docId", reason: "Category not found — cannot update" });
        }

        if (!row.docId) {
          if (!(CATEGORY_REQUIRED_FIELDS as readonly string[]).every((f) => row[f]?.trim())) {
            errors.push({ row: rowNum, field: "name", reason: "name is required for new categories" });
          } else if (isCategoryNameTaken(existing, row.name)) {
            errors.push({ row: rowNum, field: "name", reason: `Category "${row.name}" already exists` });
          } else {
            const key = row.name.trim().toLowerCase();
            const claimedBy = claimedNames.get(key);
            if (claimedBy !== undefined) {
              errors.push({
                row: rowNum,
                field: "name",
                reason: `Category "${row.name}" duplicates row ${claimedBy}`,
              });
            } else {
              claimedNames.set(key, rowNum);
            }
          }
        }

        if (row.order && isNaN(Number(row.order))) {
          errors.push({ row: rowNum, field: "order", reason: "Must be a valid number" });
        }

        return errors;
    };
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const result = await parseImportFile(file, {
      protectedFields: CATEGORY_PROTECTED_FIELDS,
      importableFields: CATEGORY_IMPORTABLE_FIELDS,
      validateRow: makeCategoryRowValidator(),
    });

    if (isFileError(result)) {
      toast.error(result.fileError);
      return;
    }
    setImportPreview(result);
  }

  async function handleConfirmImport() {
    const importable =
      importPreview?.rows.filter((r) => r.action !== "error") ?? [];
    if (importable.length === 0) return;
    setImportLoading(true);
    try {
      let created = 0;
      let updated = 0;
      for (const { action, data: row } of importable) {
        if (action === "update") {
          // Clearing the soft-delete flags restores a category deleted after the CSV was
          // exported; on a live category it is a no-op.
          const update: Partial<Omit<Category, "docId">> = {
            isDeleted: false,
            deletedAt: null,
          };
          if (row.name) update.name = row.name;
          if (row.order) update.order = Number(row.order);
          await ProductService.updateCategory(row.docId, update);
          updated++;
        } else {
          await ProductService.createCategory({
            name: row.name,
            createdAt: new Date(),
            ...(row.order ? { order: Number(row.order) } : {}),
          });
          created++;
        }
      }
      log({
        category: LOG_CATEGORY.IMPORT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Import Categories",
        notes: `Admin created ${created} and updated ${updated} categor${created + updated !== 1 ? "ies" : "y"} via CSV`,
        page: LOG_PAGE.CATEGORIES,
      });
      toast.success(`Created ${created} and updated ${updated} categor${created + updated !== 1 ? "ies" : "y"}.`);
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
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setShowImportInfo(true)}
              disabled={importLoading}
            >
              {importLoading ? "Importing…" : "Import CSV"}
            </Button>
          )}
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
              <th className="px-5 py-3 text-left font-medium text-light-grey">Products</th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-light-grey">
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
                  <td className="px-5 py-3 text-black">
                    {productIdsReferencingCategory(products, c.docId ?? "").length}
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

      <ImportCsvDialog
        entityLabel="Categories"
        idCollection="productCategories"
        exampleRecord={firstExampleRecord(orderedCategories)}
        guideOpen={showImportInfo}
        onGuideOpenChange={setShowImportInfo}
        guide={{
          editable: CATEGORY_IMPORTABLE_FIELDS,
          required: CATEGORY_REQUIRED_FIELDS,
        }}
        onChooseFile={() => fileInputRef.current?.click()}
        preview={importPreview}
        onPreviewClose={() => setImportPreview(null)}
        loading={importLoading}
        onConfirm={handleConfirmImport}
      />

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
                <p className="mt-1 text-xs text-error">{categoryErrors.nameMessage ?? "Name is required."}</p>
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

          {productsUsingCategory.length > 0 && (
            <div className="rounded-lg border border-error/30 bg-error/5 px-3 py-2.5">
              <p className="text-xs font-medium text-error">
                ⚠ Used by {productsUsingCategory.length} product
                {productsUsingCategory.length !== 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-xs text-light-grey">
                These products will keep this category unless reassigned:{" "}
                {productsUsingCategory.slice(0, 5).map((p) => p.name ?? "Unnamed").join(", ")}
                {productsUsingCategory.length > 5 ? `, +${productsUsingCategory.length - 5} more` : ""}.
              </p>
            </div>
          )}

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
