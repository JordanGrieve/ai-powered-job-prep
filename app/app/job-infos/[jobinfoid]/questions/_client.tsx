"use client";

import { createQuestion, reviewAnswer } from "@/app/features/questions/actions";
import type { QuestionDifficulty } from "@/app/drizzle/schema/question";
import { questionDifficulties } from "@/app/drizzle/schema/question";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSwap } from "@/components/ui/loading-swap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorToast } from "@/lib/errorToast";
import { useState, useTransition } from "react";

export type PracticeQuestion = {
  id: string;
  text: string;
  difficulty: QuestionDifficulty;
  // Null until answered. Persisted, so returning to a question shows what you
  // said last time and how it scored, rather than a blank box.
  answer: string | null;
  feedback: string | null;
  rating: number | null;
};

export function QuestionsClient({
  jobInfoId,
  initialQuestions,
  canGenerate,
}: {
  jobInfoId: string;
  initialQuestions: PracticeQuestion[];
  canGenerate: boolean;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [activeId, setActiveId] = useState<string | null>(
    initialQuestions.at(-1)?.id ?? null,
  );
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("mid-level");
  const [draft, setDraft] = useState("");
  const [generating, startGenerating] = useTransition();
  const [reviewing, startReviewing] = useTransition();

  const active = questions.find((q) => q.id === activeId) ?? null;
  // An answered question shows its stored answer; an unanswered one shows the
  // in-progress draft.
  const answerValue = active?.answer ?? draft;
  const isAnswered = active?.answer != null;

  function generate() {
    startGenerating(async () => {
      try {
        const res = await createQuestion({ jobInfoId, difficulty });
        if (res.error) return errorToast(res.message);

        const question: PracticeQuestion = {
          id: res.id,
          text: res.text,
          difficulty,
          answer: null,
          feedback: null,
          rating: null,
        };
        setQuestions((prev) => [...prev, question]);
        setActiveId(question.id);
        setDraft("");
      } catch (error) {
        console.error("[questions] generation threw", error);
        errorToast("Something went wrong. Please try again.");
      }
    });
  }

  function review() {
    if (active == null || isAnswered) return;
    startReviewing(async () => {
      try {
        const res = await reviewAnswer({ questionId: active.id, answer: draft });
        if (res.error) return errorToast(res.message);

        // Fold the result into the list so it survives navigating away and
        // back - the server has persisted the same thing.
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === active.id
              ? { ...q, answer: draft, feedback: res.feedback, rating: res.rating }
              : q,
          ),
        );
        setDraft("");
      } catch (error) {
        console.error("[questions] review threw", error);
        errorToast("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr] w-full">
      <aside className="space-y-4">
        <div className="space-y-2">
          <Select
            value={difficulty}
            onValueChange={(v) => setDifficulty(v as QuestionDifficulty)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {questionDifficulties.map((level) => (
                <SelectItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            onClick={generate}
            disabled={generating || !canGenerate}
          >
            <LoadingSwap isLoading={generating}>
              {questions.length === 0 ? "Generate a question" : "New question"}
            </LoadingSwap>
          </Button>
          {!canGenerate && (
            <p className="text-xs text-muted-foreground">
              You have used all the questions on your plan.
            </p>
          )}
        </div>

        {questions.length > 0 && (
          <ol className="space-y-2">
            {questions.map((question, index) => (
              <li key={question.id}>
                <button
                  onClick={() => {
                    setActiveId(question.id);
                    setDraft("");
                  }}
                  className={`w-full text-left text-sm rounded border px-3 py-2 transition-colors hover:bg-muted ${
                    activeId === question.id ? "border-primary" : ""
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2">
                      <span className="text-muted-foreground tabular-nums mr-2">
                        {index + 1}.
                      </span>
                      {question.text}
                    </span>
                    {question.rating != null && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {question.rating}/10
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </aside>

      <section className="space-y-4 min-w-0">
        {active == null ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Pick a difficulty and generate your first question.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{active.difficulty}</Badge>
                  {active.rating != null && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      Scored {active.rating}/10
                    </span>
                  )}
                </div>
                <p className="text-lg">{active.text}</p>
              </CardContent>
            </Card>

            <Textarea
              value={answerValue}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={isAnswered}
              placeholder="Answer out loud first, then type the gist of what you said."
              className="min-h-[160px]"
            />

            {isAnswered ? (
              <p className="text-sm text-muted-foreground">
                Answered. Generate a new question to keep practising.
              </p>
            ) : (
              <Button
                onClick={review}
                disabled={reviewing || draft.trim().length === 0}
              >
                <LoadingSwap isLoading={reviewing}>
                  Review my answer
                </LoadingSwap>
              </Button>
            )}

            {active.feedback && (
              <Card>
                <CardContent>
                  <MarkdownRenderer>{active.feedback}</MarkdownRenderer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>
    </div>
  );
}
