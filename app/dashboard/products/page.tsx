"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboardStore } from "./store/useDashboardStore";
import { useProductSortStore } from "./store/useProductSortStore";
import { useStoreStore } from "../stores/store/useStoreStore";
import { Product, isProductNameTaken } from "./interface/product";
import { ProductService } from "./service/ProductService";
import {
  PRODUCT_PROTECTED_FIELDS,
  PRODUCT_IMPORTABLE_FIELDS,
  PRODUCT_REQUIRED_FIELDS,
  PRODUCT_EXPORTABLE_FIELDS,
} from "./constants/productFieldConstants";
import { classifyDocIdTarget, partitionIdCell, validateDocIdFormat } from "@/components/import/storeRefs";
import { exportRowsToCSV } from "@/app/utils/import";
import { ImportCsvDialog, firstExampleRecord } from "@/components/import/ImportCsvDialog";
import { isFileError, parseImportFile } from "@/components/import/parseImportFile";
import type { ImportError, ImportPreview } from "@/components/import/types";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductsFilterBar } from "./components/ProductsFilterBar";
import { ImageUploadField } from "@/components/components/ImageUploadField";
import { useAuth } from "@/app/lib/AuthContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";

type NewProductForm = {
  name: string;
  imageUrl: string;
  price: string;
  cost: string;
  categoryId: string;
  modifierGroupIds: string[];
  availableToStores: string[];
};

