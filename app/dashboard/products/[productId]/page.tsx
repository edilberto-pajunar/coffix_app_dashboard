"use client";

import { useId, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "../store/useDashboardStore";
import { useStoreStore } from "../../stores/store/useStoreStore";
import { useAuth } from "@/app/lib/AuthContext";
import { Product, isProductNameTaken } from "../interface/product";
import { ProductService } from "../service/ProductService";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ImageUploadField } from "@/components/components/ImageUploadField";
import { useActivityLog } from "../../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../../logs/constants/logConstants";
type DialogMode = "edit-product" | "delete-product" | "add-modifier" | "remove-modifier-group" | null;

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  showSelectAll,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  showSelectAll?: boolean;
}) {
  const fieldId = useId();
  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }
  const allSelected = options.length > 0 && options.every((o) => selected.includes(o.value));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs text-black">{label}</label>
        {showSelectAll && options.length > 0 && (
          <div className="flex gap-2">
            <Button type="button" variant="link" size="xs" onClick={() => onChange(options.map((o) => o.value))} disabled={allSelected}>Select all</Button>
            <span className="text-xs text-black">·</span>
            <Button type="button" variant="ghost" size="xs" onClick={() => onChange([])} disabled={selected.length === 0}>Unselect all</Button>
          </div>
        )}
      </div>
      <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-white p-2 space-y-1">
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-black">No options available.</p>
        ) : (
          options.map((opt) => (
            <label key={opt.value} htmlFor={`${fieldId}-${opt.value}`} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-black">
              <Checkbox id={`${fieldId}-${opt.value}`} checked={selected.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
              {opt.label}
            </label>
          ))
        )}
      </div>
      {selected.length > 0 && <p className="mt-1 text-xs text-black">{selected.length} selected</p>}
    </div>
  );
}

