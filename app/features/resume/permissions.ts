import { hasPermission } from "@/app/services/clerk/lib/hasPermission";
import { createLogger } from "@/lib/logger";

const log = createLogger("permissions");

/**
 * Resume analysis is gated entirely on the unlimited_resume_analysis feature -
 * there is no free allowance, so there is no count to keep. Declared in the
 * Permission union since the beginning and, until now, passed to hasPermission
 * from nowhere at all.
 */
export async function canRunResumeAnalysis(): Promise<boolean> {
  try {
    return await hasPermission("unlimited_resume_analysis");
  } catch (error) {
    log.error("resume permission check failed", error);
    return false;
  }
}
