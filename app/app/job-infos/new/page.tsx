import { JobInfoForm } from "@/app/features/jobInfos/components/JobInfoForm";
import { BackLink } from "@/components/BackLink";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";

// The root layout applies a "%s · Land" template. Without this every
// signed-in page shared one generic title, which is WCAG 2.4.2 and makes
// browser tabs and history entries indistinguishable.
export const metadata: Metadata = { title: "New job description" };

export default function JobInfoNewPage() {
  return (
    <div className="container my-4 max-w-5xl space-y-4">
      <BackLink href="/app">Dashboard</BackLink>
      <h1 className="text-3xl md:text-4xl">Create New Job Description</h1>

      <Card>
        <CardContent>
          <JobInfoForm />
        </CardContent>
      </Card>
    </div>
  );
}
