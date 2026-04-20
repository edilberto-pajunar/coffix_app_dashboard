"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "../store/useDashboardStore";
import { useStoreStore } from "../../stores/store/useStoreStore";
import { useAuth } from "@/app/lib/AuthContext";
import { Product } from "../interface/product";
import { ProductService } from "../service/ProductService";
import Image from "next/image";
import { Button } from "@/components/ui/button";
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
  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }
  const allSelected = options.length > 0 && options.every((o) => selected.includes(o.value));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs text-light-grey">{label}</label>
        {showSelectAll && options.length > 0 && (
          <div className="flex gap-2">
            <button type="button" onClick={() => onChange(options.map((o) => o.value))} disabled={allSelected} className="text-xs text-primary hover:underline disabled:opacity-40">Select all</button>
            <span className="text-xs text-light-grey">·</span>
            <button type="button" onClick={() => onChange([])} disabled={selected.length === 0} className="text-xs text-light-grey hover:text-black hover:underline disabled:opacity-40">Unselect all</button>
          </div>
        )}
      </div>
      <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-white p-2 space-y-1">
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-light-grey">No options available.</p>
        ) : (
          options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-black">
              <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} className="accent-primary" />
              {opt.label}
            </label>
          ))
        )}
      </div>
      {selected.length > 0 && <p className="mt-1 text-xs text-light-grey">{selected.length} selected</p>}
    </div>
  );
}

