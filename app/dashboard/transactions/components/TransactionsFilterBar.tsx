"use client";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DateInput } from "@/components/ui/DateInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover as PopoverPrimitive } from "radix-ui";
import { ChevronDownIcon } from "lucide-react";

type DateRange = { from: string; to: string };
type NumberRange = { min: string; max: string };

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "created", label: "Created" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
  { value: "claimed", label: "Claimed" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "expired", label: "Expired" },
];

interface TransactionsFilterBarProps {
  search: string; setSearch: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
  uniqueTypes: string[];
  methodFilter: string; setMethodFilter: (v: string) => void;
  filterStatus: Set<string>; setFilterStatus: (v: Set<string>) => void;
  filterCreatedAt: DateRange; setFilterCreatedAt: (v: DateRange | ((p: DateRange) => DateRange)) => void;
  filterAmount: NumberRange; setFilterAmount: (v: NumberRange | ((p: NumberRange) => NumberRange)) => void;
  filterTotalAmount: NumberRange; setFilterTotalAmount: (v: NumberRange | ((p: NumberRange) => NumberRange)) => void;
  filterRecipientEmail: string; setFilterRecipientEmail: (v: string) => void;
  filterRecipientFullName: string; setFilterRecipientFullName: (v: string) => void;
  anyFilterActive: boolean;
  clearAllFilters: () => void;
}

