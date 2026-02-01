import { getGlobalTag, getIdTag, getUserTag } from "@/lib/dataCache";

export function getJobInfoGlobalTag() {
  return getGlobalTag("jobInfos");
}

export function getJobInfoUserTag(userId: string) {
  return getUserTag("jobInfos", userId);
}

export function getJobInfoIdTag(id: string) {
  return getIdTag("jobInfos", id);
}
