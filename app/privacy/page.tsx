import { BrainCircuit } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { MAIN_CONTENT_ID } from "@/components/SkipToContent";

export const metadata: Metadata = {
  // The root layout applies a "%s · Land" template, so this must not repeat
  // the app name or the tab reads "Privacy Policy — Land · Land".
  title: "Privacy Policy",
  description:
    "What Land collects, what it deliberately does not store, and who it shares data with.",
};

/**
 * Deliberately a static page with no request-time data, so it prerenders
 * fully and stays reachable even if auth, the database or a model provider is
 * down. A privacy policy that 500s when the app does is not a privacy policy.
 *
 * KEEP THIS HONEST. Everything below describes what the code actually does
 * today, not what it is intended to do:
 *   - resume files are never persisted (see ResumeAnalysisTable's comment)
 *   - transcripts are fetched from Hume on demand, not stored
 *   - CONTACT_EMAIL must be a real, monitored address before launch
 * If any of that changes, this page changes in the same PR.
 */
const CONTACT_EMAIL = "privacy@jobinterview-prep.com";
const LAST_UPDATED = "20 September 2026";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="h-header border-b">
        <div className="container h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrainCircuit className="size-6 text-primary" />
            <span className="text-lg font-semibold">Land</span>
          </Link>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} className="flex-1">
        <div className="container py-12 md:py-16">
          <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert font-sans">
            <h1>Privacy Policy</h1>
            <p className="lead text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>

            <p>
              Land is a practice tool. You give it a job description, and it
              runs mock interviews, generates practice questions and reviews
              your CV against that specific role. Doing that means handling
              some genuinely personal information, so this page sets out
              exactly what happens to it.
            </p>

            <h2>The short version</h2>
            <ul>
              <li>
                <strong>Your CV is never stored.</strong> It is sent to
                Google&apos;s Gemini model to be analysed, and then discarded.
                We keep the written feedback, a rating and the file name — not
                the file, and not its contents.
              </li>
              <li>
                <strong>Interview audio never reaches our servers.</strong> The
                voice conversation happens directly between your browser and
                Hume AI. We store a reference to the conversation, its length,
                and the written feedback.
              </li>
              <li>
                <strong>We never see your card details.</strong> Payments are
                handled by Stripe.
              </li>
              <li>
                <strong>We do not sell your data</strong>, and we do not use it
                for advertising.
              </li>
            </ul>

            <h2>What we store</h2>
            <p>
              In our database, hosted in London, we hold only the following:
            </p>
            <ul>
              <li>
                <strong>Your account</strong> — name, email address, profile
                image URL, and whether you have an active subscription. This
                comes from Clerk when you sign in.
              </li>
              <li>
                <strong>Job descriptions you create</strong> — the title,
                seniority and description text you paste in.
              </li>
              <li>
                <strong>Interviews</strong> — how long the conversation lasted,
                an identifier for the conversation held by Hume AI, and the
                written feedback and rating produced afterwards.
              </li>
              <li>
                <strong>Practice questions</strong> — the question, your
                written answer, and the feedback and rating on it.
              </li>
              <li>
                <strong>CV reviews</strong> — the file name, the written
                feedback and a rating. <strong>Not the file itself.</strong>
              </li>
            </ul>

            <h2>What we deliberately do not store</h2>
            <ul>
              <li>
                <strong>CV files.</strong> Your CV is passed to Gemini as part
                of a single request and is not written to disk or to our
                database at any point.
              </li>
              <li>
                <strong>Interview audio or transcripts.</strong> These stay
                with Hume AI. We fetch a transcript from them when you view an
                interview or generate feedback, hold it briefly in memory, and
                do not persist it.
              </li>
              <li>
                <strong>Payment details.</strong> Card numbers go directly to
                Stripe and never touch our systems.
              </li>
              <li>
                <strong>Passwords.</strong> Authentication is handled entirely
                by Clerk.
              </li>
            </ul>

            <h2>Who we share it with</h2>
            <p>
              Running this service means sending some of your information to
              other companies. Each one gets only what it needs:
            </p>
            <ul>
              <li>
                <strong>Google (Gemini)</strong> — receives your CV, your job
                descriptions, your written answers and your interview
                transcripts, in order to generate feedback.
              </li>
              <li>
                <strong>Hume AI</strong> — receives your voice during an
                interview, and holds the audio and transcript of that
                conversation.
              </li>
              <li>
                <strong>Clerk</strong> — handles sign-in and holds your name,
                email and profile image.
              </li>
              <li>
                <strong>Stripe</strong> — handles payments and subscriptions.
              </li>
              <li>
                <strong>Neon</strong> — hosts our database, in London.
              </li>
              <li>
                <strong>Vercel</strong> — hosts the application and keeps
                short-term server logs, which include IP addresses.
              </li>
              <li>
                <strong>Arcjet</strong> — sees request metadata including your
                IP address, to block bots and abuse.
              </li>
            </ul>
            <p>
              Several of these are based outside the UK, so your information
              may be transferred internationally. We only use providers that
              offer appropriate safeguards for those transfers.
            </p>

            <h2>Why we are allowed to hold it</h2>
            <p>
              Under UK GDPR we rely on <strong>performance of a contract</strong>{" "}
              — you asked us to review your CV or run an interview, and we
              cannot do that without processing what you give us. For security
              measures such as rate limiting and bot detection we rely on{" "}
              <strong>legitimate interests</strong>, namely keeping the service
              available and preventing abuse.
            </p>

            <h2>How long we keep it</h2>
            <p>
              Your job descriptions, interviews, questions and CV reviews are
              kept until you delete them or ask us to delete your account.
              There is no automatic expiry — your practice history is the point
              of the product, and it is only useful if it persists.
            </p>
            <p>
              Server logs, which may contain IP addresses, are kept by our
              hosting provider for a short period and then discarded.
            </p>

            <h2>Your rights</h2>
            <p>
              Under UK GDPR you can ask us to give you a copy of your data,
              correct it, delete it, or restrict what we do with it. You can
              also complain to the{" "}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
              >
                Information Commissioner&apos;s Office
              </a>
              .
            </p>
            <p>
              To exercise any of these, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Deletion
              requests are handled manually at present and we will confirm once
              it is done. Deleting your account removes your job descriptions,
              interviews, questions and CV reviews along with it.
            </p>
            <p>
              Data held by Hume AI about your interview conversations is
              governed by their own retention policy. Tell us if you want those
              removed too and we will raise it with them.
            </p>

            <h2>Cookies</h2>
            <p>
              We use only what is needed to keep you signed in and to keep the
              service secure. These are set by Clerk for your session and by
              our bot protection. We do not use advertising or tracking
              cookies.
            </p>

            <h2>Changes</h2>
            <p>
              If we change what we collect or who we share it with, we will
              update this page and change the date at the top.
            </p>

            <h2>Contact</h2>
            <p>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t">
        <div className="container py-8 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-4" />
            <span>Land — AI Powered Job Prep</span>
          </div>
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
