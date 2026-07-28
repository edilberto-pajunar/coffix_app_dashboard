"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "../products/store/useDashboardStore";
import { ProductService } from "../products/service/ProductService";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { escapeCSV, downloadCSV } from "@/app/utils/csv";
import { ModifierGroupsFilterBar } from "./components/ModifierGroupsFilterBar";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";

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
    const products = useDashboardStore((s) => s.products);
    const { log } = useActivityLog();

    const router = useRouter();
    const [search, setSearch] = useState("");
    const [requiredFilter, setRequiredFilter] = useState<"All" | "Required" | "Optional">("All");

    const anyFilterActive = useMemo(() => search.trim() !== "" || requiredFilter !== "All", [search, requiredFilter]);

    function clearAllFilters() {
      setSearch("");
      setRequiredFilter("All");
    }
    type GroupSortKey = "name" | "count";
    type SortDir = "asc" | "desc";
    const [sortKey, setSortKey] = useState<GroupSortKey>("name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    function toggleSort(key: GroupSortKey) {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir("asc"); }
    }

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        let result = modifierGroups.filter((g) => {
            if (requiredFilter === "Required" && !g.required) return false;
            if (requiredFilter === "Optional" && g.required) return false;
            if (q && !(g.name ?? "").toLowerCase().includes(q)) return false;
            return true;
        });
        result = [...result].sort((a, b) => {
            let cmp = 0;
            if (sortKey === "name") {
                cmp = (a.name ?? "").localeCompare(b.name ?? "");
            } else {
                const countA = modifiers.filter((m) => a.modifierIds?.includes(m.docId ?? "")).length;
                const countB = modifiers.filter((m) => b.modifierIds?.includes(m.docId ?? "")).length;
                cmp = countA - countB;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });
        return result;
    }, [modifierGroups, modifiers, search, requiredFilter, sortKey, sortDir]);

    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<NewGroupForm>(emptyForm);
    const [errors, setErrors] = useState<Partial<Record<keyof NewGroupForm, boolean>>>({});
    const [loading, setLoading] = useState(false);

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const deleteTargetGroup = modifierGroups.find((g) => g.docId === deleteTargetId);
    const productsUsingGroup = useMemo(
        () => products.filter((p) => p.modifierGroupIds?.includes(deleteTargetId ?? "")),
        [products, deleteTargetId],
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
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            log({
                category: LOG_CATEGORY.MODIFIER_GROUPS,
                severityLevel: LOG_SEVERITY.HIGH,
                action: "Create Modifier Group",
                notes: `Admin created a modifier group ${form.name.trim()}`,
                page: LOG_PAGE.MODIFIER_GROUPS,
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

    async function handleDelete() {
        if (!deleteTargetId) return;
        setDeleteLoading(true);
        // Captured before the cascade removes the group and its modifiers.
        const groupName = deleteTargetGroup?.name ?? deleteTargetId;
        const modifierCount = (deleteTargetGroup?.modifierIds ?? []).length;
        try {
            await ProductService.deleteModifierGroupCascade(
                deleteTargetId,
                deleteTargetGroup?.modifierIds ?? [],
                productsUsingGroup.map((p) => p.docId).filter((id): id is string => !!id),
            );
            log({
                category: LOG_CATEGORY.MODIFIER_GROUPS,
                severityLevel: LOG_SEVERITY.HIGH,
                action: "Delete Modifier Group",
                notes: `Admin deleted modifier group ${groupName} and its ${modifierCount} modifier${modifierCount !== 1 ? "s" : ""}`,
                page: LOG_PAGE.MODIFIER_GROUPS,
            });
            toast.success("Modifier group and its modifiers deleted.");
            setDeleteTargetId(null);
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete modifier group.");
        } finally {
            setDeleteLoading(false);
        }
    }

    function exportToCSV() {
        downloadCSV("modifier-groups", ["docId", "name", "required", "modifierCount"], modifierGroups.map((g) => [
            escapeCSV(g.docId ?? ""),
            escapeCSV(g.name ?? ""),
            g.required ?? false,
            modifiers.filter((m) => g.modifierIds?.includes(m.docId ?? "")).length,
        ]));
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
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportToCSV}>Export CSV</Button>
                    <Button onClick={() => setShowCreate(true)}>
                        + New Group
                    </Button>
                </div>
            </div>

            <ModifierGroupsFilterBar
                search={search} setSearch={setSearch}
                requiredFilter={requiredFilter} setRequiredFilter={setRequiredFilter}
                anyFilterActive={anyFilterActive}
                clearAllFilters={clearAllFilters}
            />

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
                            {/* <th className="px-5 py-3 text-left font-medium text-light-grey">Selection Type</th> */}
                            <th className="px-5 py-3 text-left font-medium text-light-grey">Required</th>
                            <th
                                onClick={() => toggleSort("count")}
                                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
                            >
                                Modifiers {sortKey === "count" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
                            </th>
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
                                    <tr
                                        key={group.docId}
                                        onClick={() => router.push(`/dashboard/modifierGroups/${group.docId}`)}
                                        className="cursor-pointer transition-colors hover:bg-background"
                                    >
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
                                                <span className="rounded-full px-2 py-0.5 text-xs ">No</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-light-grey">{modifierCount}</td>
                                        <td className="px-5 py-3 text-right">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); setDeleteTargetId(group.docId ?? null); }}
                                            >
                                                Delete
                                            </Button>
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

                            <label htmlFor="modifier-group-required" className="flex cursor-pointer items-center gap-2 text-sm text-black">
                                <Checkbox
                                    id="modifier-group-required"
                                    checked={form.required}
                                    onCheckedChange={(c) => setField("required", c === true)}
                                />
                                Required
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                            <Button variant="outline" onClick={() => { setShowCreate(false); setForm(emptyForm); setErrors({}); }}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={loading || !form.name.trim()}>
                                {loading ? "Creating…" : "Create Group"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modifier Group Confirmation Dialog */}
            {deleteTargetId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={() => setDeleteTargetId(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-b border-border px-6 py-4">
                            <h3 className="text-lg font-semibold text-black">Delete Modifier Group</h3>
                        </div>
                        <div className="px-6 py-4 space-y-3">
                            <p className="text-sm text-light-grey">
                                Are you sure you want to delete{" "}
                                <strong className="text-black">{deleteTargetGroup?.name ?? "this modifier group"}</strong>?
                                Its modifiers will be deleted too. This action cannot be undone.
                            </p>
                            {productsUsingGroup.length > 0 && (
                                <div className="rounded-lg border border-error/30 bg-error/5 px-3 py-2.5">
                                    <p className="text-xs font-medium text-error">
                                        ⚠ Used by {productsUsingGroup.length} product
                                        {productsUsingGroup.length !== 1 ? "s" : ""}
                                    </p>
                                    <p className="mt-1 text-xs text-light-grey">
                                        This group will be removed from{" "}
                                        {productsUsingGroup.slice(0, 5).map((p) => p.name ?? "Unnamed").join(", ")}
                                        {productsUsingGroup.length > 5 ? `, +${productsUsingGroup.length - 5} more` : ""}.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
                                Cancel
                            </Button>
                            <Button variant="solid-error" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading ? "Deleting…" : "Delete"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
