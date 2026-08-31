import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_LIMIT_MESSAGE, RATE_LIMIT_MESSAGE } from "@/lib/errorToast";

// Every one of these is imported at module scope by actions.ts, so they must
// be mocked before the import below.
//
// app/data/env/server validates 11 real credentials at module load and throws
// without them. Every outbound call is mocked here, so there is nothing for
// that validation to protect.
vi.mock("@/app/data/env/server", () => ({
  env: { ARCJET_KEY: "test", GEMINI_MODEL: "gemini-2.5-flash" },
}));
vi.mock("@/app/services/clerk/lib/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("./permissions", () => ({ canCreateInterview: vi.fn() }));
vi.mock("./db", () => ({
  insertInterview: vi.fn(),
  updateInterview: vi.fn(),
}));
vi.mock("@/app/drizzle/db", () => ({
  db: { query: { jobInfoTable: { findFirst: vi.fn() }, InterviewTable: { findFirst: vi.fn() } } },
}));
vi.mock("@/app/services/ai/interviews", () => ({
  generateAiInterviewFeedback: vi.fn(),
}));
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}));

// vi.mock is hoisted above const declarations, so the shared spy has to be
// created inside vi.hoisted to exist by the time the factory runs.
const { protectMock } = vi.hoisted(() => ({ protectMock: vi.fn() }));
vi.mock("@arcjet/next", () => ({
  default: () => ({ protect: protectMock }),
  tokenBucket: vi.fn(),
  request: vi.fn(async () => ({})),
}));

import { db } from "@/app/drizzle/db";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { generateAiInterviewFeedback } from "@/app/services/ai/interviews";
import { insertInterview, updateInterview as updateInterviewDb } from "./db";
import { canCreateInterview } from "./permissions";
import {
  createInterview,
  generateInterviewFeedback,
  updateInterview,
} from "./actions";

const OWNER = "user_owner";
const OTHER = "user_other";
const JOB_INFO_ID = "11111111-1111-4111-8111-111111111111";
const INTERVIEW_ID = "22222222-2222-4222-8222-222222222222";
const CHAT_ID = "33333333-3333-4333-8333-333333333333";

const findJobInfo = vi.mocked(db.query.jobInfoTable.findFirst);
const findInterview = vi.mocked(db.query.InterviewTable.findFirst);

function signedInAs(userId: string | null, name = "Ada") {
  vi.mocked(getCurrentUser).mockResolvedValue({
    userId,
    redirectToSignIn: vi.fn(),
    user: userId == null ? null : { id: userId, name },
  } as never);
}

function interviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INTERVIEW_ID,
    humeChatId: null,
    feedback: null,
    duration: "00:01:00",
    jobInfo: {
      id: JOB_INFO_ID,
      userId: OWNER,
      description: "d",
      experienceLevel: "junior",
      title: "t",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  protectMock.mockResolvedValue({ isDenied: () => false });
  vi.mocked(canCreateInterview).mockResolvedValue(true);
  vi.mocked(insertInterview).mockResolvedValue({
    id: INTERVIEW_ID,
    jobInfoId: JOB_INFO_ID,
  } as never);
  vi.mocked(updateInterviewDb).mockResolvedValue({
    id: INTERVIEW_ID,
    jobInfoId: JOB_INFO_ID,
  } as never);
});