export default function ProductDetailPage() {
    const { productId } = useParams<{ productId: string }>();
    const router = useRouter();

    const { currentStaff } = useAuth();
    const isAdmin = currentStaff?.role === "admin";

    const { log } = useActivityLog();
    // Availability toggles are reachable by both roles; the rest are admin-only.
    const actor = isAdmin ? "Admin" : "Store manager";

    const products = useDashboardStore((s) => s.products);
    const modifierGroups = useDashboardStore((s) => s.modifierGroups);
    const categories = useDashboardStore((s) => s.categories);
    const getCategoryName = useDashboardStore((s) => s.getCategoryName);
    const stores = useStoreStore((s) => s.stores);

    const [dialog, setDialog] = useState<DialogMode>(null);
    const [productForm, setProductForm] = useState<Partial<Product>>({});
    const [errors, setErrors] = useState<{ name?: boolean }>({});
    const [priceStr, setPriceStr] = useState<string>("0.00");
    const [costStr, setCostStr] = useState<string>("0.00");
    const [selectedGroupId, setSelectedGroupId] = useState<string>("");
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const dragIndex = useRef<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);

    const product = products.find((p) => p.docId === productId);

    const productModifierGroups = (product?.modifierGroupIds ?? [])
        .map((id) => modifierGroups.find((g) => g.docId === id))
        .filter(Boolean) as typeof modifierGroups;


    // ── Status helpers ──────────────────────────────────────────────────────────

    // Temporary disable per store: store_manager can toggle for their assigned stores
    // Admin sees all; store_manager sees only their assigned stores
    const assignedStoreIds = isAdmin
        ? (product?.availableToStores ?? [])
        : (currentStaff?.storeIds ?? []).filter((id) =>
              product?.availableToStores?.includes(id),
          );

    const disabledStores = product?.disabledStores ?? [];

    // All assigned stores are disabled
    const isAllDisabled =
        assignedStoreIds.length > 0 &&
        assignedStoreIds.every((id) => disabledStores.includes(id));

    async function handleToggleAllStores() {
        if (!product?.docId) return;
        setStatusLoading(true);
        try {
            const allStoreIds = product?.availableToStores ?? [];
            const updated = isAllDisabled
                ? disabledStores.filter((id) => !allStoreIds.includes(id))
                : [...new Set([...disabledStores, ...allStoreIds])];
            await ProductService.updateProduct(product.docId, { disabledStores: updated });
            log({
                category: LOG_CATEGORY.PRODUCT,
                severityLevel: LOG_SEVERITY.HIGH,
                action: "Toggle Product Availability",
                notes: `${actor} ${isAllDisabled ? "enabled" : "disabled"} ${product.name ?? ""} for all stores`,
                page: LOG_PAGE.PRODUCTS,
            });
            toast.success(
                isAllDisabled
                    ? "Product enabled for all stores."
                    : "Product disabled for all stores.",
            );
        } catch (err) {
            console.error(err);
            toast.error("Failed to update status.");
        } finally {
            setStatusLoading(false);
        }
    }

    async function handleToggleStoreDisable(storeId: string) {
        if (!product?.docId) return;
        setStatusLoading(true);
        try {
            const isCurrentlyDisabled = disabledStores.includes(storeId);
            const updated = isCurrentlyDisabled
                ? disabledStores.filter((id) => id !== storeId)
                : [...disabledStores, storeId];
            await ProductService.updateProduct(product.docId, { disabledStores: updated });
            const storeName = stores.find((s) => s.docId === storeId)?.name ?? storeId;
            log({
                category: LOG_CATEGORY.PRODUCT,
                severityLevel: LOG_SEVERITY.HIGH,
                action: "Toggle Store Availability",
                notes: `${actor} ${isCurrentlyDisabled ? "enabled" : "disabled"} ${product.name ?? ""} for store ${storeName}`,
                page: LOG_PAGE.PRODUCTS,
            });
            toast.success(
                isCurrentlyDisabled
                    ? "Product re-enabled for this store."
                    : "Product temporarily disabled for this store.",
            );
        } catch (err) {
            console.error(err);
            toast.error("Failed to update status.");
        } finally {
            setStatusLoading(false);
        }
    }

    // ── Other handlers ──────────────────────────────────────────────────────────

    function openEditProduct() {
        const p = product ?? {};
        setProductForm(p);
        setPriceStr(((p.price ?? 0) as number).toFixed(2));
        setCostStr(((p.cost ?? 0) as number).toFixed(2));
        setErrors({});
        setDialog("edit-product");
    }


    function openAddModifier() {
        setSelectedGroupId("");
        setDialog("add-modifier");
    }

    async function handleUpdateProduct() {
        if (!product?.docId) return;

        if (!(productForm.name ?? "").trim()) {
            setErrors({ name: true });
            toast.error("Name is required.");
            return;
        }

        if (isProductNameTaken(useDashboardStore.getState().allProducts, productForm.name ?? "", product.docId)) {
            setErrors({ name: true });
            toast.error(`A product named "${(productForm.name ?? "").trim()}" already exists.`);
            return;
        }

        setErrors({});
        setLoading(true);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { docId: _, ...rest } = productForm as Product;
        try {
            await ProductService.updateProduct(product.docId, rest);
            log({
                category: LOG_CATEGORY.PRODUCT,
                severityLevel: LOG_SEVERITY.HIGH,
                action: "Edit Product",
                notes: `Admin edited ${product.name ?? ""} details`,
                page: LOG_PAGE.PRODUCTS,
            });
            toast.success("Product updated successfully.");
            setDialog(null);
        } catch (err) {
            console.error(err);
            toast.error("Failed to update product. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteProduct() {
        if (!product?.docId) return;
        setLoading(true);
        try {
            await ProductService.deleteProduct(product.docId);
            log({
                category: LOG_CATEGORY.PRODUCT,
                severityLevel: LOG_SEVERITY.HIGH,
                action: "Delete Product",
                notes: `Admin deleted product ${product.name ?? ""}`,
                page: LOG_PAGE.PRODUCTS,
            });
            setDialog(null);
            router.push("/dashboard/products");
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete product. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddModifierGroup() {
        if (!selectedGroupId || !product?.docId) return;
        setLoading(true);
        try {
            const current = product.modifierGroupIds ?? [];
            if (!current.includes(selectedGroupId)) {
                await ProductService.updateProduct(product.docId, {
                    modifierGroupIds: [...current, selectedGroupId],
                });
                const groupName =
                    modifierGroups.find((g) => g.docId === selectedGroupId)?.name ?? selectedGroupId;
                log({
                    category: LOG_CATEGORY.PRODUCT,
                    severityLevel: LOG_SEVERITY.HIGH,
                    action: "Add Modifier Group",
                    notes: `Admin added modifier group ${groupName} on ${product.name ?? ""}`,
                    page: LOG_PAGE.PRODUCTS,
                });
            }
            setDialog(null);
        } catch (err) {
            console.error(err);
            toast.error("Failed to add modifier group. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function openRemoveModifierGroup(groupDocId: string) {
        setActiveGroupId(groupDocId);
        setDialog("remove-modifier-group");
    }

    async function handleRemoveModifierGroup() {
        if (!activeGroupId || !product?.docId) return;
        setLoading(true);
        try {
            await ProductService.updateProduct(product.docId, {
                modifierGroupIds: (product.modifierGroupIds ?? []).filter((id) => id !== activeGroupId),
            });
            const groupName =
                modifierGroups.find((g) => g.docId === activeGroupId)?.name ?? activeGroupId;
            log({
                category: LOG_CATEGORY.PRODUCT,
                severityLevel: LOG_SEVERITY.HIGH,
                action: "Remove Modifier Group",
                notes: `Admin removed modifier group ${groupName} from ${product.name ?? ""}`,
                page: LOG_PAGE.PRODUCTS,
            });
            setDialog(null);
        } catch (err) {
            console.error(err);
            toast.error("Failed to remove modifier group. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDrop(overIndex: number) {
        if (dragIndex.current === null || dragIndex.current === overIndex || !product?.docId) return;
        const ids = [...(product.modifierGroupIds ?? [])];
        const [moved] = ids.splice(dragIndex.current, 1);
        ids.splice(overIndex, 0, moved);
        dragIndex.current = null;
        await ProductService.updateProduct(product.docId, { modifierGroupIds: ids });
    }

    if (!product) {
        return (
            <div className="flex h-64 items-center justify-center text-black">
                Product not found.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <Button
                        variant="outline"
                        onClick={() => router.push("/dashboard/products")}
                        size="sm"
                    >
                        ← Back to Products
                    </Button>
                    <h1 className="text-xl font-semibold text-black sm:text-2xl">{product.name ?? "—"}</h1>
                    <p className="mt-1 text-sm text-black">{getCategoryName(product.categoryId)}</p>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={openEditProduct}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => setDialog("delete-product")}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            </div>

            {/* Product image — square to match 1200×1200 mobile app asset */}
            {product.imageUrl ? (
                <div className="relative h-48 w-48 overflow-hidden rounded-xl">
                    <Image
                        src={product.imageUrl}
                        alt={product.name ?? "Product"}
                        fill
                        sizes="192px"
                        className="object-cover"
                    />
                </div>
            ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-primary text-4xl font-bold text-white">
                    {(product.name ?? "?")[0].toUpperCase()}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Left column: product info + status controls */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
                      
                        <div className="divide-y divide-border p-0">
                            {[
                                { label: "Category", value: getCategoryName(product.categoryId) },
                                { label: "Price", value: `$${(product.price ?? 0).toFixed(2)}` },
                                { label: "Cost", value: `$${(product.cost ?? 0).toFixed(2)}` },
                                { label: "Order", value: product.order ?? "—" },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between px-4 py-3">
                                    <span className="text-xs text-black">{label}</span>
                                    <span className="text-sm font-medium text-black">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>


                    {/* ── Status Controls ── */}
                    <div className="rounded-xl border border-border bg-white p-4 shadow-(--shadow) space-y-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-black">Temporary Availability (Enabled by Midnight)</p>

                        {/* Product disable — admin only */}
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-black">Product Availability</p>
                            </div>
                            {isAdmin ? (
                                <div className="flex shrink-0 items-center gap-2">
                                    <Switch
                                        checked={!isAllDisabled}
                                        onCheckedChange={handleToggleAllStores}
                                        disabled={statusLoading}
                                        aria-label="Toggle availability for all stores"
                                    />
                                </div>
                            ) : (
                                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                                    isAllDisabled
                                        ? "bg-red-50 text-error"
                                        : "bg-green-50 text-success"
                                }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${isAllDisabled ? "bg-error" : "bg-success"}`} />
                                    {isAllDisabled ? "Disabled for All Stores" : "Enabled for All Stores"}
                                </span>
                            )}
                        </div>

                        {/* Per-store temporary disable — store_manager (or admin) */}
                        {assignedStoreIds.length > 0 && (
                            <div className="space-y-2">
                                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                                    {assignedStoreIds.map((storeId) => {
                                        const store = stores.find((s) => s.docId === storeId);
                                        const isDisabled = disabledStores.includes(storeId);
                                        return store ? (
                                            <div key={storeId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                                <span className="min-w-0 break-words text-sm text-black">{store?.name ?? storeId}</span>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <Switch
                                                        checked={!isDisabled}
                                                        onCheckedChange={() => handleToggleStoreDisable(storeId)}
                                                        disabled={statusLoading}
                                                        aria-label={`Toggle availability for ${store?.name ?? storeId}`}
                                                    />
                                                </div>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: modifier groups */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-semibold text-black">Modifier Groups</h2>
                        {isAdmin && (
                            <Button onClick={openAddModifier} size="sm">
                                + Add Modifier Group
                            </Button>
                        )}
                    </div>

                    {productModifierGroups.length === 0 ? (
                        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-black shadow-(--shadow)">
                            No modifier groups linked to this product.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
                            {productModifierGroups.map((group, i) => (
                                <div
                                    key={group.docId}
                                    draggable={isAdmin}
                                    onDragStart={() => { if (isAdmin) dragIndex.current = i; }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => { if (isAdmin) handleDrop(i); }}
                                    className={`flex items-center justify-between gap-3 px-4 py-3 ${i !== 0 ? "border-t border-border" : ""}`}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <svg className="h-4 w-4 shrink-0 cursor-grab text-black active:cursor-grabbing" viewBox="0 0 16 16" fill="currentColor">
                                            <circle cx="5.5" cy="3.5" r="1.25" />
                                            <circle cx="10.5" cy="3.5" r="1.25" />
                                            <circle cx="5.5" cy="8" r="1.25" />
                                            <circle cx="10.5" cy="8" r="1.25" />
                                            <circle cx="5.5" cy="12.5" r="1.25" />
                                            <circle cx="10.5" cy="12.5" r="1.25" />
                                        </svg>
                                        <div className="min-w-0">
                                            <span className="font-medium text-black break-words">{group.name ?? "—"}</span>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <Button
                                            variant="destructive"
                                            size="xs"
                                            onClick={() => openRemoveModifierGroup(group.docId ?? "")}
                                            className="shrink-0"
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Dialogs */}
            {dialog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={() => setDialog(null)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Edit Product */}
                        {dialog === "edit-product" && (
                            <>
                                <h3 className="mb-4 text-lg font-semibold text-black">Edit Product</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="mb-1 block text-xs text-black capitalize">name</label>
                                        <input
                                            className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.name ? "border-error" : "border-border"}`}
                                            value={(productForm.name as string) ?? ""}
                                            onChange={(e) => {
                                                setProductForm((f) => ({ ...f, name: e.target.value }));
                                                setErrors((err) => ({ ...err, name: false }));
                                            }}
                                        />
                                        {errors.name && <p className="mt-1 text-xs text-error">Name is required and must be unique.</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-black capitalize">Category</label>
                                        <select
                                            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                                            value={productForm.categoryId ?? ""}
                                            onChange={(e) => setProductForm((f) => ({ ...f, categoryId: e.target.value }))}
                                        >
                                            <option value="">— Select category —</option>
                                            {categories.map((c) => (
                                                <option key={c.docId} value={c.docId}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <ImageUploadField
                                        value={(productForm.imageUrl as string) ?? ""}
                                        onChange={(url) => setProductForm((f) => ({ ...f, imageUrl: url }))}
                                        disabled={loading}
                                    />
                                    <div>
                                        <label className="mb-1 block text-xs text-black capitalize">Price</label>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-black">$</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className="w-full rounded-lg border border-border pl-7 pr-3 py-2 text-sm text-black outline-none focus:border-primary"
                                                placeholder="0.00"
                                                value={priceStr}
                                                onChange={(e) => setPriceStr(e.target.value)}
                                                onBlur={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    const formatted = isNaN(val) ? "0.00" : val.toFixed(2);
                                                    setPriceStr(formatted);
                                                    setProductForm((f) => ({ ...f, price: parseFloat(formatted) }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-black capitalize">Cost</label>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-black">$</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className="w-full rounded-lg border border-border pl-7 pr-3 py-2 text-sm text-black outline-none focus:border-primary"
                                                placeholder="0.00"
                                                value={costStr}
                                                onChange={(e) => setCostStr(e.target.value)}
                                                onBlur={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    const formatted = isNaN(val) ? "0.00" : val.toFixed(2);
                                                    setCostStr(formatted);
                                                    setProductForm((f) => ({ ...f, cost: parseFloat(formatted) }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <MultiSelect
                                        label="Available to Stores"
                                        options={stores.map((s) => ({ value: s.docId ?? "", label: s.name ?? s.docId ?? "" }))}
                                        selected={productForm.availableToStores ?? []}
                                        onChange={(v) => setProductForm((f) => ({ ...f, availableToStores: v }))}
                                        showSelectAll
                                    />
                                    <MultiSelect
                                        label="Modifier Groups (optional)"
                                        options={modifierGroups.map((g) => ({ value: g.docId ?? "", label: g.name ?? g.docId ?? "" }))}
                                        selected={productForm.modifierGroupIds ?? []}
                                        onChange={(v) => setProductForm((f) => ({ ...f, modifierGroupIds: v }))}
                                    />
                                </div>
                                <div className="mt-5 flex justify-end gap-2">
                                    <Button onClick={() => setDialog(null)} variant="outline">Cancel</Button>
                                    <Button onClick={handleUpdateProduct} disabled={loading} >
                                        {loading ? "Saving…" : "Save"}
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* Delete Product */}
                        {dialog === "delete-product" && (
                            <>
                                <h3 className="mb-2 text-lg font-semibold text-black">Delete Product</h3>
                                <p className="text-sm text-black">
                                    Are you sure you want to delete <strong className="text-black">{product.name}</strong>? This cannot be undone.
                                </p>
                                <div className="mt-5 flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                    <Button variant="solid-error" onClick={handleDeleteProduct} disabled={loading}>
                                        {loading ? "Deleting…" : "Delete"}
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* Add Modifier Group */}
                        {dialog === "add-modifier" && (
                            <>
                                <h3 className="mb-4 text-lg font-semibold text-black">Add Modifier Group</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="mb-1 block text-xs text-black">Modifier Group</label>
                                        <select
                                            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                                            value={selectedGroupId}
                                            onChange={(e) => setSelectedGroupId(e.target.value)}
                                        >
                                            <option value="">— Select a modifier group —</option>
                                            {modifierGroups
                                                .filter((g) => !product.modifierGroupIds?.includes(g.docId ?? ""))
                                                .map((g) => (
                                                    <option key={g.docId} value={g.docId}>{g.name}</option>
                                                ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-5 flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                    <Button onClick={handleAddModifierGroup} disabled={loading || !selectedGroupId}>
                                        {loading ? "Saving…" : "Add"}
                                    </Button>
                                </div>
                            </>
                        )}


                        {/* Remove Modifier Group */}
                        {dialog === "remove-modifier-group" && (
                            <>
                                <h3 className="mb-2 text-lg font-semibold text-black">Remove Modifier Group</h3>
                                <p className="text-sm text-black">Remove this modifier group from the product? The group itself will not be deleted.</p>
                                <div className="mt-5 flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                    <Button variant="solid-error" onClick={handleRemoveModifierGroup} disabled={loading}>
                                        {loading ? "Removing…" : "Remove"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
