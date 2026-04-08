"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDashboardStore } from "../products/store/useDashboardStore";
import { ProductService } from "../products/service/ProductService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function CategoriesPage() {
  const categories = useDashboardStore((s) => s.categories);

  const [categoryDialog, setCategoryDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", order: "" });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryErrors, setCategoryErrors] = useState<{ name?: boolean }>({});
  const [categoryLoading, setCategoryLoading] = useState(false);

  function openEdit(docId: string, name: string, order?: string) {
    setActiveCategoryId(docId);
    setCategoryForm({ name: name ?? "", order: order != null ? String(order) : "" });
    setCategoryDialog("edit");
  }

  async function handleSaveCategory() {
    if (!categoryForm.name.trim()) {
      setCategoryErrors({ name: true });
      return;
    }
    setCategoryErrors({});
    setCategoryLoading(true);
    try {
      const data = {
        name: categoryForm.name.trim(),
        ...(categoryForm.order !== "" ? { order: categoryForm.order } : {}),
      };
      if (categoryDialog === "create") {
        await ProductService.createCategory(data);
      } else if (categoryDialog === "edit" && activeCategoryId) {
        await ProductService.updateCategory(activeCategoryId, data);
      }
      toast.success(categoryDialog === "create" ? "Category created." : "Category updated.");
      setCategoryDialog(null);
      setCategoryForm({ name: "", order: "" });
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
    try {
      await ProductService.deleteCategory(activeCategoryId);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Categories</h1>
          <p className="mt-1 text-sm text-light-grey">
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"} total
          </p>
        </div>
        <Button
          onClick={() => {
            setCategoryForm({ name: "", order: "" });
            setCategoryDialog("create");
          }}
        >
          + New Category
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-5 py-3 text-left font-medium text-light-grey">Name</th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Order</th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-light-grey">
                  No categories yet.
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr
                  key={c.docId}
                  onClick={() => openEdit(c.docId ?? "", c.name ?? "", c.order)}
                  className="cursor-pointer transition-colors hover:bg-background"
                >
                  <td className="px-5 py-3 font-medium text-black">{c.name ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-light-grey">{c.order ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openEdit(c.docId ?? "", c.name ?? "", c.order)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => {
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

      {/* ── Create / Edit Category Dialog ── */}
      <Dialog
        open={categoryDialog === "create" || categoryDialog === "edit"}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryDialog(null);
            setCategoryErrors({});
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
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">Order</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                placeholder="0"
                value={categoryForm.order}
                onChange={(e) => setCategoryForm((f) => ({ ...f, order: e.target.value }))}
              />
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
