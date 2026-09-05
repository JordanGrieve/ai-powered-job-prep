/**
 * REAL Neon + REAL Gemini, through the actual server actions. Only Clerk and
 * Arcjet are stubbed; the database and the model are live.
 *
 *   npm run test:integration
 *
 * Excluded from `npm test` and from CI because it costs money and needs
 * credentials. It exists because the unit suite cannot catch the class of bug
 * it was written for: question generation failed 100% of the time in
 * production conditions while every unit test, the typechecker and the build
 * stayed green, because the failure was a token budget the mocks never
 * exercised.
 *
 * Requires DATABASE_URL, GEMINI_API_KEY and SEED_USER_ID (a Clerk user id with
 * seeded job infos - run `npm run db:seed -- <id>` first).
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const USER_ID = process.env.SEED_USER_ID;

vi.mock("@/app/data/env/server", () => ({
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    ARCJET_KEY: "integration",
    ARCJET_MODE: "DRY_RUN",
  },
}));
vi.mock("@/app/services/clerk/lib/getCurrentUser", () => ({
  getCurrentUser: vi.fn(async () => ({
    userId: process.env.SEED_USER_ID,
    user: { id: process.env.SEED_USER_ID, name: "Integration User" },
    redirectToSignIn: vi.fn(),
  })),
}));
// Simulate a plan that grants everything - entitlement gating has its own
// unit tests; this suite is about the generate/persist path.
vi.mock("@/app/services/clerk/lib/hasPermission", () => ({
  hasPermission: vi.fn(async () => true),
}));
vi.mock("@arcjet/next", () => ({
  default: () => ({ protect: vi.fn(async () => ({ isDenied: () => false })) }),
  tokenBucket: vi.fn(),
  request: vi.fn(async () => ({})),
}));
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema";
import { eq } from "drizzle-orm";
import { createQuestion, reviewAnswer } from "./actions";

let jobInfoId: string;

beforeAll(async () => {
  if (!USER_ID) throw new Error("SEED_USER_ID is required");
  const row = await db.query.jobInfoTable.findFirst({
    where: eq(jobInfoTable.userId, USER_ID),
  });
  if (!row) {
    throw new Error(
      `No job info for ${USER_ID}. Run: npm run db:seed -- ${USER_ID}`,
    );
  }
  jobInfoId = row.id;
});

describe("questions: generate -> answer -> rate -> persist", () => {
  it("completes the whole loop and writes the result", async () => {
    const created = await createQuestion({ jobInfoId, difficulty: "mid-level" });
    expect(created.error, `createQuestion: ${created.error ? created.message : ""}`).toBe(false);
    if (created.error) return;

    expect(created.text.length).toBeGreaterThan(20);

    const reviewed = await reviewAnswer({
      questionId: created.id,
      answer:
        "I would reproduce it locally first, then bisect the change set to find where behaviour diverged, and add a regression test before fixing it.",
    });
    expect(reviewed.error, `reviewAnswer: ${reviewed.error ? reviewed.message : ""}`).toBe(false);
    if (reviewed.error) return;

    expect(reviewed.rating).toBeGreaterThanOrEqual(1);
    expect(reviewed.rating).toBeLessThanOrEqual(10);

    // The point of the exercise: it has to be PERSISTED, not just returned.
    const saved = await db.query.QuestionTable.findFirst({
      where: (q, { eq: e }) => e(q.id, created.id),
    });
    expect(saved?.answer).toBeTruthy();
    expect(saved?.rating).toBe(reviewed.rating);
    expect(saved?.answeredAt).toBeTruthy();
  }, 180_000);
});
