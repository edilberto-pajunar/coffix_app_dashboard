"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "./store/useDashboardStore";
import { useStoreStore } from "../stores/store/useStoreStore";
import { Product } from "./interface/product";
import { ProductService } from "./service/ProductService";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type NewProductForm = {
  name: string;
  imageUrl: string;
  price: string;
  cost: string;
  order: string;
  categoryId: string;
  modifierGroupIds: string[];
  availableToStores: string[];
};

const emptyForm: NewProductForm = {
  name: "",
  imageUrl: "",
  price: "",
  cost: "",
  order: "",
  categoryId: "",
  modifierGroupIds: [],
  availableToStores: [],
};

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  error,
  showSelectAll,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  error?: boolean;
  showSelectAll?: boolean;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  const allSelected = options.length > 0 && options.every((o) => selected.includes(o.value));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs text-light-grey">{label} *</label>
        {showSelectAll && options.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              disabled={allSelected}
              className="text-xs text-primary hover:underline disabled:opacity-40"
            >
              Select all
            </button>
            <span className="text-xs text-light-grey">·</span>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="text-xs text-light-grey hover:text-black hover:underline disabled:opacity-40"
            >
              Unselect all
            </button>
          </div>
        )}
      </div>
      <div className={`max-h-36 overflow-y-auto rounded-lg border bg-white p-2 space-y-1 ${error ? "border-error" : "border-border"}`}>
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-light-grey">No options available.</p>
        ) : (
          options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-black hover:bg-soft-grey">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-error">Please select at least one.</p>
      ) : selected.length > 0 ? (
        <p className="mt-1 text-xs text-light-grey">{selected.length} selected</p>
      ) : null}
    </div>
  );
}

