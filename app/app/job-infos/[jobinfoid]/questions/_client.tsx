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

type Question = { id: string; text: string; difficulty: QuestionDifficulty };

export function QuestionsClient({
  jobInfoId,
  initialQuestions,
  canGenerate,
}: {
  jobInfoId: string;
  initialQuestions: Question[];
  canGenerate: boolean;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [active, setActive] = useState<Question | null>(
    initialQuestions.at(-1) ?? null,
  );
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("mid-level");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const [reviewing, startReviewing] = useTransition();

  function generate() {
    startGenerating(async () => {
      try {
        const res = await createQuestion({ jobInfoId, difficulty });
        if (res.error) return errorToast(res.message);

        const question = { id: res.id, text: res.text, difficulty };
        setQuestions((prev) => [...prev, question]);
        setActive(question);
        setAnswer("");
        setFeedback(null);
      } catch (error) {
        console.error("[questions] generation threw", error);
        errorToast("Something went wrong. Please try again.");
      }
    });
  }

  function review() {
    if (active == null) return;
    startReviewing(async () => {
      try {
        const res = await reviewAnswer({ questionId: active.id, answer });
        if (res.error) return errorToast(res.message);
        setFeedback(res.feedback);
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
                    setActive(question);
                    setAnswer("");
                    setFeedback(null);
                  }}
                  className={`w-full text-left text-sm rounded border px-3 py-2 transition-colors hover:bg-muted ${
                    active?.id === question.id ? "border-primary" : ""
                  }`}
                >
                  <span className="text-muted-foreground tabular-nums mr-2">
                    {index + 1}.
                  </span>
                  <span className="line-clamp-2">{question.text}</span>
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
                <Badge variant="outline">{active.difficulty}</Badge>
                <p className="text-lg">{active.text}</p>
              </CardContent>
            </Card>

            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer out loud first, then type the gist of what you said."
              className="min-h-[160px]"
            />

            <Button
              onClick={review}
              disabled={reviewing || answer.trim().length === 0}
            >
              <LoadingSwap isLoading={reviewing}>Review my answer</LoadingSwap>
            </Button>

            {feedback && (
              <Card>
                <CardContent>
                  <MarkdownRenderer>{feedback}</MarkdownRenderer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>
    </div>
  );
}