const emptyForm: NewProductForm = {
  name: "",
  imageUrl: "",
  price: "",
  cost: "",
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
        <label className="text-xs text-black">{label} *</label>
        {showSelectAll && options.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onChange(options.map((o) => o.value))}
              disabled={allSelected}
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
            >
              Unselect all
            </Button>
          </div>
        )}
      </div>
      <div className={`max-h-36 overflow-y-auto rounded-lg border bg-white p-2 space-y-1 ${error ? "border-error" : "border-border"}`}>
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-black">No options available.</p>
        ) : (
          options.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`${fieldId}-${opt.value}`}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-black "
            >
              <Checkbox
                id={`${fieldId}-${opt.value}`}
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-error">Please select at least one.</p>
      ) : selected.length > 0 ? (
        <p className="mt-1 text-xs text-black">{selected.length} selected</p>
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
  type NumberRange = { min: string; max: string };

  const sortKey = useProductSortStore((s) => s.sortKey);
  const sortDir = useProductSortStore((s) => s.sortDir);
  const toggleSort = useProductSortStore((s) => s.toggleSort);

  const [search, setSearch] = useState("");

  const [filterCategoryId, setFilterCategoryId] = useState("All");
  const [filterPrice, setFilterPrice] = useState<NumberRange>({ min: "", max: "" });
  const [filterCost, setFilterCost] = useState<NumberRange>({ min: "", max: "" });
  const [filterAvailableInStore, setFilterAvailableInStore] = useState("All");
  const [filterDisabledInStore, setFilterDisabledInStore] = useState("All");
  const { currentStaff } = useAuth();

  function clearAllFilters() {
    setSearch("");
    setFilterCategoryId("All");
    setFilterPrice({ min: "", max: "" });
    setFilterCost({ min: "", max: "" });
    setFilterAvailableInStore("All");
    setFilterDisabledInStore("All");
    setSelectedIds(new Set());
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [showBulkStores, setShowBulkStores] = useState(false);
  const [bulkStoreChanges, setBulkStoreChanges] = useState<Map<string, boolean | null>>(new Map());

  function openBulkStores() {
    const selectedProducts = products.filter((p) => selectedIds.has(p.docId ?? ""));
    const initial = new Map<string, boolean | null>();
    for (const store of stores) {
      const count = selectedProducts.filter((p) => (p.availableToStores ?? []).includes(store.docId)).length;
      if (count === selectedProducts.length) initial.set(store.docId, true);
      else if (count === 0) initial.set(store.docId, false);
      else initial.set(store.docId, null); // indeterminate
    }
    setBulkStoreChanges(initial);
    setShowBulkStores(true);
  }

  async function handleBulkStoreUpdate() {
    setBulkLoading(true);
    // Captured before the selection is cleared below, so the log note is accurate.
    const affectedCount = selectedIds.size;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => {
          const product = products.find((p) => p.docId === id)!;
          let available = [...(product.availableToStores ?? [])];
          let disabled = [...(product.disabledStores ?? [])];

          for (const [storeId, checked] of bulkStoreChanges) {
            if (checked === true && !available.includes(storeId)) {
              available.push(storeId);
            } else if (checked === false) {
              available = available.filter((s) => s !== storeId);
              disabled = disabled.filter((s) => s !== storeId);
            }
            // null = indeterminate / unchanged — no-op
          }

          return ProductService.updateProduct(id, {
            availableToStores: available,
            disabledStores: disabled,
          });
        }),
      );
      log({
        category: LOG_CATEGORY.PRODUCT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Bulk Update Stores",
        notes: `Admin updated store availability for ${affectedCount} product${affectedCount !== 1 ? "s" : ""}`,
        page: LOG_PAGE.PRODUCTS,
      });
      toast.success("Stores updated for selected products.");
      setShowBulkStores(false);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to update stores.");
    } finally {
      setBulkLoading(false);
    }
  }

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewProductForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NewProductForm, boolean>>>({});
  const [loading, setLoading] = useState(false);

  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([]);

  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDragMode = !search && filterCategoryId === "All" && sortKey === "name" && sortDir === "asc";

  async function handleDragEnd() {
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || dragOverIndex === null || fromIdx === dragOverIndex) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }

    const reordered = [...orderedProducts];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dragOverIndex, 0, moved);
    setOrderedProducts(reordered);
    dragIndexRef.current = null;
    setDragOverIndex(null);

    try {
      await Promise.all(
        reordered.map((p, i) =>
          ProductService.updateProduct(p.docId ?? "", { order: i }),
        ),
      );
    } catch {
      toast.error("Failed to save order.");
    }
  }

  const categoryFilters = [
    "All",
    ...Array.from(new Set(products.map((p) => getCategoryName(p.categoryId)))),
  ];

  const anyFilterActive = useMemo(() => {
    return (
      search.trim() !== "" ||
      filterCategoryId !== "All" ||
      filterPrice.min !== "" || filterPrice.max !== "" ||
      filterCost.min !== "" || filterCost.max !== "" ||
      filterAvailableInStore !== "All" ||
      filterDisabledInStore !== "All"
    );
  }, [search, filterCategoryId, filterPrice, filterCost,
      filterAvailableInStore, filterDisabledInStore]);

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      if (!(p.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategoryId !== "All" && getCategoryName(p.categoryId) !== filterCategoryId) return false;
      if (filterPrice.min !== "") {
        const min = parseFloat(filterPrice.min);
        if (!isNaN(min) && (p.price ?? 0) < min) return false;
      }
      if (filterPrice.max !== "") {
        const max = parseFloat(filterPrice.max);
        if (!isNaN(max) && (p.price ?? 0) > max) return false;
      }
      if (filterCost.min !== "") {
        const min = parseFloat(filterCost.min);
        if (!isNaN(min) && (p.cost ?? 0) < min) return false;
      }
      if (filterCost.max !== "") {
        const max = parseFloat(filterCost.max);
        if (!isNaN(max) && (p.cost ?? 0) > max) return false;
      }
      if (filterAvailableInStore !== "All" && !(p.availableToStores ?? []).includes(filterAvailableInStore)) return false;
      if (filterDisabledInStore !== "All" && !(p.disabledStores ?? []).includes(filterDisabledInStore)) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      // Category is always the primary grouping key so same-category
      // products stay together regardless of the active sort column.
      const catCmp = (getCategoryName(a.categoryId) ?? "").localeCompare(
        getCategoryName(b.categoryId) ?? "",
      );
      if (catCmp !== 0) return catCmp;

      // Within a category, order by the active sort column.
      let cmp = 0;
      if (sortKey === "price") cmp = (a.price ?? 0) - (b.price ?? 0);
      else if (sortKey === "cost") cmp = (a.cost ?? 0) - (b.cost ?? 0);
      else // "name" and "category" both fall back to manual order then name
        cmp = (a.order ?? 0) - (b.order ?? 0) || (a.name ?? "").localeCompare(b.name ?? "");

      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [products, search, filterCategoryId, getCategoryName, sortKey, sortDir,
      filterPrice, filterCost, filterAvailableInStore, filterDisabledInStore]);

  useEffect(() => {
    setOrderedProducts(filtered);
  }, [filtered]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.docId ?? ""));
  const someVisibleSelected = filtered.some((p) => selectedIds.has(p.docId ?? ""));
  const { log } = useActivityLog();

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.docId ?? ""));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.add(p.docId ?? ""));
        return next;
      });
    }
  }

  function toggleSelectOne(docId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  async function handleCopyProduct(product: Product) {
    try {
      const { docId, ...rest } = product;
      const liveProducts = useDashboardStore.getState().products;
      const baseName = `Copy of ${product.name ?? ""}`;
      let copyName = baseName;
      let suffix = 2;
      while (isProductNameTaken(liveProducts, copyName)) {
        copyName = `${baseName} (${suffix})`;
        suffix += 1;
      }
      await ProductService.createProduct({
        ...rest,
        name: copyName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      log({
        category: LOG_CATEGORY.PRODUCT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Duplicate Product",
        notes: `Admin duplicated product ${product.name ?? ""}`,
        page: LOG_PAGE.PRODUCTS,
      });

      toast.success("Product duplicated successfully.");
    } catch {
      toast.error("Failed to duplicate product. Please try again.");
    }
  }

  async function handleBulkDisable(disabled: boolean) {
    setBulkLoading(true);
    // Captured before the selection is cleared below, so the log note is accurate.
    const affectedCount = selectedIds.size;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => {
          const product = products.find((p) => p.docId === id);
          const disabledStores = disabled
            ? (product?.availableToStores ?? [])
            : [];
          return ProductService.updateProduct(id, { disabledStores });
        }),
      );
      log({
        category: LOG_CATEGORY.PRODUCT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Bulk Toggle Availability",
        notes: `Admin bulk ${disabled ? "disabled" : "enabled"} ${affectedCount} product${affectedCount !== 1 ? "s" : ""}`,
        page: LOG_PAGE.PRODUCTS,
      });
      toast.success(disabled ? "Selected products disabled." : "Selected products enabled.");
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error("Failed to update products.");
    } finally {
      setBulkLoading(false);
    }
  }

  function setField<K extends keyof NewProductForm>(key: K, value: NewProductForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: false }));
  }

  function closeCreate() {
    setShowCreate(false);
    setForm(emptyForm);
    setErrors({});
  }

  function exportToCSV() {
    exportRowsToCSV(filtered, PRODUCT_EXPORTABLE_FIELDS, "products");
  }

  /**
   * Returns a fresh validator per import. Names claimed by earlier rows are held in
   * the closure, so a file cannot introduce duplicates among its own rows — the
   * database check alone would pass every row and then write the collision.
   */
  function makeProductRowValidator() {
    const claimedNames = new Map<string, number>();

    return function validateProductRow(
      row: Record<string, string>,
      rowNum: number,
    ): ImportError[] {
      const errors: ImportError[] = [];
      const existingProductIds = useDashboardStore.getState().products.map((p) => p.docId!);
      const allProductIds = useDashboardStore.getState().allProducts.map((p) => p.docId!);
      const existingCategoryIds = useDashboardStore.getState().categories.map((c) => c.docId!);
      const existingStoreIds = useStoreStore.getState().stores.map((s) => s.docId);
      const allStoreIds = useStoreStore.getState().allStores.map((s) => s.docId);
      const existingModifierGroupIds = useDashboardStore.getState().modifierGroups.map((g) => g.docId!);
      const allModifierGroupIds = useDashboardStore.getState().allModifierGroups.map((g) => g.docId!);

      // Format first: a wrong-entity ID gets a message naming the right section, instead
      // of the membership check's generic "not found". A soft-deleted target is not an
      // error — the row restores it on write. Only an unknown ID fails.
      const docIdFormatError = validateDocIdFormat(row.docId, "products", rowNum);
      if (docIdFormatError) {
        errors.push(docIdFormatError);
      } else if (
        row.docId &&
        classifyDocIdTarget(row.docId, existingProductIds, allProductIds) === "unknown"
      ) {
        errors.push({ row: rowNum, field: "docId", reason: "Product not found — cannot update" });
      }

      if (!row.docId) {
        if (!(PRODUCT_REQUIRED_FIELDS as readonly string[]).every((f) => row[f]?.trim())) {
          errors.push({ row: rowNum, field: "name", reason: "name is required for new products" });
        } else if (isProductNameTaken(useDashboardStore.getState().products, row.name)) {
          errors.push({ row: rowNum, field: "name", reason: `Product "${row.name}" already exists` });
        } else {
          const key = row.name.trim().toLowerCase();
          const claimedBy = claimedNames.get(key);
          if (claimedBy !== undefined) {
            errors.push({
              row: rowNum,
              field: "name",
              reason: `Product "${row.name}" duplicates row ${claimedBy}`,
            });
          } else {
            claimedNames.set(key, rowNum);
          }
        }
      }

      (["price", "cost"] as const).forEach((field) => {
        if (row[field] !== undefined && row[field] !== "") {
          const v = parseFloat(row[field]);
          if (isNaN(v) || v < 0) {
            errors.push({ row: rowNum, field, reason: "Must be a valid non-negative number" });
          }
        }
      });

      if (row.order !== undefined && row.order !== "") {
        if (isNaN(parseInt(row.order))) {
          errors.push({ row: rowNum, field: "order", reason: "Must be a valid integer" });
        }
      }

      if (row.categoryId && !existingCategoryIds.includes(row.categoryId)) {
        errors.push({ row: rowNum, field: "categoryId", reason: `Category "${row.categoryId}" not found` });
      }

      // Soft-deleted references are dropped on write rather than failing the row, so
      // only genuinely unknown IDs are errors here. See buildStoreList below.
      if (row.modifierGroupIds) {
        const { unknown } = partitionIdCell(
          row.modifierGroupIds,
          existingModifierGroupIds,
          allModifierGroupIds,
        );
        if (unknown.length > 0) {
          errors.push({ row: rowNum, field: "modifierGroupIds", reason: `Unknown modifier group IDs: ${unknown.join(", ")}` });
        }
      }

      (["availableToStores", "disabledStores"] as const).forEach((field) => {
        if (row[field]) {
          const { unknown } = partitionIdCell(row[field], existingStoreIds, allStoreIds);
          if (unknown.length > 0) {
            errors.push({ row: rowNum, field, reason: `Unknown store IDs: ${unknown.join(", ")}` });
          }
        }
      });

      return errors;
    };
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const result = await parseImportFile(file, {
      protectedFields: PRODUCT_PROTECTED_FIELDS,
      importableFields: PRODUCT_IMPORTABLE_FIELDS,
      validateRow: makeProductRowValidator(),
    });

    if (isFileError(result)) {
      toast.error(result.fileError);
      return;
    }
    setImportPreview(result);
  }

  async function handleConfirmImport() {
    const importable =
      importPreview?.rows.filter((r) => r.action !== "error") ?? [];
    if (importable.length === 0) return;
    setImportLoading(true);
    try {
      let created = 0;
      let updated = 0;
      // Read once: these lists don't change mid-import, and the validator has
      // already guaranteed every remaining ID is either live or soft-deleted.
      const storeIds = useStoreStore.getState().stores.map((s) => s.docId);
      const allStoreIds = useStoreStore.getState().allStores.map((s) => s.docId);
      const groupIds = useDashboardStore.getState().modifierGroups.map((g) => g.docId!);
      const allGroupIds = useDashboardStore.getState().allModifierGroups.map((g) => g.docId!);

      for (const { action, data: row } of importable) {
        const data: Record<string, unknown> = {};
        if (row.name) data.name = row.name;
        if (row.price !== undefined && row.price !== "") data.price = parseFloat(row.price);
        if (row.cost !== undefined && row.cost !== "") data.cost = parseFloat(row.cost);
        if (row.order !== undefined && row.order !== "") data.order = parseInt(row.order);
        if (row.categoryId) data.categoryId = row.categoryId;
        // Only live IDs are written — references to soft-deleted records are dropped.
        if (row.modifierGroupIds !== undefined)
          data.modifierGroupIds = partitionIdCell(row.modifierGroupIds, groupIds, allGroupIds).live;
        if (row.availableToStores !== undefined)
          data.availableToStores = partitionIdCell(row.availableToStores, storeIds, allStoreIds).live;
        if (row.disabledStores !== undefined)
          data.disabledStores = partitionIdCell(row.disabledStores, storeIds, allStoreIds).live;
        if (row.imageUrl !== undefined) data.imageUrl = row.imageUrl;

        if (action === "update") {
          // Clearing the soft-delete flags restores a product deleted after the CSV was
          // exported; on a live product it is a no-op.
          await ProductService.updateProduct(row.docId, {
            ...data,
            isDeleted: false,
            deletedAt: null,
          });
          updated++;
        } else {
          await ProductService.createProduct(data as Parameters<typeof ProductService.createProduct>[0]);
          created++;
        }
      }
      log({
        category: LOG_CATEGORY.IMPORT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Import Products",
        notes: `Admin created ${created} and updated ${updated} product(s) via CSV`,
        page: LOG_PAGE.PRODUCTS,
      });
      toast.success(`Created ${created} and updated ${updated} product(s).`);
      setImportPreview(null);
    } catch {
      toast.error("Failed to import products.");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleCreate() {
    const priceNum = parseFloat(form.price);
    const costNum = parseFloat(form.cost);
    const newErrors: Partial<Record<keyof NewProductForm, boolean>> = {
      name: !form.name.trim(),
      price: form.price === "",
      cost: form.cost === "",
      categoryId: !form.categoryId,
      availableToStores: form.availableToStores.length === 0,
    };

    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields.");
      return;
    }

    const invalidPrice = isNaN(priceNum) || priceNum <= 0;
    const invalidCost = isNaN(costNum) || costNum <= 0;
    if (invalidPrice || invalidCost) {
      setErrors({ ...newErrors, price: invalidPrice, cost: invalidCost });
      toast.error("Price and cost must be greater than 0.");
      return;
    }

    if (isProductNameTaken(useDashboardStore.getState().products, form.name)) {
      setErrors({ ...newErrors, name: true });
      toast.error(`A product named "${form.name.trim()}" already exists.`);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const minOrder = products.length > 0 ? Math.min(...products.map((p) => p.order ?? 0)) : 0;
      const imageUrl = form.imageUrl.trim();
      await ProductService.createProduct({
        name: form.name.trim(),
        ...(imageUrl && { imageUrl }),
        price: priceNum,
        cost: costNum,
        order: minOrder - 1,
        categoryId: form.categoryId,
        modifierGroupIds: form.modifierGroupIds,
        availableToStores: form.availableToStores,
        disabledStores: [],
        createdAt: new Date(),
      });
      log({
        category: LOG_CATEGORY.PRODUCT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Create Product",
        notes: `Admin added ${form.name.trim()} product`,
        page: LOG_PAGE.PRODUCTS,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Products</h1>
          <p className="mt-1 text-sm text-black">
            {products.length} product{products.length !== 1 ? "s" : ""} total
          </p>
        </div>
        {currentStaff?.role === "admin" && <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => setShowImportInfo(true)}
            disabled={importLoading}
          >
            {importLoading ? "Importing…" : "Import CSV"}
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
          <Button
          onClick={() => setShowCreate(true)}>+ New Product</Button>
        </div>}
      </div>

      <ProductsFilterBar
        search={search} setSearch={setSearch}
        filterCategoryId={filterCategoryId} setFilterCategoryId={setFilterCategoryId}
        categoryNames={categoryFilters.filter((c) => c !== "All")}
        filterPrice={filterPrice} setFilterPrice={setFilterPrice}
        filterCost={filterCost} setFilterCost={setFilterCost}
        filterAvailableInStore={filterAvailableInStore} setFilterAvailableInStore={setFilterAvailableInStore}
        filterDisabledInStore={filterDisabledInStore} setFilterDisabledInStore={setFilterDisabledInStore}
        stores={stores}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-2.5 shadow-(--shadow)">
          <span className="text-sm text-black">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button
              onClick={() => handleBulkDisable(false)}
              disabled={bulkLoading}
              className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              Enable
            </Button>
            <Button
              onClick={() => handleBulkDisable(true)}
              disabled={bulkLoading}
              className="rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              Disable
            </Button>
            <Button
              onClick={openBulkStores}
              disabled={bulkLoading}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-background disabled:opacity-50"
            >
              Update Stores
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkLoading}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              {isDragMode && <th className="w-6 px-2 py-3" />}
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={
                    someVisibleSelected && !allVisibleSelected ? "indeterminate" : allVisibleSelected
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th
                onClick={() => toggleSort("name")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-black hover:text-black"
              >
                Product {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
              </th>
              <th
                onClick={() => toggleSort("category")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-black hover:text-black"
              >
                Category {sortKey === "category" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
              </th>
              <th
                onClick={() => toggleSort("price")}
                className="cursor-pointer select-none px-5 py-3 text-right font-medium text-black hover:text-black"
              >
                Price {sortKey === "price" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
              </th>
              <th
                onClick={() => toggleSort("cost")}
                className="cursor-pointer select-none px-5 py-3 text-right font-medium text-black hover:text-black"
              >
                Cost {sortKey === "cost" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
              </th>
              {currentStaff?.role === "admin" && <th className="w-10 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-black">
                  No products found.
                </td>
              </tr>
            ) : (
              (isDragMode ? orderedProducts : filtered).map((product: Product, idx: number) => {
                const isSelected = selectedIds.has(product.docId ?? "");
                const isDragOver = isDragMode && dragOverIndex === idx;
                return (
                  <tr
                    key={product.docId}
                    draggable={isDragMode}
                    onDragStart={() => { dragIndexRef.current = idx; }}
                    onDragOver={(e) => { if (isDragMode) { e.preventDefault(); setDragOverIndex(idx); } }}
                    onDragLeave={() => { if (isDragMode) setDragOverIndex(null); }}
                    onDrop={(e) => { e.preventDefault(); handleDragEnd(); }}
                    onDragEnd={handleDragEnd}
                    onClick={() => router.push(`/dashboard/products/${product.docId}`)}
                    className={`group transition-colors hover:bg-background ${isDragMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isSelected ? "bg-blue-50" : ""} ${isDragOver ? "border-t-2 border-primary" : ""} ${(product.availableToStores ?? []).length > 0 && (product.availableToStores ?? []).every((id) => (product.disabledStores ?? []).includes(id)) ? "opacity-50" : ""}`}
                  >
                    {isDragMode && (
                      <td className="w-6 px-2 py-3 text-black" onClick={(e) => e.stopPropagation()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-40">
                          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                        </svg>
                      </td>
                    )}
                    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectOne(product.docId ?? "")}
                      />
                    </td>
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
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                            {(product.name ?? "?")[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-black">{product.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-[#f0f0f0] px-2.5 py-1 text-xs font-medium text-black">
                        {getCategoryName(product.categoryId)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-primary">
                      ${(product.price ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right text-black">
                      ${(product.cost ?? 0).toFixed(2)}
                    </td>
                    {currentStaff?.role === "admin" && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Duplicate product"
                          
                          onClick={() => handleCopyProduct(product)}
                          className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-black transition-opacity hover:bg-[#f0f0f0] hover:text-black"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Create Product Dialog ── */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs text-black">Name *</label>
                <input
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.name ? "border-error" : "border-border"}`}
                  placeholder="e.g. Caramel Latte"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
                {errors.name && <p className="mt-1 text-xs text-error">Name is required.</p>}
              </div>
              <div className="col-span-2">
                <ImageUploadField
                  value={form.imageUrl}
                  onChange={(url) => setField("imageUrl", url)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-black">Price *</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-black">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`w-full rounded-lg border pl-7 pr-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.price ? "border-error" : "border-border"}`}
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => setField("price", e.target.value)}
                  />
                </div>
                {errors.price && <p className="mt-1 text-xs text-error">Required and must be greater than 0.</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-black">Cost *</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-black">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`w-full rounded-lg border pl-7 pr-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.cost ? "border-error" : "border-border"}`}
                    placeholder="0.00"
                    value={form.cost}
                    onChange={(e) => setField("cost", e.target.value)}
                  />
                </div>
                {errors.cost && <p className="mt-1 text-xs text-error">Required and must be greater than 0.</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-black">Category *</label>
              <Select
                value={form.categoryId}
                onValueChange={(value) => setField("categoryId", value)}
              >
                <SelectTrigger
                  className={`h-auto w-full rounded-lg border px-3 py-2 focus:border-primary ${errors.categoryId ? "border-error" : "border-border"}`}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="w-(--radix-select-trigger-width) ">
                  {categories
                    .filter((c) => c.docId)
                    .map((c) => (
                      <SelectItem  key={c.docId} value={c.docId!}>
                        {c.name ?? c.docId}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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

      {/* ── Bulk Update Stores Dialog ── */}
      <Dialog open={showBulkStores} onOpenChange={(open) => { if (!open) setShowBulkStores(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Available Stores</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-black -mt-1">{selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""} selected</p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-white p-2 space-y-1">
            {stores.length === 0 ? (
              <p className="px-1 py-1 text-xs text-black">No stores available.</p>
            ) : (
              stores.map((store) => {
                const state = bulkStoreChanges.get(store.docId);
                const isIndeterminate = state === null;
                const isChecked = state === true;
                return (
                  <label
                    key={store.docId}
                    htmlFor={`bulk-store-${store.docId}`}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-black hover:bg-background"
                  >
                    <Checkbox
                      id={`bulk-store-${store.docId}`}
                      checked={isIndeterminate ? "indeterminate" : isChecked}
                      onCheckedChange={() => {
                        setBulkStoreChanges((prev) => {
                          const next = new Map(prev);
                          // cycle: indeterminate → checked, checked → unchecked, unchecked → checked
                          if (state === null) next.set(store.docId, true);
                          else if (state === true) next.set(store.docId, false);
                          else next.set(store.docId, true);
                          return next;
                        });
                      }}
                    />
                    <span className="flex-1">{store.name ?? store.docId}</span>
                    {isIndeterminate && (
                      <span className="text-xs text-black opacity-60">mixed</span>
                    )}
                  </label>
                );
              })
            )}
          </div>
          <p className="text-xs text-black opacity-60">
            Checked = add to all selected products. Unchecked = remove from all. Mixed = leave as-is.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkStores(false)} disabled={bulkLoading}>
              Cancel
            </Button>
            <Button onClick={handleBulkStoreUpdate} disabled={bulkLoading || stores.length === 0}>
              {bulkLoading ? "Applying…" : "Apply Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportCsvDialog
        entityLabel="Products"
        idCollection="products"
        exampleRecord={firstExampleRecord(products)}
        guideOpen={showImportInfo}
        onGuideOpenChange={setShowImportInfo}
        guide={{
          editable: PRODUCT_IMPORTABLE_FIELDS,
          required: PRODUCT_REQUIRED_FIELDS,
          note: (
            <p className="text-xs leading-relaxed text-light-grey">
              Array fields <span className="font-mono text-black">modifierGroupIds</span>,{" "}
              <span className="font-mono text-black">availableToStores</span> and{" "}
              <span className="font-mono text-black">disabledStores</span> accept a JSON list
              or a <span className="font-mono text-black">|</span>-separated list.
            </p>
          ),
        }}
        onChooseFile={() => fileInputRef.current?.click()}
        preview={importPreview}
        onPreviewClose={() => setImportPreview(null)}
        loading={importLoading}
        onConfirm={handleConfirmImport}
      />

    </div>
  );
}