export function TransactionsFilterBar({
  search, setSearch,
  typeFilter, setTypeFilter,
  uniqueTypes,
  methodFilter, setMethodFilter,
  filterStatus, setFilterStatus,
  filterCreatedAt, setFilterCreatedAt,
  filterAmount, setFilterAmount,
  filterTotalAmount, setFilterTotalAmount,
  filterRecipientEmail, setFilterRecipientEmail,
  filterRecipientFullName, setFilterRecipientFullName,
  anyFilterActive,
  clearAllFilters,
}: TransactionsFilterBarProps) {
  function toggleStatus(value: string) {
    const next = new Set(filterStatus);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setFilterStatus(next);
  }

  const statusSummary =
    filterStatus.size === 0
      ? "All Statuses"
      : filterStatus.size === 1
        ? STATUS_OPTIONS.find((o) => filterStatus.has(o.value))?.label ?? "1 selected"
        : `${filterStatus.size} selected`;

  return (
    <div className="overflow-x-auto lg:overflow-x-visible">
      <div className="flex items-end gap-2 pb-1 min-w-max lg:min-w-0 lg:flex-wrap">

        {/* Search */}
        <div className={`flex flex-col gap-1 rounded-lg border bg-white px-3 py-1.5 min-w-[160px] ${search ? "border-primary" : "border-border"}`}>
          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-light-grey">
            Search
            {search && <button onClick={() => setSearch("")} className="ml-1 text-light-grey hover:text-black">×</button>}
          </span>
          <input
            type="text"
            placeholder="Number or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-full bg-transparent text-sm text-black outline-none placeholder:text-light-grey"
          />
        </div>

        {/* Type */}
        {uniqueTypes.length > 0 && (
          <div className={`flex flex-col gap-1 rounded-lg border bg-white px-3 py-1.5 min-w-[140px] ${typeFilter !== "All" ? "border-primary" : "border-border"}`}>
            <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-light-grey">
              Type
              {typeFilter !== "All" && <button onClick={() => setTypeFilter("All")} className="ml-1 text-light-grey hover:text-black">×</button>}
            </span>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Payment Method */}
        <div className={`flex flex-col gap-1 rounded-lg border bg-white px-3 py-1.5 min-w-[160px] ${methodFilter !== "All" ? "border-primary" : "border-border"}`}>
          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-light-grey">
            Payment Method
            {methodFilter !== "All" && <button onClick={() => setMethodFilter("All")} className="ml-1 text-light-grey hover:text-black">×</button>}
          </span>
          <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Methods</SelectItem>
              <SelectItem value="coffixCredit">Coffix Credit</SelectItem>
              <SelectItem value="card">Credit Card</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className={`flex flex-col gap-1 rounded-lg border bg-white px-3 py-1.5 min-w-[160px] ${filterStatus.size > 0 ? "border-primary" : "border-border"}`}>
          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-light-grey">
            Status
            {filterStatus.size > 0 && <button onClick={() => setFilterStatus(new Set())} className="ml-1 text-light-grey hover:text-black">×</button>}
          </span>
          <PopoverPrimitive.Root>
            <PopoverPrimitive.Trigger className="flex h-7 w-full cursor-pointer items-center justify-between gap-1 rounded-md bg-transparent text-sm outline-none">
              <span className={filterStatus.size === 0 ? "text-light-grey" : "text-black"}>{statusSummary}</span>
              <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-light-grey" />
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                align="start"
                sideOffset={4}
                className="z-50 min-w-[8rem] rounded-lg border border-border bg-white p-1 shadow-(--shadow) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                <div className="flex flex-col gap-1 p-1">
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <label key={value} htmlFor={`status-${value}`} className="flex items-center gap-2 text-sm text-black cursor-pointer">
                      <Checkbox
                        id={`status-${value}`}
                        checked={filterStatus.has(value)}
                        onCheckedChange={() => toggleStatus(value)}
                        className="size-3.5"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>

        {/* Created At */}
        <div className={`flex flex-col gap-1 rounded-lg border bg-white px-3 py-1.5 min-w-[260px] ${filterCreatedAt.from || filterCreatedAt.to ? "border-primary" : "border-border"}`}>
          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-light-grey">
            Created At
            {(filterCreatedAt.from || filterCreatedAt.to) && (
              <button onClick={() => setFilterCreatedAt({ from: "", to: "" })} className="ml-1 text-light-grey hover:text-black">×</button>
            )}
          </span>
          <div className="flex items-center gap-1">
            <DateInput value={filterCreatedAt.from} onChange={(v) => setFilterCreatedAt((p) => ({ ...p, from: v }))} />
            <span className="shrink-0 text-xs text-light-grey">–</span>
            <DateInput value={filterCreatedAt.to} onChange={(v) => setFilterCreatedAt((p) => ({ ...p, to: v }))} />
          </div>
        </div>

        {/* Amount */}
        <div className={`flex flex-col gap-1 rounded-lg border bg-white px-3 py-1.5 min-w-[200px] ${filterAmount.min || filterAmount.max ? "border-primary" : "border-border"}`}>
          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-light-grey">
            Amount ($)
            {(filterAmount.min || filterAmount.max) && <button onClick={() => setFilterAmount({ min: "", max: "" })} className="ml-1 text-light-grey hover:text-black">×</button>}
          </span>
          <div className="flex items-center gap-1">
            <input type="number" min="0" step="0.01" placeholder="Min" value={filterAmount.min}
              onChange={(e) => setFilterAmount((p) => ({ ...p, min: e.target.value }))}
              className="h-7 w-full bg-transparent text-sm text-black outline-none placeholder:text-light-grey" />
            <span className="shrink-0 text-xs text-light-grey">–</span>
            <input type="number" min="0" step="0.01" placeholder="Max" value={filterAmount.max}
              onChange={(e) => setFilterAmount((p) => ({ ...p, max: e.target.value }))}
              className="h-7 w-full bg-transparent text-sm text-black outline-none placeholder:text-light-grey" />
          </div>
        </div>

        {/* Recipient Email */}
        <div className={`flex flex-col gap-1 rounded-lg border bg-white px-3 py-1.5 min-w-[160px] ${filterRecipientEmail ? "border-primary" : "border-border"}`}>
          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-light-grey">
            Recipient Email
            {filterRecipientEmail && <button onClick={() => setFilterRecipientEmail("")} className="ml-1 text-light-grey hover:text-black">×</button>}
          </span>
          <input
            type="text"
            placeholder="contains…"
            value={filterRecipientEmail}
            onChange={(e) => setFilterRecipientEmail(e.target.value)}
            className="h-7 w-full bg-transparent text-sm text-black outline-none placeholder:text-light-grey"
          />
        </div>

        {/* Recipient Name */}
        <div className={`flex flex-col gap-1 rounded-lg border bg-white px-3 py-1.5 min-w-[160px] ${filterRecipientFullName ? "border-primary" : "border-border"}`}>
          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-light-grey">
            Recipient Name
            {filterRecipientFullName && <button onClick={() => setFilterRecipientFullName("")} className="ml-1 text-light-grey hover:text-black">×</button>}
          </span>
          <input
            type="text"
            placeholder="contains…"
            value={filterRecipientFullName}
            onChange={(e) => setFilterRecipientFullName(e.target.value)}
            className="h-7 w-full bg-transparent text-sm text-black outline-none placeholder:text-light-grey"
          />
        </div>

        {anyFilterActive && (
          <button
            onClick={clearAllFilters}
            className="self-end mb-2 shrink-0 text-xs text-light-grey underline underline-offset-2 hover:text-black transition-colors whitespace-nowrap"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