export default function ProductDetailPage() {
    const { productId } = useParams<{ productId: string }>();
    const router = useRouter();

    const { currentStaff } = useAuth();
    const isAdmin = currentStaff?.role === "admin";

    const products = useDashboardStore((s) => s.products);
    const modifierGroups = useDashboardStore((s) => s.modifierGroups);
    const getCategoryName = useDashboardStore((s) => s.getCategoryName);
    const stores = useStoreStore((s) => s.stores);

    const [dialog, setDialog] = useState<DialogMode>(null);
    const [productForm, setProductForm] = useState<Partial<Product>>({});
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
        setDialog("edit-product");
    }


    function openAddModifier() {
        setSelectedGroupId("");
        setDialog("add-modifier");
    }

    async function handleUpdateProduct() {
        if (!product?.docId) return;
        setLoading(true);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { docId: _, ...rest } = productForm as Product;
        await ProductService.updateProduct(product.docId, rest);
        setLoading(false);
        setDialog(null);
    }

    async function handleDeleteProduct() {
        if (!product?.docId) return;
        setLoading(true);
        await ProductService.deleteProduct(product.docId);
        setLoading(false);
        router.push("/dashboard/products");
    }

    async function handleAddModifierGroup() {
        if (!selectedGroupId || !product?.docId) return;
        setLoading(true);
        const current = product.modifierGroupIds ?? [];
        if (!current.includes(selectedGroupId)) {
            await ProductService.updateProduct(product.docId, {
                modifierGroupIds: [...current, selectedGroupId],
            });
        }
        setLoading(false);
        setDialog(null);
    }

    function openRemoveModifierGroup(groupDocId: string) {
        setActiveGroupId(groupDocId);
        setDialog("remove-modifier-group");
    }

    async function handleRemoveModifierGroup() {
        if (!activeGroupId || !product?.docId) return;
        setLoading(true);
        await ProductService.updateProduct(product.docId, {
            modifierGroupIds: (product.modifierGroupIds ?? []).filter((id) => id !== activeGroupId),
        });
        setLoading(false);
        setDialog(null);
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
            <div className="flex h-64 items-center justify-center text-light-grey">
                Product not found.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button
                        onClick={() => router.push("/dashboard/products")}
                        className="mb-2 text-xs text-light-grey hover:text-black"
                    >
                        ← Back to Products
                    </button>
                    <h1 className="text-2xl font-semibold text-black">{product.name ?? "—"}</h1>
                    <p className="mt-1 text-sm text-light-grey">{getCategoryName(product.categoryId)}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={openEditProduct}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:border-primary hover:text-primary"
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => setDialog("delete-product")}
                        className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
                    >
                        Delete
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Left column: product info + status controls */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
                        {product.imageUrl ? (
                            <Image
                                src={product.imageUrl}
                                alt={product.name ?? "Product"}
                                width={400}
                                height={240}
                                className="h-48 w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-48 items-center justify-center bg-primary text-4xl font-bold text-white">
                                {(product.name ?? "?")[0].toUpperCase()}
                            </div>
                        )}
                        <div className="divide-y divide-border p-0">
                            {[
                                { label: "Category", value: getCategoryName(product.categoryId) },
                                { label: "Price", value: `$${(product.price ?? 0).toFixed(2)}` },
                                { label: "Cost", value: `$${(product.cost ?? 0).toFixed(2)}` },
                                { label: "Order", value: product.order ?? "—" },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between px-4 py-3">
                                    <span className="text-xs text-light-grey">{label}</span>
                                    <span className="text-sm font-medium text-black">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>


                    {/* ── Status Controls ── */}
                    <div className="rounded-xl border border-border bg-white p-4 shadow-(--shadow) space-y-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-light-grey">Availability</p>

                        {/* Product disable — admin only */}
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-black">Product Availability</p>
                            </div>
                            {isAdmin ? (
                                <Button
                                    size="xs"
                                    variant={isAllDisabled ? "solid-success" : "solid-error"}
                                    onClick={handleToggleAllStores}
                                    disabled={statusLoading}
                                >
                                    {isAllDisabled ? "Click to enable for All Stores" : "Click to disable for All Stores"}
                                </Button>
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
                                        return (
                                            <div key={storeId} className="flex items-center justify-between px-3 py-2.5">
                                                <span className="text-sm text-black">{store?.name ?? storeId}</span>
                                                <Button
                                                    size="xs"
                                                    variant={isDisabled ? "solid-error" : "solid-success"}
                                                    onClick={() => handleToggleStoreDisable(storeId)}
                                                    disabled={statusLoading}
                                                    className="rounded-full"
                                                >
                                                    {isDisabled ? "Click to enable for this Store" : "Click to disable for this Store"}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: modifier groups */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-black">Modifier Groups</h2>
                        <button
                            onClick={openAddModifier}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                        >
                            + Add Modifier Group
                        </button>
                    </div>

                    {productModifierGroups.length === 0 ? (
                        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-light-grey shadow-(--shadow)">
                            No modifier groups linked to this product.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
                            {productModifierGroups.map((group, i) => (
                                <div
                                    key={group.docId}
                                    draggable
                                    onDragStart={() => { dragIndex.current = i; }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleDrop(i)}
                                    className={`flex items-center justify-between px-4 py-3 ${i !== 0 ? "border-t border-border" : ""}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <svg className="h-4 w-4 shrink-0 cursor-grab text-light-grey active:cursor-grabbing" viewBox="0 0 16 16" fill="currentColor">
                                            <circle cx="5.5" cy="3.5" r="1.25" />
                                            <circle cx="10.5" cy="3.5" r="1.25" />
                                            <circle cx="5.5" cy="8" r="1.25" />
                                            <circle cx="10.5" cy="8" r="1.25" />
                                            <circle cx="5.5" cy="12.5" r="1.25" />
                                            <circle cx="10.5" cy="12.5" r="1.25" />
                                        </svg>
                                        <div>
                                            <span className="font-medium text-black">{group.name ?? "—"}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openRemoveModifierGroup(group.docId ?? "")}
                                        className="text-xs text-error hover:opacity-70"
                                    >
                                        Remove
                                    </button>
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
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Edit Product */}
                        {dialog === "edit-product" && (
                            <>
                                <h3 className="mb-4 text-lg font-semibold text-black">Edit Product</h3>
                                <div className="space-y-3">
                                    {(["name", "imageUrl"] as const).map((field) => (
                                        <div key={field}>
                                            <label className="mb-1 block text-xs text-light-grey capitalize">{field}</label>
                                            <input
                                                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                                                value={(productForm[field] as string) ?? ""}
                                                onChange={(e) => setProductForm((f) => ({ ...f, [field]: e.target.value }))}
                                            />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="mb-1 block text-xs text-light-grey capitalize">Price</label>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-light-grey">$</span>
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
                                        <label className="mb-1 block text-xs text-light-grey capitalize">Cost</label>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-light-grey">$</span>
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
                                </div>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]">Cancel</button>
                                    <button onClick={handleUpdateProduct} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
                                        {loading ? "Saving…" : "Save"}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Delete Product */}
                        {dialog === "delete-product" && (
                            <>
                                <h3 className="mb-2 text-lg font-semibold text-black">Delete Product</h3>
                                <p className="text-sm text-light-grey">
                                    Are you sure you want to delete <strong className="text-black">{product.name}</strong>? This cannot be undone.
                                </p>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]">Cancel</button>
                                    <button onClick={handleDeleteProduct} disabled={loading} className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
                                        {loading ? "Deleting…" : "Delete"}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Add Modifier Group */}
                        {dialog === "add-modifier" && (
                            <>
                                <h3 className="mb-4 text-lg font-semibold text-black">Add Modifier Group</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="mb-1 block text-xs text-light-grey">Modifier Group</label>
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
                                    <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]">Cancel</button>
                                    <button onClick={handleAddModifierGroup} disabled={loading || !selectedGroupId} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
                                        {loading ? "Saving…" : "Add"}
                                    </button>
                                </div>
                            </>
                        )}


                        {/* Remove Modifier Group */}
                        {dialog === "remove-modifier-group" && (
                            <>
                                <h3 className="mb-2 text-lg font-semibold text-black">Remove Modifier Group</h3>
                                <p className="text-sm text-light-grey">Remove this modifier group from the product? The group itself will not be deleted.</p>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]">Cancel</button>
                                    <button onClick={handleRemoveModifierGroup} disabled={loading} className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
                                        {loading ? "Removing…" : "Remove"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
