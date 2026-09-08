import type { ScreeningStatus } from "@/lib/types";

export const PROCESSING_STALE_AFTER_MS = 10 * 60 * 1000;
export const PROCESSING_REFRESH_INTERVAL_MS = 5 * 1000;

export function isProcessingStatus(status: string): status is Extract<
  ScreeningStatus,
  "uploading" | "analyzing"
> {
  return status === "uploading" || status === "analyzing";
}

export function isStaleProcessing(
  status: string,
  statusUpdatedAt: string,
  nowMs = Date.now()
) {
  if (!isProcessingStatus(status)) return false;

  const updatedAtMs = new Date(statusUpdatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return false;

  return nowMs - updatedAtMs >= PROCESSING_STALE_AFTER_MS;
}
