type CacheTag = "users" | "jobInfos" | "interviews" | "questions";

export function getGlobalTag(tag: CacheTag): string {
  return `global-${tag}` as const;
}

export function getUserTag(tag: CacheTag, userId: string) {
  return `user-${userId}-${tag}` as const;
}

export function getJobInfoTag(tag: CacheTag, jobInfoId: string) {
  return `jobInfo-${jobInfoId}-${tag}` as const;
}

export function getIdTag(tag: CacheTag, id: string): string {
  return `id-${id}-${tag}` as const;
}
