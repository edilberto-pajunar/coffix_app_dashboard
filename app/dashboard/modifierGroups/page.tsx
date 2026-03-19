"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "../products/store/useDashboardStore";
import { ProductService } from "../products/service/ProductService";

type NewGroupForm = {
    name: string;
    selectionType: string;
    required: boolean;
};

const emptyForm: NewGroupForm = {
    name: "",
    selectionType: "",
    required: false,
};

export default function ModifierGroupsPage() {
    const modifierGroups = useDashboardStore((s) => s.modifierGroups);
    const modifiers = useDashboardStore((s) => s.modifiers);

    const router = useRouter();
    const [search, setSearch] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<NewGroupForm>(emptyForm);
    const [errors, setErrors] = useState<Partial<Record<keyof NewGroupForm, boolean>>>({});
    const [loading, setLoading] = useState(false);

    const filtered = modifierGroups.filter((g) =>
        (g.name ?? "").toLowerCase().includes(search.toLowerCase()),
    );

    function setField<K extends keyof NewGroupForm>(key: K, value: NewGroupForm[K]) {
        setForm((f) => ({ ...f, [key]: value }));
        setErrors((e) => ({ ...e, [key]: false }));
    }

    async function handleCreate() {
        const newErrors: Partial<Record<keyof NewGroupForm, boolean>> = {
            name: !form.name.trim(),
            // selectionType: !form.selectionType,
        };

        if (Object.values(newErrors).some(Boolean)) {
            setErrors(newErrors);
            toast.error("Please fill in all required fields.");
            return;
        }

        setErrors({});
        setLoading(true);
        try {
            await ProductService.createModifierGroup({
                name: form.name.trim(),
                // selectionType: form.selectionType,
                required: form.required,
                modifierIds: [],
            });
            toast.success("Modifier group created successfully.");
            setForm(emptyForm);
            setShowCreate(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to create modifier group. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-black">Modifier Groups</h1>
                    <p className="mt-1 text-sm text-light-grey">
                        {modifierGroups.length} group{modifierGroups.length !== 1 ? "s" : ""} total
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
                >
                    + New Group
                </button>
            </div>

            <input
                type="text"
                placeholder="Search modifier groups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary sm:max-w-xs"
            />

            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-background">
                            <th className="px-5 py-3 text-left font-medium text-light-grey">Name</th>
                            {/* <th className="px-5 py-3 text-left font-medium text-light-grey">Selection Type</th> */}
                            <th className="px-5 py-3 text-left font-medium text-light-grey">Required</th>
                            <th className="px-5 py-3 text-left font-medium text-light-grey">Modifiers</th>
                            <th className="px-5 py-3 text-right font-medium text-light-grey">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-5 py-10 text-center text-light-grey">
                                    No modifier groups found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((group) => {
                                const modifierCount = modifiers.filter((m) =>
                                    group.modifierIds?.includes(m.docId ?? ""),
                                ).length;
                                return (
                                    <tr key={group.docId} className="transition-colors hover:bg-background">
                                        <td className="px-5 py-3 font-medium text-black">{group.name ?? "—"}</td>
                                        {/* <td className="px-5 py-3">
                      <span className="rounded-full bg-soft-grey px-2.5 py-1 text-xs font-medium text-black capitalize">
                        {group.selectionType ?? "—"}
                      </span>
                    </td> */}
                                        <td className="px-5 py-3">
                                            {group.required ? (
                                                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-success">Yes</span>
                                            ) : (
                                                <span className="rounded-full bg-soft-grey px-2 py-0.5 text-xs text-light-grey">No</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-light-grey">{modifierCount}</td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => router.push(`/dashboard/modifierGroups/${group.docId}`)}
                                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-black transition-colors hover:border-primary hover:text-primary"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Modifier Group Dialog */}
            {showCreate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={() => { setShowCreate(false); setErrors({}); }}
                >
                    <div
                        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-b border-border px-6 py-4">
                            <h3 className="text-lg font-semibold text-black">New Modifier Group</h3>
                        </div>

                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs text-light-grey">Name *</label>
                                <input
                                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.name ? "border-error" : "border-border"}`}
                                    placeholder="e.g. Size Options"
                                    value={form.name}
                                    onChange={(e) => setField("name", e.target.value)}
                                />
                                {errors.name && <p className="mt-1 text-xs text-error">Name is required.</p>}
                            </div>

                            {/* <div>
                <label className="mb-1.5 block text-xs text-light-grey">Selection Type *</label>
                <select
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.selectionType ? "border-error" : "border-border"}`}
                  value={form.selectionType}
                  onChange={(e) => setField("selectionType", e.target.value)}
                >
                  <option value="">— Select type —</option>
                  <option value="single">Single</option>
                  <option value="multiple">Multiple</option>
                </select>
                {errors.selectionType && <p className="mt-1 text-xs text-error">Selection type is required.</p>}
              </div> */}

                            <label className="flex items-center gap-2 text-sm text-black">
                                <input
                                    type="checkbox"
                                    checked={form.required}
                                    onChange={(e) => setField("required", e.target.checked)}
                                    className="accent-primary"
                                />
                                Required
                            </label>
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
                                {loading ? "Creating…" : "Create Group"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
