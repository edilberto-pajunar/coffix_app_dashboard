"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "../../products/store/useDashboardStore";
import { Modifier } from "../../products/interface/modifier";
import { isModifierGroupNameTaken } from "../../products/interface/modifierGroup";
import { ProductService } from "../../products/service/ProductService";
import { formatCurrencyInput } from "@/app/utils/formatting";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useActivityLog } from "../../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../../logs/constants/logConstants";

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
  const products = useDashboardStore((s) => s.products);
  const { log } = useActivityLog();

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [groupForm, setGroupForm] = useState({ name: "" });
  const [groupErrors, setGroupErrors] = useState<{ name?: boolean }>({});
  const [modifierForm, setModifierForm] = useState<ModifierForm>(emptyModifierForm);
  const [activeModifierId, setActiveModifierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderedModifiers, setOrderedModifiers] = useState<Modifier[]>([]);
  const dragIndex = useRef<number | null>(null);

  const group = modifierGroups.find((g) => g.docId === modifierGroupId);
  const productsUsingGroup = products.filter((p) =>
    p.modifierGroupIds?.includes(modifierGroupId ?? ""),
  );

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

    if (isModifierGroupNameTaken(modifierGroups, groupForm.name, group.docId)) {
      setGroupErrors({ name: true });
      toast.error(`A modifier group named "${groupForm.name.trim()}" already exists.`);
      return;
    }

    setLoading(true);
    try {
      await ProductService.updateModifierGroup(group.docId, {
        name: groupForm.name.trim(),
      });
      log({
        category: LOG_CATEGORY.MODIFIER_GROUPS,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Edit Modifier Group",
        notes: `Admin edited modifier group ${groupForm.name.trim()}`,
        page: LOG_PAGE.MODIFIER_GROUPS,
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
    // Captured before the cascade removes the group and its modifiers.
    const groupName = group.name ?? group.docId;
    const modifierCount = (group.modifierIds ?? []).length;
    try {
      await ProductService.deleteModifierGroupCascade(
        group.docId,
        group.modifierIds ?? [],
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
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await ProductService.addModifierToGroup(group.docId, ref.id);
        log({
          category: LOG_CATEGORY.MODIFIER_GROUPS,
          severityLevel: LOG_SEVERITY.HIGH,
          action: "Add Modifier",
          notes: `Admin added modifier ${modifierForm.label} within group ${group.name ?? group.docId}`,
          page: LOG_PAGE.MODIFIER_GROUPS,
        });
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
        log({
          category: LOG_CATEGORY.MODIFIER_GROUPS,
          severityLevel: LOG_SEVERITY.HIGH,
          action: "Edit Modifier",
          notes: `Admin edited modifier ${modifierForm.label} within group ${group.name ?? group.docId}`,
          page: LOG_PAGE.MODIFIER_GROUPS,
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
    // Resolved before the delete — the modifier leaves the store once it's gone.
    const modifierLabel =
      orderedModifiers.find((m) => m.docId === activeModifierId)?.label ?? activeModifierId;
    try {
      await ProductService.deleteModifier(activeModifierId);
      await ProductService.removeModifierFromGroup(group.docId, activeModifierId);
      log({
        category: LOG_CATEGORY.MODIFIER_GROUPS,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Delete Modifier",
        notes: `Admin deleted modifier ${modifierLabel} from group ${group.name ?? group.docId}`,
        page: LOG_PAGE.MODIFIER_GROUPS,
      });
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/modifierGroups")}
            className="mb-2"
          >
            ← Back to Modifier Groups
          </Button>
          <h1 className="text-2xl font-semibold text-black">{group.name ?? "—"}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEditGroup}>
            Edit
          </Button>
          <Button variant="solid-error" onClick={() => setDialog("delete-group")}>
            Delete
          </Button>
        </div>
      </div>


      {/* Modifiers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-black">Modifiers</h2>
          <Button  onClick={openAddModifier}>
            + Add Modifier
          </Button>
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
                    onClick={() => openEditModifier(m)}
                    className="cursor-pointer transition-colors hover:bg-background"
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
                      <div className="inline-flex">
                     
                        <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); openDeleteModifier(m); }}>
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
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                  <Button onClick={handleUpdateGroup} disabled={loading}>
                    {loading ? "Saving…" : "Save"}
                  </Button>
                </div>
              </>
            )}

            {/* Delete Group */}
            {dialog === "delete-group" && (
              <>
                <h3 className="mb-2 text-lg font-semibold text-black">Delete Modifier Group</h3>
                <p className="text-sm text-light-grey">
                  Are you sure you want to delete <strong className="text-black">{group.name}</strong>? Its modifiers will be removed too. The group will be hidden from the dashboard but kept on record so past transactions still show its name.
                </p>
                {productsUsingGroup.length > 0 && (
                  <div className="mt-3 rounded-lg border border-error/30 bg-error/5 px-3 py-2.5">
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
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                  <Button variant="solid-error" onClick={handleDeleteGroup} disabled={loading}>
                    {loading ? "Deleting…" : "Delete"}
                  </Button>
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
                  <label htmlFor="modifier-is-default" className="flex cursor-pointer items-center gap-2 text-sm text-black">
                    <Checkbox
                      id="modifier-is-default"
                      checked={modifierForm.isDefault}
                      onCheckedChange={(c) => setModifierForm((f) => ({ ...f, isDefault: c === true }))}
                    />
                    Default modifier
                  </label>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                  <Button onClick={handleSaveModifier} disabled={loading}>
                    {loading ? "Saving…" : "Save"}
                  </Button>
                </div>
              </>
            )}

            {/* Delete Modifier */}
            {dialog === "delete-modifier" && (
              <>
                <h3 className="mb-2 text-lg font-semibold text-black">Delete Modifier</h3>
                <p className="text-sm text-light-grey">Are you sure you want to delete this modifier? This cannot be undone.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                  <Button variant="solid-error" onClick={handleDeleteModifier} disabled={loading}>
                    {loading ? "Deleting…" : "Delete"}
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
