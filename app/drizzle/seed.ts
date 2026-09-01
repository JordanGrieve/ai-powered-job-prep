/**
 * Local development fixtures.
 *
 *   npm run db:seed                      # uses SEED_CLERK_USER_ID from .env
 *   npm run db:seed -- user_2abc...      # or pass the id as an argument
 *
 * The Clerk user id has to come from you: users.id is the Clerk id, and the
 * app resolves the signed-in user by it. Sign in once, copy the id from the
 * Clerk dashboard (or from the users table after the webhook fires), and pass
 * it here — then the seeded job infos and interviews will actually be yours.
 *
 * Idempotent: re-running upserts the user and replaces that user's seeded job
 * infos rather than duplicating them.
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import { InterviewTable } from "./schema/interview";
import { jobInfoTable } from "./schema/jobInfo";
import { QuestionTable } from "./schema/question";
import { ResumeAnalysisTable } from "./schema/resumeAnalysis";
import { UserTable } from "./schema/user";

const SEED_MARKER = "[seed]";

const LONG_FEEDBACK = `## Overall: 7/10

You came across as prepared and personable, with a few concrete gaps worth closing before the real thing.

### Communication Clarity: 8/10

Your answers were well structured and easy to follow. You used the STAR shape naturally without signposting it, which reads as experience rather than rehearsal.

- Strong opening summary of your background
- Occasional filler when moving between topics

### Confidence and Emotional State: 6/10

Steady for most of the conversation, with noticeable hesitation on the system-design question.

### Response Quality: 7/10

Relevant and mostly well scoped. The depth was right for the level, though a couple of answers stopped one step short of the trade-off discussion an interviewer is listening for.

1. Name the constraint
2. Name the option you rejected
3. Say why

### Role Fit and Alignment: 7/10

A good match on the day-to-day work. The gap is breadth of production ownership.

> "I'd probably just add an index and see if that helped."

That instinct is right, but say what you would measure first.

### Areas for Improvement

- Rehearse the system-design answer until the hesitation goes
- Close each answer with an explicit trade-off
- Prepare two questions of your own
`;

async function main() {
  const clerkUserId = process.argv[2] ?? process.env.SEED_CLERK_USER_ID;

  if (!clerkUserId) {
    console.error(
      "No Clerk user id supplied.\n\n" +
        "  npm run db:seed -- user_2abc...\n" +
        "or set SEED_CLERK_USER_ID in .env\n\n" +
        "Find it in the Clerk dashboard under Users, or in the users table " +
        "once the webhook has fired for your account.",
    );
    process.exit(1);
  }

  await db
    .insert(UserTable)
    .values({
      id: clerkUserId,
      email: `${clerkUserId}@seed.local`,
      name: "Seed User",
      imageUrl: "https://img.clerk.com/preview.png",
    })
    .onConflictDoNothing({ target: UserTable.id });

  // Replace this user's previously seeded rows so re-running does not
  // duplicate. Interviews and questions cascade with the job info.
  const existing = await db.query.jobInfoTable.findMany({
    where: eq(jobInfoTable.userId, clerkUserId),
    columns: { id: true, name: true },
  });
  for (const row of existing) {
    if (row.name.startsWith(SEED_MARKER)) {
      await db.delete(jobInfoTable).where(eq(jobInfoTable.id, row.id));
    }
  }

  const jobInfos = await db
    .insert(jobInfoTable)
    .values([
      {
        name: `${SEED_MARKER} Senior Frontend Engineer`,
        title: "Senior Frontend Engineer",
        experienceLevel: "senior",
        description:
          "Own the design system and the checkout funnel. React, TypeScript, heavy accessibility and performance focus. You will work directly with design and lead a small team.",
        userId: clerkUserId,
      },
      {
        // Deliberately null title - exercises the nullable column and the
        // "Untitled Job Info" fallbacks in the AI prompt and the Hume session.
        name: `${SEED_MARKER} Backend role, no title`,
        title: null,
        experienceLevel: "mid-level",
        description:
          "Go and Postgres. Event-driven services, a lot of queue work, on-call rotation one week in six.",
        userId: clerkUserId,
      },
      {
        name: `${SEED_MARKER} Junior Data Analyst`,
        title: "Data Analyst",
        experienceLevel: "junior",
        description:
          "SQL, dashboarding and stakeholder reporting. Good first analytics role with a clear mentoring structure.",
        userId: clerkUserId,
      },
    ])
    .returning({ id: jobInfoTable.id });

  const [frontend, backend] = jobInfos;

  // Ratings ascend deliberately so the progress trend has something real to
  // report - computeTrend needs at least 4 points before it will say anything.
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  await db.insert(QuestionTable).values([
    {
      jobId: frontend.id,
      text: "Walk me through how you would audit and improve the Largest Contentful Paint on a checkout page.",
      difficulty: "senior",
      answer:
        "I would start with a Lighthouse trace and look at what the LCP element actually is.",
      feedback:
        "A reasonable starting point, but you stopped before the trade-offs. Name what you would measure next.",
      rating: 4,
      answeredAt: daysAgo(9),
    },
    {
      jobId: frontend.id,
      text: "How do you decide whether a component belongs in the design system?",
      difficulty: "mid-level",
      answer:
        "If it is used in three or more places and carries no domain logic.",
      feedback: "Good rule of thumb, well scoped. You named the constraint.",
      rating: 7,
      answeredAt: daysAgo(6),
    },
    {
      jobId: frontend.id,
      text: "How would you approach making a large data table accessible?",
      difficulty: "mid-level",
      answer:
        "Semantic table markup first, then a caption, scope attributes, and a live region for sort changes.",
      feedback:
        "Strong. You led with semantics rather than reaching for ARIA, which is the right instinct.",
      rating: 8,
      answeredAt: daysAgo(3),
    },
    {
      // Generated but never answered - the normal resting state, and what the
      // progress query must exclude.
      jobId: backend.id,
      text: "Describe how you would make a queue consumer idempotent.",
      difficulty: "mid-level",
    },
  ]);

  await db.insert(ResumeAnalysisTable).values([
    {
      jobInfoId: frontend.id,
      fileName: "cv-draft-1.pdf",
      rating: 5,
      feedback:
        "## Overall\n\nThe experience is there, but the bullets describe duties rather than outcomes.",
      createdAt: daysAgo(8),
    },
    {
      jobInfoId: frontend.id,
      fileName: "cv-draft-2.pdf",
      rating: 8,
      feedback:
        "## Overall\n\nMuch stronger. The rewritten bullets lead with measurable impact.",
      createdAt: daysAgo(1),
    },
  ]);

  await db.insert(InterviewTable).values([
    {
      // Completed, with long markdown feedback - exercises the prose styling
      // in the View Feedback dialog.
      jobInfoId: frontend.id,
      duration: "00:18:42",
      humeChatId: "11111111-1111-4111-8111-111111111111",
      feedback: LONG_FEEDBACK,
      rating: 7,
    },
    {
      // Completed, no feedback yet - shows the Generate Feedback button.
      jobInfoId: frontend.id,
      duration: "00:06:15",
      humeChatId: "22222222-2222-4222-8222-222222222222",
      feedback: null,
    },
    {
      // Never connected (null humeChatId) - excluded from the list, and the
      // detail page should render the explanatory state, not a 404.
      jobInfoId: backend.id,
      duration: "00:00:00",
      humeChatId: null,
      feedback: null,
    },
  ]);

  console.log(
    `Seeded ${jobInfos.length} job infos, 4 questions (3 answered + rated), 2 resume analyses and 3 interviews for ${clerkUserId}.`,
  );
  console.log(
    "Note: the two humeChatIds are fake, so the transcript view will fail " +
      "against the real Hume API. They exist to exercise list/detail states.",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
