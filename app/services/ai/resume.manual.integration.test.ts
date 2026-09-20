/**
 * TEMPORARY / MANUAL - not part of any suite you want running in CI.
 *
 * Runs the real resume-analysis service against a FABRICATED CV and prints the
 * output, so the prompt can be judged on actual model output rather than on
 * how it reads. Costs one Gemini call.
 *
 *   npm run test:integration -- resume.manual
 *
 * The CV below is invented. It is deliberately written with the faults the
 * system prompt claims to catch - duties instead of outcomes, no metrics,
 * unevidenced adjectives, a skills list padded with "Microsoft Office" - so
 * the output can be checked against a known answer rather than a vague one.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateAiResumeAnalysis } from "./resume";

const OUT = process.env.RESUME_OUT ?? "resume-output.md";

const FABRICATED_CV = `ALEX MORGAN
alex.morgan@example.invalid | 07700 900123 | Manchester, UK

PROFILE
Passionate and hard-working front-end developer with a strong eye for detail.
Excellent communicator and team player. Looking for an exciting new challenge
at a forward-thinking company.

EXPERIENCE

Front-End Developer - Brightwave Digital (Jan 2023 - present)
- Responsible for building new features in the company web application
- Worked with React and JavaScript on a daily basis
- Attended daily stand-ups and sprint planning
- Helped fix bugs reported by the QA team
- Involved in code reviews

Junior Web Developer - Northgate Systems (Sep 2021 - Dec 2022)
- Assisted senior developers with front-end tasks
- Built landing pages using HTML and CSS
- Duties included updating content on the company website
- Took part in the redesign of the customer portal

Intern - Keele Software Society (Jun 2021 - Aug 2021)
- Shadowed developers and learned about the software lifecycle

EDUCATION
BSc Computer Science, 2:1 - Keele University (2018 - 2021)

SKILLS
React, JavaScript, HTML, CSS, Git, Agile, Teamwork, Problem solving,
Microsoft Office, Communication

INTERESTS
Football, hiking, and keeping up to date with the latest technology trends.
`;

const JOB_INFO = {
  title: "Senior Front-End Engineer",
  experienceLevel: "senior" as const,
  description: `We are looking for a Senior Front-End Engineer to join our platform team.

You will own significant parts of our React/Next.js application, mentor two
junior engineers, and be accountable for front-end performance and
accessibility across the product.

Requirements:
- 5+ years building production React applications
- Deep TypeScript experience
- Demonstrable ownership of performance work (Core Web Vitals, bundle size)
- Experience with testing (unit and end-to-end) and CI pipelines
- Track record of mentoring and of leading technical decisions
- WCAG 2.2 AA accessibility experience

Nice to have:
- Next.js App Router and React Server Components
- Design-system or component-library ownership`,
};

describe("resume analysis against a fabricated CV", () => {
  // Skipped unless explicitly asked for. It spends real Gemini credit on every
  // run, so it must not ride along with `npm run test:integration`:
  // Only the exact value "1" opts in - "0" and "false" are truthy strings and
  // would otherwise have spent credit while looking like they disabled it.
  //   RUN_MANUAL=1 npm run test:integration -- resume.manual
  it.skipIf(process.env.RUN_MANUAL !== "1")("produces a rated, structured critique", async () => {
    const started = Date.now();

    const result = await generateAiResumeAnalysis({
      jobInfo: JOB_INFO,
      file: {
        data: new TextEncoder().encode(FABRICATED_CV),
        mediaType: "text/plain",
      },
    });

    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    if (result.error) {
      writeFileSync(OUT, `FAILED after ${seconds}s\n\n${result.message}\n`);
      throw new Error(result.message);
    }

    writeFileSync(
      OUT,
      `took: ${seconds}s\nrating: ${result.rating}/10\nlength: ${result.feedback.length} chars\n\n---\n\n${result.feedback}\n`,
    );

    expect(result.rating).toBeGreaterThanOrEqual(1);
    expect(result.rating).toBeLessThanOrEqual(10);
  });
});