describe("createInterview", () => {
  it("rejects an unauthenticated caller without writing", async () => {
    signedInAs(null);

    const res = await createInterview({ jobInfoId: JOB_INFO_ID });

    expect(res.error).toBe(true);
    expect(insertInterview).not.toHaveBeenCalled();
  });

  it("rejects a job info belonging to another user without writing", async () => {
    signedInAs(OTHER);
    // The query is scoped by userId, so another user's id simply misses.
    findJobInfo.mockResolvedValue(undefined as never);

    const res = await createInterview({ jobInfoId: JOB_INFO_ID });

    expect(res.error).toBe(true);
    expect(insertInterview).not.toHaveBeenCalled();
  });

  it("returns PLAN_LIMIT before spending a rate-limit token", async () => {
    signedInAs(OWNER);
    vi.mocked(canCreateInterview).mockResolvedValue(false);

    const res = await createInterview({ jobInfoId: JOB_INFO_ID });

    expect(res).toEqual({ error: true, message: PLAN_LIMIT_MESSAGE });
    expect(protectMock).not.toHaveBeenCalled();
    expect(insertInterview).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMIT (not PLAN_LIMIT) when the token bucket is spent", async () => {
    signedInAs(OWNER);
    findJobInfo.mockResolvedValue({ id: JOB_INFO_ID, userId: OWNER } as never);
    protectMock.mockResolvedValue({ isDenied: () => true });

    const res = await createInterview({ jobInfoId: JOB_INFO_ID });

    expect(res).toEqual({ error: true, message: RATE_LIMIT_MESSAGE });
    expect(insertInterview).not.toHaveBeenCalled();
  });

  it("checks ownership before spending a token", async () => {
    signedInAs(OWNER);
    findJobInfo.mockResolvedValue(undefined as never);

    await createInterview({ jobInfoId: JOB_INFO_ID });

    // Probing another user's id must not burn the caller's own budget.
    expect(protectMock).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid job info id", async () => {
    signedInAs(OWNER);

    const res = await createInterview({ jobInfoId: "not-a-uuid" });

    expect(res.error).toBe(true);
    expect(findJobInfo).not.toHaveBeenCalled();
  });

  it("creates the interview on the happy path", async () => {
    signedInAs(OWNER);
    findJobInfo.mockResolvedValue({ id: JOB_INFO_ID, userId: OWNER } as never);

    const res = await createInterview({ jobInfoId: JOB_INFO_ID });

    expect(res).toEqual({ error: false, id: INTERVIEW_ID });
    expect(insertInterview).toHaveBeenCalledWith({
      jobInfoId: JOB_INFO_ID,
      duration: "00:00:00",
    });
  });
});

describe("updateInterview", () => {
  it("rejects an unauthenticated caller without writing", async () => {
    signedInAs(null);

    const res = await updateInterview(INTERVIEW_ID, { duration: "00:01:00" });

    expect(res.error).toBe(true);
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });

  it("rejects an interview owned by another user without writing", async () => {
    signedInAs(OTHER);
    findInterview.mockResolvedValue(interviewRow() as never);

    const res = await updateInterview(INTERVIEW_ID, { duration: "00:01:00" });

    expect(res.error).toBe(true);
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });

  // This is the regression guard the audit asked for. getInterview compares
  // interview.jobInfo.userId to the session user; if `userId: true` is dropped
  // from the column selection during a refactor, the comparison silently
  // degrades to `undefined !== userId` and every interview becomes
  // cross-tenant readable and writable. Simulate that by returning a row whose
  // jobInfo has no userId and assert we still refuse.
  it("refuses when jobInfo.userId is absent from the selection", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(
      interviewRow({
        jobInfo: { id: JOB_INFO_ID, description: "d", experienceLevel: "junior", title: "t" },
      }) as never,
    );

    const res = await updateInterview(INTERVIEW_ID, { duration: "00:01:00" });

    expect(res.error).toBe(true);
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });

  // The test above proves the guard refuses when userId is absent, but it
  // mocks the query - so it would still pass if `userId: true` were deleted
  // from the real selection. This one inspects the actual query the module
  // issues, and DOES fail if that column is dropped.
  it("selects jobInfo.userId in the interview query", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(interviewRow() as never);

    await updateInterview(INTERVIEW_ID, { duration: "00:01:00" });

    const query = findInterview.mock.calls[0][0] as {
      with: { jobInfo: { columns: Record<string, boolean> } };
    };
    expect(query.with.jobInfo.columns.userId).toBe(true);
  });

  it("strips keys outside the allowlist", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(interviewRow() as never);

    const res = await updateInterview(INTERVIEW_ID, {
      feedback: "I am a 10/10 candidate",
      jobInfoId: "44444444-4444-4444-8444-444444444444",
    } as never);

    // .strict() rejects unknown keys outright rather than silently dropping.
    expect(res.error).toBe(true);
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });

  it("rejects a malformed duration", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(interviewRow() as never);

    const res = await updateInterview(INTERVIEW_ID, { duration: "1 hour" });

    expect(res.error).toBe(true);
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });

  it("attaches humeChatId on first write", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(interviewRow() as never);

    const res = await updateInterview(INTERVIEW_ID, { humeChatId: CHAT_ID });

    expect(res).toEqual({ error: false });
    expect(updateInterviewDb).toHaveBeenCalledWith(INTERVIEW_ID, {
      humeChatId: CHAT_ID,
    });
  });

  it("refuses to overwrite an existing humeChatId", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(
      interviewRow({ humeChatId: "existing-chat" }) as never,
    );

    const res = await updateInterview(INTERVIEW_ID, { humeChatId: CHAT_ID });

    expect(res.error).toBe(true);
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });

  it("re-checks the plan limit when attaching humeChatId", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(interviewRow() as never);
    vi.mocked(canCreateInterview).mockResolvedValue(false);

    const res = await updateInterview(INTERVIEW_ID, { humeChatId: CHAT_ID });

    expect(res).toEqual({ error: true, message: PLAN_LIMIT_MESSAGE });
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });
});

