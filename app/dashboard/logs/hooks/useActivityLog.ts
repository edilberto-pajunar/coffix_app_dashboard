"use client";

import { useCallback } from "react";
import { useAuth } from "@/app/lib/AuthContext";
import { CreateLogInput, LogService } from "../service/LogService";

type ActivityLogInput = Omit<CreateLogInput, "userId"> & { userId?: string };

/**
 * Records admin/manager activity through the backend log API.
 *
 * `log()` is fire-and-forget by design: it returns `void`, so a caller cannot
 * await it into their own try/catch, and failures are swallowed with a warning.
 * A logging outage must never surface an error toast on — or abort — the action
 * being logged.
 *
 * Call it after the awaited mutation succeeds, before the success toast:
 *
 * ```ts
 * const { log } = useActivityLog();
 *
 * try {
 *   await ProductService.createProduct(data);
 *   log({
 *     category: LOG_CATEGORY.PRODUCT,
 *     severityLevel: LOG_SEVERITY.HIGH,
 *     action: "Create Product",
 *     notes: `Admin added ${data.name} product`,
 *     page: LOG_PAGE.PRODUCTS,
 *   });
 *   toast.success("Product created");
 * } catch (err) {
 *   ...
 * }
 * ```
 *
 * `userId` defaults to the signed-in staff member's uid.
 */
export function useActivityLog() {
  const { user } = useAuth();

  const log = useCallback(
    (input: ActivityLogInput): void => {
      void (async () => {
        try {
          if (!user) return;
          await LogService.createLog({
            ...input,
            userId: input.userId ?? user.uid,
          });
        } catch (err) {
          console.warn("Failed to write activity log:", err);
        }
      })();
    },
    [user],
  );

  return { log };
}
