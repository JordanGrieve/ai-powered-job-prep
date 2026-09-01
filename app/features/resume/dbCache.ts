import { getGlobalTag, getIdTag, getJobInfoTag } from "@/lib/dataCache";
import { revalidateTag } from "next/cache";

export function getResumeAnalysisGlobalTag() {
  return getGlobalTag("resumeAnalyses");
}

export function getResumeAnalysisJobInfoTag(jobInfoId: string) {
  return getJobInfoTag("resumeAnalyses", jobInfoId);
}

export function getResumeAnalysisIdTag(id: string) {
  return getIdTag("resumeAnalyses", id);
}

export function revalidateResumeAnalysisCache({
  id,
  jobInfoId,
}: {
  id: string;
  jobInfoId: string;
}) {
  revalidateTag(getResumeAnalysisGlobalTag(), "default");
  revalidateTag(getResumeAnalysisJobInfoTag(jobInfoId), "default");
  revalidateTag(getResumeAnalysisIdTag(id), "default");
}
