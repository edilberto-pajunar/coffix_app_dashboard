"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "../store/useDashboardStore";
import { useStoreStore } from "../../stores/store/useStoreStore";
import { useStaffStore } from "../../staffs/store/useStaffStore";
import { useAuth } from "@/app/lib/AuthContext";
import { Product } from "../interface/product";
import { Modifier } from "../interface/modifier";
import { ProductService } from "../service/ProductService";
import Image from "next/image";

type DialogMode = "edit-product" | "delete-product" | "add-modifier" | "edit-modifier" | "delete-modifier" | null;

const emptyModifier: Omit<Modifier, "docId"> = { label: "", priceDelta: 0, isDefault: false, groupId: "" };

export default function ProductDetailPage() {
    const { productId } = useParams<{ productId: string }>();
    const router = useRouter();

    const { user } = useAuth();
    const staffs = useStaffStore((s) => s.staffs);
    const currentStaff = staffs.find((s) => s.docId === user?.uid);
    const isAdmin = currentStaff?.role === "admin";

    const products = useDashboardStore((s) => s.products);
    const modifiers = useDashboardStore((s) => s.modifiers);
    const modifierGroups = useDashboardStore((s) => s.modifierGroups);
    const getCategoryName = useDashboardStore((s) => s.getCategoryName);
    const stores = useStoreStore((s) => s.stores);

    const [dialog, setDialog] = useState<DialogMode>(null);
    const [productForm, setProductForm] = useState<Partial<Product>>({});
    const [modifierForm, setModifierForm] = useState<Omit<Modifier, "docId">>(emptyModifier);
    const [activeModifierId, setActiveModifierId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);

    const product = products.find((p) => p.docId === productId);

    const productModifierGroups = modifierGroups.filter((g) =>
        product?.modifierGroupIds?.includes(g.docId ?? ""),
    );

    const getModifiersForGroup = (group: typeof modifierGroups[0]) =>
        modifiers.filter((m) => group.modifierIds?.includes(m.docId ?? ""));

    // ── Status helpers ──────────────────────────────────────────────────────────

    // Permanent disable: admin only, applies globally
    const isPermanentlyDisabled = product?.disabledPermanently ?? false;

    // Temporary disable per store: store_manager can toggle for their assigned stores
    // Admin sees all; store_manager sees only their assigned stores
    const assignedStoreIds = isAdmin
        ? (product?.availableToStores ?? [])
        : (currentStaff?.storeIds ?? []).filter((id) =>
              product?.availableToStores?.includes(id),
          );

    const disabledStores = product?.disabledStores ?? [];

    async function handleTogglePermanent() {
        if (!product?.docId) return;
        setStatusLoading(true);
        try {
            await ProductService.updateProduct(product.docId, {
                disabledPermanently: !isPermanentlyDisabled,
            });
            toast.success(
                isPermanentlyDisabled
                    ? "Product re-enabled permanently."
                    : "Product permanently disabled.",
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
        setProductForm(product ?? {});
        setDialog("edit-product");
    }

    function openEditModifier(m: Modifier) {
        setActiveModifierId(m.docId ?? null);
        setModifierForm({ label: m.label ?? "", priceDelta: m.priceDelta ?? 0, isDefault: m.isDefault ?? false, groupId: m.groupId ?? "" });
        setDialog("edit-modifier");
    }

    function openDeleteModifier(m: Modifier) {
        setActiveModifierId(m.docId ?? null);
        setDialog("delete-modifier");
    }

    function openAddModifier() {
        setModifierForm(emptyModifier);
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

    async function handleSaveModifier() {
        setLoading(true);
        if (dialog === "add-modifier") {
            await ProductService.createModifier(modifierForm);
        } else if (activeModifierId) {
            await ProductService.updateModifier(activeModifierId, modifierForm);
        }
        setLoading(false);
        setDialog(null);
    }

    async function handleDeleteModifier() {
        if (!activeModifierId) return;
        setLoading(true);
        await ProductService.deleteModifier(activeModifierId);
        setLoading(false);
        setDialog(null);
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
                            <div className="flex h-48 items-center justify-center bg-soft-grey text-4xl font-bold text-light-grey">
                                {(product.name ?? "?")[0].toUpperCase()}
                            </div>
                        )}
                        <div className="divide-y divide-border p-0">
                            {[
                                { label: "Category", value: getCategoryName(product.categoryId) },
                                { label: "Price", value: `₱${(product.price ?? 0).toFixed(2)}` },
                                { label: "Cost", value: `₱${(product.cost ?? 0).toFixed(2)}` },
                                { label: "Order", value: product.order ?? "—" },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between px-4 py-3">
                                    <span className="text-xs text-light-grey">{label}</span>
                                    <span className="text-sm font-medium text-black">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {product.availableToStores && product.availableToStores.length > 0 && (
                        <div className="rounded-xl border border-border bg-white p-4 shadow-(--shadow)">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-light-grey">Available to Stores</p>
                            <div className="flex flex-wrap gap-1.5">
                                {product.availableToStores.map((storeId) => {
                                    const store = stores.find((s) => s.docId === storeId);
                                    return (
                                        <span key={storeId} className="rounded-full bg-soft-grey px-2.5 py-1 text-xs text-black">
                                            {store?.name ?? storeId}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Status Controls ── */}
                    <div className="rounded-xl border border-border bg-white p-4 shadow-(--shadow) space-y-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-light-grey">Availability</p>

                        {/* Permanent disable — admin only */}
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-black">Permanently Disabled</p>
                                <p className="mt-0.5 text-xs text-light-grey">
                                    Removes this product from all stores. Admin only.
                                </p>
                            </div>
                            {isAdmin ? (
                                <button
                                    onClick={handleTogglePermanent}
                                    disabled={statusLoading}
                                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${
                                        isPermanentlyDisabled
                                            ? "bg-success text-white"
                                            : "bg-error text-white"
                                    }`}
                                >
                                    {isPermanentlyDisabled ? "Re-enable" : "Disable"}
                                </button>
                            ) : (
                                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                                    isPermanentlyDisabled
                                        ? "bg-red-50 text-error"
                                        : "bg-green-50 text-success"
                                }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${isPermanentlyDisabled ? "bg-error" : "bg-success"}`} />
                                    {isPermanentlyDisabled ? "Disabled" : "Active"}
                                </span>
                            )}
                        </div>

                        {/* Per-store temporary disable — store_manager (or admin) */}
                        {assignedStoreIds.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs text-light-grey">
                                    Temporarily disable per store (e.g. out of stock):
                                </p>
                                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                                    {assignedStoreIds.map((storeId) => {
                                        const store = stores.find((s) => s.docId === storeId);
                                        const isDisabled = disabledStores.includes(storeId);
                                        return (
                                            <div key={storeId} className="flex items-center justify-between px-3 py-2.5">
                                                <span className="text-sm text-black">{store?.name ?? storeId}</span>
                                                <button
                                                    onClick={() => handleToggleStoreDisable(storeId)}
                                                    disabled={statusLoading || isPermanentlyDisabled}
                                                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ${
                                                        isDisabled
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-green-50 text-success"
                                                    }`}
                                                >
                                                    {isDisabled ? "Disabled — tap to re-enable" : "Enabled — tap to disable"}
                                                </button>
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
                            + Add Modifier
                        </button>
                    </div>

                    {productModifierGroups.length === 0 ? (
                        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-light-grey shadow-(--shadow)">
                            No modifier groups linked to this product.
                        </div>
                    ) : (
                        productModifierGroups.map((group) => {
                            const groupModifiers = getModifiersForGroup(group);
                            return (
                                <div key={group.docId} className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
                                    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
                                        <div>
                                            <span className="font-medium text-black">{group.name ?? "—"}</span>
                                            <span className="ml-2 text-xs text-light-grey">
                                                {group.required ? "Required" : "Optional"}
                                            </span>
                                        </div>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="px-4 py-2 text-left text-xs font-medium text-light-grey">Label</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-light-grey">Price Delta</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-light-grey">Default</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-light-grey">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {groupModifiers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-6 text-center text-light-grey">No modifiers.</td>
                                                </tr>
                                            ) : (
                                                groupModifiers.map((m) => (
                                                    <tr key={m.docId} className="transition-colors hover:bg-background">
                                                        <td className="px-4 py-2.5 font-medium text-black">{m.label ?? "—"}</td>
                                                        <td className="px-4 py-2.5 text-primary">
                                                            {(m.priceDelta ?? 0) >= 0 ? "+" : ""}₱{(m.priceDelta ?? 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            {m.isDefault ? (
                                                                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-success">Yes</span>
                                                            ) : (
                                                                <span className="rounded-full bg-soft-grey px-2 py-0.5 text-xs text-light-grey">No</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <div className="inline-flex gap-2">
                                                                <button
                                                                    onClick={() => openEditModifier(m)}
                                                                    className="text-xs text-black hover:text-primary"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => openDeleteModifier(m)}
                                                                    className="text-xs text-error hover:opacity-70"
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
                            );
                        })
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
                                    {(["price", "cost", "order"] as const).map((field) => (
                                        <div key={field}>
                                            <label className="mb-1 block text-xs text-light-grey capitalize">{field}</label>
                                            <input
                                                type="number"
                                                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                                                value={(productForm[field] as number) ?? ""}
                                                onChange={(e) => setProductForm((f) => ({ ...f, [field]: parseFloat(e.target.value) }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey">Cancel</button>
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
                                    <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey">Cancel</button>
                                    <button onClick={handleDeleteProduct} disabled={loading} className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
                                        {loading ? "Deleting…" : "Delete"}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Add / Edit Modifier */}
                        {(dialog === "add-modifier" || dialog === "edit-modifier") && (
                            <>
                                <h3 className="mb-4 text-lg font-semibold text-black">
                                    {dialog === "add-modifier" ? "Add Modifier" : "Edit Modifier"}
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="mb-1 block text-xs text-light-grey">Label</label>
                                        <input
                                            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                                            value={modifierForm.label ?? ""}
                                            onChange={(e) => setModifierForm((f) => ({ ...f, label: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-light-grey">Price Delta (₱)</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                                            value={modifierForm.priceDelta ?? 0}
                                            onChange={(e) => setModifierForm((f) => ({ ...f, priceDelta: parseFloat(e.target.value) }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-light-grey">Group ID</label>
                                        <select
                                            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                                            value={modifierForm.groupId ?? ""}
                                            onChange={(e) => setModifierForm((f) => ({ ...f, groupId: e.target.value }))}
                                        >
                                            <option value="">— Select group —</option>
                                            {modifierGroups.map((g) => (
                                                <option key={g.docId} value={g.docId}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm text-black">
                                        <input
                                            type="checkbox"
                                            checked={modifierForm.isDefault ?? false}
                                            onChange={(e) => setModifierForm((f) => ({ ...f, isDefault: e.target.checked }))}
                                            className="accent-primary"
                                        />
                                        Default modifier
                                    </label>
                                </div>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey">Cancel</button>
                                    <button onClick={handleSaveModifier} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
                                        {loading ? "Saving…" : "Save"}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Delete Modifier */}
                        {dialog === "delete-modifier" && (
                            <>
                                <h3 className="mb-2 text-lg font-semibold text-black">Delete Modifier</h3>
                                <p className="text-sm text-light-grey">Are you sure you want to delete this modifier? This cannot be undone.</p>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey">Cancel</button>
                                    <button onClick={handleDeleteModifier} disabled={loading} className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
                                        {loading ? "Deleting…" : "Delete"}
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