describe("generateInterviewFeedback", () => {
  it("rejects an unauthenticated caller", async () => {
    signedInAs(null);

    const res = await generateInterviewFeedback(INTERVIEW_ID);

    expect(res.error).toBe(true);
    expect(generateAiInterviewFeedback).not.toHaveBeenCalled();
  });

  it("rejects an interview owned by another user", async () => {
    signedInAs(OTHER);
    findInterview.mockResolvedValue(interviewRow() as never);

    const res = await generateInterviewFeedback(INTERVIEW_ID);

    expect(res.error).toBe(true);
    expect(generateAiInterviewFeedback).not.toHaveBeenCalled();
  });

  it("refuses when humeChatId is null", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(interviewRow() as never);

    const res = await generateInterviewFeedback(INTERVIEW_ID);

    expect(res.error).toBe(true);
    expect(generateAiInterviewFeedback).not.toHaveBeenCalled();
  });

  it("is idempotent when feedback already exists", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(
      interviewRow({ humeChatId: CHAT_ID, feedback: "already here" }) as never,
    );

    const res = await generateInterviewFeedback(INTERVIEW_ID);

    expect(res).toEqual({ error: false });
    // The expensive path must not run again, and must not overwrite.
    expect(protectMock).not.toHaveBeenCalled();
    expect(generateAiInterviewFeedback).not.toHaveBeenCalled();
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMIT when the feedback bucket is spent", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(
      interviewRow({ humeChatId: CHAT_ID }) as never,
    );
    protectMock.mockResolvedValue({ isDenied: () => true });

    const res = await generateInterviewFeedback(INTERVIEW_ID);

    expect(res).toEqual({ error: true, message: RATE_LIMIT_MESSAGE });
    expect(generateAiInterviewFeedback).not.toHaveBeenCalled();
  });

  it("does not persist when generation fails", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(
      interviewRow({ humeChatId: CHAT_ID }) as never,
    );
    vi.mocked(generateAiInterviewFeedback).mockResolvedValue({
      error: true,
      message: "boom",
    });

    const res = await generateInterviewFeedback(INTERVIEW_ID);

    expect(res).toEqual({ error: true, message: "boom" });
    expect(updateInterviewDb).not.toHaveBeenCalled();
  });

  it("persists generated feedback on the happy path", async () => {
    signedInAs(OWNER);
    findInterview.mockResolvedValue(
      interviewRow({ humeChatId: CHAT_ID }) as never,
    );
    vi.mocked(generateAiInterviewFeedback).mockResolvedValue({
      error: false,
      text: "## Overall: 7/10",
    });

    const res = await generateInterviewFeedback(INTERVIEW_ID);

    expect(res).toEqual({ error: false });
    expect(updateInterviewDb).toHaveBeenCalledWith(INTERVIEW_ID, {
      feedback: "## Overall: 7/10",
    });
  });
});
