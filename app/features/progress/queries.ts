import { db } from "@/app/drizzle/db";
import {
  InterviewTable,
  QuestionTable,
  ResumeAnalysisTable,
} from "@/app/drizzle/schema";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { getInterviewJobInfoTag } from "../interviews/dbCache";
import { getQuestionJobInfoTag } from "../questions/dbCache";
import { getResumeAnalysisJobInfoTag } from "../resume/dbCache";

export type ProgressKind = "interview" | "question" | "resume";

export type ProgressPoint = {
  kind: ProgressKind;
  id: string;
  rating: number;
  at: Date;
  /** Short human label for the point, e.g. the question text or file name. */
  label: string;
};

export type ProgressSummary = {
  points: ProgressPoint[];
  /** Mean rating of the first half vs the second half, when there is enough
   *  data to say anything. Null below 4 points - two attempts is noise, not a
   *  trend, and claiming improvement from it would be dishonest. */
  trend: { earlier: number; later: number; delta: number } | null;
  latestByKind: Partial<Record<ProgressKind, ProgressPoint>>;
};

/**
 * Every rated artefact for one job description, on a single timeline.
 *
 * Scoped per job description rather than globally: a candidate applying to a
 * grad scheme and an internship is preparing for two different things, and
 * averaging them together would hide movement in both.
 */
export async function getJobInfoProgress(
  jobInfoId: string,
): Promise<ProgressSummary> {
  "use cache";
  cacheTag(getInterviewJobInfoTag(jobInfoId));
  cacheTag(getQuestionJobInfoTag(jobInfoId));
  cacheTag(getResumeAnalysisJobInfoTag(jobInfoId));

  const [interviews, questions, resumes] = await Promise.all([
    db
      .select({
        id: InterviewTable.id,
        rating: InterviewTable.rating,
        at: InterviewTable.createdAt,
        duration: InterviewTable.duration,
      })
      .from(InterviewTable)
      .where(
        and(
          eq(InterviewTable.jobInfoId, jobInfoId),
          isNotNull(InterviewTable.rating),
        ),
      )
      .orderBy(asc(InterviewTable.createdAt)),

    db
      .select({
        id: QuestionTable.id,
        rating: QuestionTable.rating,
        at: QuestionTable.answeredAt,
        text: QuestionTable.text,
      })
      .from(QuestionTable)
      .where(
        and(
          eq(QuestionTable.jobId, jobInfoId),
          isNotNull(QuestionTable.rating),
          isNotNull(QuestionTable.answeredAt),
        ),
      )
      .orderBy(asc(QuestionTable.answeredAt)),

    db
      .select({
        id: ResumeAnalysisTable.id,
        rating: ResumeAnalysisTable.rating,
        at: ResumeAnalysisTable.createdAt,
        fileName: ResumeAnalysisTable.fileName,
      })
      .from(ResumeAnalysisTable)
      .where(eq(ResumeAnalysisTable.jobInfoId, jobInfoId))
      .orderBy(asc(ResumeAnalysisTable.createdAt)),
  ]);

  const points: ProgressPoint[] = [
    ...interviews.map((r) => ({
      kind: "interview" as const,
      id: r.id,
      rating: r.rating!,
      at: r.at,
      label: `Mock interview (${r.duration})`,
    })),
    ...questions.map((r) => ({
      kind: "question" as const,
      id: r.id,
      rating: r.rating!,
      at: r.at!,
      label: r.text,
    })),
    ...resumes.map((r) => ({
      kind: "resume" as const,
      id: r.id,
      rating: r.rating,
      at: r.at,
      label: r.fileName,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    points,
    trend: computeTrend(points),
    latestByKind: points.reduce<Partial<Record<ProgressKind, ProgressPoint>>>(
      (acc, p) => ({ ...acc, [p.kind]: p }),
      {},
    ),
  };
}

const MIN_POINTS_FOR_TREND = 4;

export function computeTrend(points: ProgressPoint[]) {
  if (points.length < MIN_POINTS_FOR_TREND) return null;

  const mid = Math.floor(points.length / 2);
  const mean = (xs: ProgressPoint[]) =>
    xs.reduce((sum, p) => sum + p.rating, 0) / xs.length;

  const earlier = mean(points.slice(0, mid));
  const later = mean(points.slice(mid));

  return {
    earlier: Math.round(earlier * 10) / 10,
    later: Math.round(later * 10) / 10,
    delta: Math.round((later - earlier) * 10) / 10,
  };
}