export default function ProductsPage() {
  const products = useDashboardStore((s) => s.products);
  const categories = useDashboardStore((s) => s.categories);
  const modifierGroups = useDashboardStore((s) => s.modifierGroups);
  const getCategoryName = useDashboardStore((s) => s.getCategoryName);
  const stores = useStoreStore((s) => s.stores);

  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewProductForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NewProductForm, boolean>>>({});
  const [loading, setLoading] = useState(false);

  const [showCategories, setShowCategories] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", order: "" });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryErrors, setCategoryErrors] = useState<{ name?: boolean }>({});
  const [categoryLoading, setCategoryLoading] = useState(false);

  const categoryFilters = [
    "All",
    ...Array.from(new Set(products.map((p) => getCategoryName(p.categoryId)))),
  ];

  const filtered = products.filter((p) => {
    const matchesSearch = (p.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" ? true : getCategoryName(p.categoryId) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  function setField<K extends keyof NewProductForm>(key: K, value: NewProductForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: false }));
  }

  function closeCreate() {
    setShowCreate(false);
    setForm(emptyForm);
    setErrors({});
  }

  async function handleCreate() {
    const newErrors: Partial<Record<keyof NewProductForm, boolean>> = {
      name: !form.name.trim(),
      price: !form.price,
      cost: !form.cost,
      order: !form.order,
      categoryId: !form.categoryId,
      modifierGroupIds: form.modifierGroupIds.length === 0,
      availableToStores: form.availableToStores.length === 0,
    };

    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields.");
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await ProductService.createProduct({
        name: form.name.trim(),
        imageUrl: form.imageUrl.trim() || undefined,
        price: parseFloat(form.price),
        cost: parseFloat(form.cost),
        order: parseInt(form.order),
        categoryId: form.categoryId,
        modifierGroupIds: form.modifierGroupIds,
        availableToStores: form.availableToStores,
      });
      toast.success("Product created successfully.");
      closeCreate();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create product. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-semibold text-black">Products</h1>
          <p className="mt-1 text-sm text-light-grey">
            {products.length} product{products.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategories(true)}>
            Manage Categories
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            + New Product
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {categoryFilters.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedCategory === cat
                ? "bg-primary text-white"
                : "bg-soft-grey text-black hover:bg-beige"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-5 py-3 text-left font-medium text-light-grey">Product</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Category</th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Price</th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-light-grey">
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((product: Product) => (
                <tr
                  key={product.docId}
                  onClick={() => router.push(`/dashboard/products/${product.docId}`)}
                  className="cursor-pointer transition-colors hover:bg-background"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          width={36}
                          height={36}
                          alt={product.name ?? "Product Image"}
                          className="rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft-grey text-xs font-bold text-light-grey">
                          {(product.name ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-black">{product.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-soft-grey px-2.5 py-1 text-xs font-medium text-black">
                      {getCategoryName(product.categoryId)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-primary">
                    {(product.price ?? 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right text-light-grey">
                    {(product.cost ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Create Product Dialog ── */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs text-light-grey">Name *</label>
                <input
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.name ? "border-error" : "border-border"}`}
                  placeholder="e.g. Caramel Latte"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
                {errors.name && <p className="mt-1 text-xs text-error">Name is required.</p>}
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs text-light-grey">Image URL</label>
                <input
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={(e) => setField("imageUrl", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-light-grey">Price *</label>
                <input
                  type="number"
                  min={0}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.price ? "border-error" : "border-border"}`}
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                />
                {errors.price && <p className="mt-1 text-xs text-error">Required.</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-light-grey">Cost *</label>
                <input
                  type="number"
                  min={0}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.cost ? "border-error" : "border-border"}`}
                  placeholder="0.00"
                  value={form.cost}
                  onChange={(e) => setField("cost", e.target.value)}
                />
                {errors.cost && <p className="mt-1 text-xs text-error">Required.</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-light-grey">Order *</label>
                <input
                  type="number"
                  min={0}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.order ? "border-error" : "border-border"}`}
                  placeholder="0"
                  value={form.order}
                  onChange={(e) => setField("order", e.target.value)}
                />
                {errors.order && <p className="mt-1 text-xs text-error">Required.</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-light-grey">Category *</label>
              <select
                className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.categoryId ? "border-error" : "border-border"}`}
                value={form.categoryId}
                onChange={(e) => setField("categoryId", e.target.value)}
              >
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.docId} value={c.docId}>{c.name}</option>
                ))}
              </select>
              {errors.categoryId && <p className="mt-1 text-xs text-error">Category is required.</p>}
            </div>

            <MultiSelect
              label="Modifier Groups"
              options={modifierGroups.map((g) => ({ value: g.docId ?? "", label: g.name ?? g.docId ?? "" }))}
              selected={form.modifierGroupIds}
              onChange={(v) => setField("modifierGroupIds", v)}
              error={errors.modifierGroupIds}
            />

            <MultiSelect
              label="Available to Stores"
              options={stores.map((s) => ({ value: s.docId, label: s.name ?? s.docId }))}
              selected={form.availableToStores}
              onChange={(v) => setField("availableToStores", v)}
              error={errors.availableToStores}
              showSelectAll
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeCreate}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading || !form.name.trim()}>
              {loading ? "Creating…" : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Categories Dialog ── */}
      <Dialog open={showCategories} onOpenChange={setShowCategories}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="py-6 text-center text-sm text-light-grey">No categories yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-light-grey">Name</th>
                    <th className="pb-2 text-right font-medium text-light-grey">Order</th>
                    <th className="pb-2 text-right font-medium text-light-grey">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categories.map((c) => (
                    <tr key={c.docId}>
                      <td className="py-2.5 text-black">{c.name}</td>
                      <td className="py-2.5 text-right text-light-grey">{c.order ?? "—"}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              setActiveCategoryId(c.docId ?? null);
                              setCategoryForm({ name: c.name ?? "", order: c.order != null ? String(c.order) : "" });
                              setCategoryDialog("edit");
                            }}
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
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => { setCategoryForm({ name: "", order: "" }); setCategoryDialog("create"); }}
            >
              + New Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Category Dialog ── */}
      <Dialog
        open={categoryDialog === "create" || categoryDialog === "edit"}
        onOpenChange={(open) => { if (!open) { setCategoryDialog(null); setCategoryErrors({}); } }}
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
                onChange={(e) => { setCategoryForm((f) => ({ ...f, name: e.target.value })); setCategoryErrors({}); }}
              />
              {categoryErrors.name && <p className="mt-1 text-xs text-error">Name is required.</p>}
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
            <Button variant="outline" onClick={() => { setCategoryDialog(null); setCategoryErrors({}); }}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={categoryLoading}>
              {categoryLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Category Confirmation Dialog ── */}
      <Dialog
        open={categoryDialog === "delete"}
        onOpenChange={(open) => { if (!open) setCategoryDialog(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this category? This action cannot be undone.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={categoryLoading}>
              {categoryLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
