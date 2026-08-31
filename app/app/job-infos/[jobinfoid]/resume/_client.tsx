"use client";

import { analyzeResume } from "@/app/features/resume/actions";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { errorToast } from "@/lib/errorToast";
import { useRef, useState, useTransition } from "react";

export function ResumeClient({ jobInfoId }: { jobInfoId: string }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const res = await analyzeResume(formData);
        if (res.error) return errorToast(res.message);
        setAnalysis(res.text);
      } catch (error) {
        console.error("[resume] analysis threw", error);
        errorToast("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="jobInfoId" value={jobInfoId} />

        <div className="space-y-2">
          <Label htmlFor="resume">Your resume</Label>
          <Input
            id="resume"
            name="resume"
            type="file"
            required
            accept="application/pdf,text/plain,text/markdown,.pdf,.txt,.md"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            PDF, .txt or .md, up to 5MB. Gemini cannot read .docx directly —
            export to PDF first. Your file is sent for analysis and is not
            stored.
          </p>
        </div>

        <Button type="submit" disabled={pending || fileName == null}>
          <LoadingSwap isLoading={pending}>
            {analysis ? "Analyse again" : "Analyse my resume"}
          </LoadingSwap>
        </Button>
      </form>

      {analysis && (
        <Card>
          <CardContent>
            <MarkdownRenderer>{analysis}</MarkdownRenderer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
