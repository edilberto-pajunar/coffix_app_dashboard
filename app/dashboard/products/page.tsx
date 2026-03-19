"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "./store/useDashboardStore";
import { useStoreStore } from "../stores/store/useStoreStore";
import { Product } from "./interface/product";
import { ProductService } from "./service/ProductService";
import Image from "next/image";

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
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  error?: boolean;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs text-light-grey">{label} *</label>
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
      setForm(emptyForm);
      setShowCreate(false);
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
        ...(categoryForm.order !== "" ? { order: parseInt(categoryForm.order) } : {}),
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
          <button
            onClick={() => setShowCategories(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-soft-grey"
          >
            Manage Categories
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            + New Product
          </button>
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
              <th className="px-5 py-3 text-right font-medium text-light-grey">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-light-grey">
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((product: Product) => (
                <tr key={product.docId} className="transition-colors hover:bg-background">
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
                    ₱{(product.price ?? 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right text-light-grey">
                    ₱{(product.cost ?? 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => router.push(`/dashboard/products/${product.docId}`)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-black transition-colors hover:border-primary hover:text-primary"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Product Dialog */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setShowCreate(false); setErrors({}); }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">New Product</h3>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
              {/* Basic fields */}
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
                  <label className="mb-1.5 block text-xs text-light-grey">Price (₱) *</label>
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
                  <label className="mb-1.5 block text-xs text-light-grey">Cost (₱) *</label>
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

              {/* Category dropdown */}
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

              {/* Modifier Groups multi-select */}
              <MultiSelect
                label="Modifier Groups"
                options={modifierGroups.map((g) => ({ value: g.docId ?? "", label: g.name ?? g.docId ?? "" }))}
                selected={form.modifierGroupIds}
                onChange={(v) => setField("modifierGroupIds", v)}
                error={errors.modifierGroupIds}
              />

              {/* Stores multi-select */}
              <MultiSelect
                label="Available to Stores"
                options={stores.map((s) => ({ value: s.docId, label: s.name ?? s.docId }))}
                selected={form.availableToStores}
                onChange={(v) => setField("availableToStores", v)}
                error={errors.availableToStores}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => { setShowCreate(false); setForm(emptyForm); setErrors({}); }}
                className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !form.name.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Dialog */}
      {showCategories && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowCategories(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">Manage Categories</h3>
              <button
                onClick={() => setShowCategories(false)}
                className="text-light-grey hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
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
                            <button
                              onClick={() => {
                                setActiveCategoryId(c.docId ?? null);
                                setCategoryForm({ name: c.name ?? "", order: c.order != null ? String(c.order) : "" });
                                setCategoryDialog("edit");
                              }}
                              className="rounded px-2 py-1 text-xs border border-border text-black hover:border-primary hover:text-primary"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setActiveCategoryId(c.docId ?? null);
                                setCategoryDialog("delete");
                              }}
                              className="rounded px-2 py-1 text-xs border border-red-200 text-red-500 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-border px-6 py-4">
              <button
                onClick={() => { setCategoryForm({ name: "", order: "" }); setCategoryDialog("create"); }}
                className="w-full rounded-lg border border-dashed border-border py-2 text-sm text-light-grey hover:border-primary hover:text-primary"
              >
                + New Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Category Dialog */}
      {(categoryDialog === "create" || categoryDialog === "edit") && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setCategoryDialog(null); setCategoryErrors({}); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">
                {categoryDialog === "create" ? "New Category" : "Edit Category"}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
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
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => { setCategoryDialog(null); setCategoryErrors({}); }}
                className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={categoryLoading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
              >
                {categoryLoading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Dialog */}
      {categoryDialog === "delete" && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCategoryDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">Delete Category</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-black">
                Are you sure you want to delete this category? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => setCategoryDialog(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCategory}
                disabled={categoryLoading}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
              >
                {categoryLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
