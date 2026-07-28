"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LogService } from "../service/LogService";
import { LogSettings } from "../interface/logSettings";
import { useActivityLog } from "../hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../constants/logConstants";

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function LogSettingsDialog({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: LogSettings | null;
}) {
  const [enabled, setEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState("");
  const [levels, setLevels] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const { log } = useActivityLog();

  useEffect(() => {
    setEnabled(settings?.enabled ?? false);
    setRetentionDays(
      settings?.retentionDays !== undefined ? String(settings.retentionDays) : ""
    );
    setLevels(new Set(settings?.levels ?? []));
  }, [settings, open]);

  function toggleLevel(level: number) {
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  async function handleSave() {
    const trimmed = retentionDays.trim();
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (isNaN(n) || n < 0 || !Number.isInteger(n)) {
        toast.error("Retention Days must be a non-negative whole number.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Partial<LogSettings> = {
        enabled,
        levels: Array.from(levels).sort((a, b) => a - b),
      };
      if (trimmed !== "") payload.retentionDays = Number(trimmed);

      await LogService.updateLogSettings(payload);
      log({
        category: LOG_CATEGORY.LOGS,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Save Log Settings",
        notes: `Admin changed log auto-deletion/retention settings (enabled: ${enabled}, retention: ${trimmed || "unset"} days)`,
        page: LOG_PAGE.LOGS,
      });
      toast.success("Log deletion settings saved.");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save log settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Deletion Settings</DialogTitle>
          <DialogDescription>
            Configure automatic deletion of old logs — applies app-wide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-black">Automatic Delete Logs</p>
              <p className="text-xs text-light-grey">
                When on, old logs are deleted automatically based on the rules below.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                enabled ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Retention days */}
          <div>
            <label className="mb-1.5 block text-xs text-light-grey">
              Retention Days — delete logs older than this
            </label>
            <div className="relative">
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                placeholder="30"
                className="w-full rounded-lg border border-border py-2 pl-3 pr-12 text-sm text-black outline-none focus:border-primary"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-light-grey">
                days
              </span>
            </div>
          </div>

          {/* Levels */}
          <div>
            <label className="mb-1.5 block text-xs text-light-grey">
              Severity Levels to Delete
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((level) => (
                <label
                  key={level}
                  htmlFor={`log-level-${level}`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-black"
                >
                  <Checkbox
                    id={`log-level-${level}`}
                    checked={levels.has(level)}
                    onCheckedChange={() => toggleLevel(level)}
                  />
                  Level {level}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
