"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "../../products/store/useDashboardStore";
import { Modifier } from "../../products/interface/modifier";
import { ProductService } from "../../products/service/ProductService";
import { formatCurrencyInput } from "@/app/utils/formatting";

type DialogMode = "edit-group" | "delete-group" | "add-modifier" | "edit-modifier" | "delete-modifier" | null;

type ModifierForm = {
  label: string;
  priceDelta: string;
  cost: string;
  isDefault: boolean;
};

const emptyModifierForm: ModifierForm = { label: "", priceDelta: "0.00", cost: "0.00", isDefault: false };

export default function ModifierGroupDetailPage() {
  const { modifierGroupId } = useParams<{ modifierGroupId: string }>();
  const router = useRouter();

  const modifierGroups = useDashboardStore((s) => s.modifierGroups);
  const modifiers = useDashboardStore((s) => s.modifiers);

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [groupForm, setGroupForm] = useState({ name: "", required: false });
  const [groupErrors, setGroupErrors] = useState<{ name?: boolean }>({});
  const [modifierForm, setModifierForm] = useState<ModifierForm>(emptyModifierForm);
  const [activeModifierId, setActiveModifierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderedModifiers, setOrderedModifiers] = useState<Modifier[]>([]);
  const dragIndex = useRef<number | null>(null);

  const group = modifierGroups.find((g) => g.docId === modifierGroupId);

  useEffect(() => {
    if (!group) return;
    const sorted = (group.modifierIds ?? [])
      .map((id) => modifiers.find((m) => m.docId === id))
      .filter(Boolean) as Modifier[];
    setOrderedModifiers(sorted);
  }, [group?.modifierIds, modifiers]);

  async function handleDrop(dropIndex: number) {
    if (dragIndex.current === null || dragIndex.current === dropIndex) return;
    const reordered = [...orderedModifiers];
    const [moved] = reordered.splice(dragIndex.current, 1);
    reordered.splice(dropIndex, 0, moved);
    dragIndex.current = null;
    setOrderedModifiers(reordered);
    await ProductService.updateModifierGroup(group!.docId!, {
      modifierIds: reordered.map((m) => m.docId!),
    });
  }

  function openEditGroup() {
    setGroupForm({
      name: group?.name ?? "",
      required: group?.required ?? false,
    });
    setGroupErrors({});
    setDialog("edit-group");
  }

  function openEditModifier(m: Modifier) {
    setActiveModifierId(m.docId ?? null);
    setModifierForm({
      label: m.label ?? "",
      priceDelta: formatCurrencyInput(String(m.priceDelta ?? 0)),
      cost: formatCurrencyInput(String(m.cost ?? 0)),
      isDefault: m.isDefault ?? false,
    });
    setDialog("edit-modifier");
  }

  function openDeleteModifier(m: Modifier) {
    setActiveModifierId(m.docId ?? null);
    setDialog("delete-modifier");
  }

  function openAddModifier() {
    setModifierForm(emptyModifierForm);
    setDialog("add-modifier");
  }

  async function handleUpdateGroup() {
    const errors = {
      name: !groupForm.name.trim(),
    };
    if (Object.values(errors).some(Boolean)) {
      setGroupErrors(errors);
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!group?.docId) return;
    setLoading(true);
    try {
      await ProductService.updateModifierGroup(group.docId, {
        name: groupForm.name.trim(),
        required: groupForm.required,
      });
      toast.success("Modifier group updated.");
      setDialog(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update modifier group.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteGroup() {
    if (!group?.docId) return;
    setLoading(true);
    try {
      await ProductService.deleteModifierGroup(group.docId);
      toast.success("Modifier group deleted.");
      router.push("/dashboard/modifierGroups");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete modifier group.");
      setLoading(false);
    }
  }

  async function handleSaveModifier() {
    if (!group?.docId) return;
    setLoading(true);
    try {
      if (dialog === "add-modifier") {
        if (modifierForm.isDefault) {
          await Promise.all(
            orderedModifiers.map((m) =>
              ProductService.updateModifier(m.docId!, { isDefault: false }),
            ),
          );
        }
        const ref = await ProductService.createModifier({
          label: modifierForm.label,
          priceDelta: parseFloat(modifierForm.priceDelta) || 0,
          cost: parseFloat(modifierForm.cost) || 0,
          isDefault: modifierForm.isDefault,
          groupId: group.docId,
        });
        await ProductService.addModifierToGroup(group.docId, ref.id);
        toast.success("Modifier added.");
      } else if (activeModifierId) {
        if (modifierForm.isDefault) {
          await Promise.all(
            orderedModifiers
              .filter((m) => m.docId !== activeModifierId)
              .map((m) =>
                ProductService.updateModifier(m.docId!, { isDefault: false }),
              ),
          );
        }
        await ProductService.updateModifier(activeModifierId, {
          label: modifierForm.label,
          priceDelta: parseFloat(modifierForm.priceDelta) || 0,
          cost: parseFloat(modifierForm.cost) || 0,
          isDefault: modifierForm.isDefault,
        });
        toast.success("Modifier updated.");
      }
      setDialog(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save modifier.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteModifier() {
    if (!activeModifierId || !group?.docId) return;
    setLoading(true);
    try {
      await ProductService.deleteModifier(activeModifierId);
      await ProductService.removeModifierFromGroup(group.docId, activeModifierId);
      toast.success("Modifier deleted.");
      setDialog(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete modifier.");
    } finally {
      setLoading(false);
    }
  }

  if (!group) {
    return (
      <div className="flex h-64 items-center justify-center text-light-grey">
        Modifier group not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard/modifierGroups")}
            className="mb-2 text-xs text-light-grey hover:text-black"
          >
            ← Back to Modifier Groups
          </button>
          <h1 className="text-2xl font-semibold text-black">{group.name ?? "—"}</h1>
          <p className="mt-1 text-sm text-light-grey">{group.required ? "Required" : "Optional"}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openEditGroup}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:border-primary hover:text-primary"
          >
            Edit
          </button>
          <button
            onClick={() => setDialog("delete-group")}
            className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Delete
          </button>
        </div>
      </div>


      {/* Modifiers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-black">Modifiers</h2>
          <button
            onClick={openAddModifier}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
          >
            + Add Modifier
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="w-8 px-3 py-3" />
                <th className="px-5 py-3 text-left font-medium text-light-grey">Label</th>
                <th className="px-5 py-3 text-left font-medium text-light-grey">Price</th>
                <th className="px-5 py-3 text-left font-medium text-light-grey">Cost</th>
                <th className="px-5 py-3 text-left font-medium text-light-grey">Default</th>
                <th className="px-5 py-3 text-right font-medium text-light-grey">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orderedModifiers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-light-grey">
                    No modifiers yet.
                  </td>
                </tr>
              ) : (
                orderedModifiers.map((m, i) => (
                  <tr
                    key={m.docId}
                    draggable
                    onDragStart={() => { dragIndex.current = i; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(i)}
                    className="transition-colors hover:bg-background"
                  >
                    <td className="px-3 py-3">
                      <svg className="h-4 w-4 shrink-0 cursor-grab text-light-grey active:cursor-grabbing" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5.5" cy="3.5" r="1.25" />
                        <circle cx="10.5" cy="3.5" r="1.25" />
                        <circle cx="5.5" cy="8" r="1.25" />
                        <circle cx="10.5" cy="8" r="1.25" />
                        <circle cx="5.5" cy="12.5" r="1.25" />
                        <circle cx="10.5" cy="12.5" r="1.25" />
                      </svg>
                    </td>
                    <td className="px-5 py-3 font-medium text-black">{m.label ?? "—"}</td>
                    <td className="px-5 py-3 text-primary">
                      ${Math.abs(m.priceDelta ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-black">
                      ${(m.cost ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      {m.isDefault ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-success">Yes</span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-xs text-light-grey">No</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
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
            {/* Edit Group */}
            {dialog === "edit-group" && (
              <>
                <h3 className="mb-4 text-lg font-semibold text-black">Edit Modifier Group</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-light-grey">Name *</label>
                    <input
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${groupErrors.name ? "border-error" : "border-border"}`}
                      value={groupForm.name}
                      onChange={(e) => { setGroupForm((f) => ({ ...f, name: e.target.value })); setGroupErrors((e) => ({ ...e, name: false })); }}
                    />
                    {groupErrors.name && <p className="mt-1 text-xs text-error">Name is required.</p>}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-black">
                    <input
                      type="checkbox"
                      checked={groupForm.required}
                      onChange={(e) => setGroupForm((f) => ({ ...f, required: e.target.checked }))}
                      className="accent-primary"
                    />
                    Required
                  </label>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black ">Cancel</button>
                  <button onClick={handleUpdateGroup} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
                    {loading ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            )}

            {/* Delete Group */}
            {dialog === "delete-group" && (
              <>
                <h3 className="mb-2 text-lg font-semibold text-black">Delete Modifier Group</h3>
                <p className="text-sm text-light-grey">
                  Are you sure you want to delete <strong className="text-black">{group.name}</strong>? This cannot be undone.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey">Cancel</button>
                  <button onClick={handleDeleteGroup} disabled={loading} className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50">
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
                      value={modifierForm.label}
                      onChange={(e) => setModifierForm((f) => ({ ...f, label: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-light-grey">Price</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-light-grey">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full rounded-lg border border-border pl-7 pr-3 py-2 text-sm text-black outline-none focus:border-primary"
                        value={modifierForm.priceDelta}
                        onChange={(e) => setModifierForm((f) => ({ ...f, priceDelta: e.target.value }))}
                        onBlur={(e) => setModifierForm((f) => ({ ...f, priceDelta: formatCurrencyInput(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-light-grey">Cost</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-light-grey">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full rounded-lg border border-border pl-7 pr-3 py-2 text-sm text-black outline-none focus:border-primary"
                        value={modifierForm.cost}
                        onChange={(e) => setModifierForm((f) => ({ ...f, cost: e.target.value }))}
                        onBlur={(e) => setModifierForm((f) => ({ ...f, cost: formatCurrencyInput(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-black">
                    <input
                      type="checkbox"
                      checked={modifierForm.isDefault}
                      onChange={(e) => setModifierForm((f) => ({ ...f, isDefault: e.target.checked }))}
                      className="accent-primary"
                    />
                    Default modifier
                  </label>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-grey">Cancel</button>
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
