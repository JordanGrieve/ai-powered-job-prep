import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJobInfoProgress } from "./queries";
import { ProgressChart, type ChartPoint } from "./ProgressChart";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";

const MIN_POINTS_FOR_TREND = 4;

export async function ProgressCard({ jobInfoId }: { jobInfoId: string }) {
  const { points, trend } = await getJobInfoProgress(jobInfoId);

  // Nothing scored yet. Say what to do rather than showing an empty plot.
  if (points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your progress</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Answer a practice question, run a mock interview or upload your CV,
          and your scores will start appearing here.
        </CardContent>
      </Card>
    );
  }

  const chartPoints: ChartPoint[] = points.map((p) => ({
    id: p.id,
    kind: p.kind,
    rating: p.rating,
    at: p.at.toISOString(),
    label: p.label,
  }));

  const latest = points[points.length - 1];
  const remaining = MIN_POINTS_FOR_TREND - points.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          {/* Hero figure: the latest score is the number the reader came for. */}
          <div>
            <p className="text-sm text-muted-foreground">Latest score</p>
            <p className="text-5xl font-semibold tabular-nums leading-none mt-1">
              {latest.rating}
              <span className="text-2xl text-muted-foreground">/10</span>
            </p>
          </div>

          {trend ? (
            <div>
              <p className="text-sm text-muted-foreground">
                First {Math.floor(points.length / 2)} vs last{" "}
                {points.length - Math.floor(points.length / 2)}
              </p>
              <p className="text-2xl font-semibold tabular-nums leading-none mt-2 flex items-center gap-2">
                <span className="text-muted-foreground">{trend.earlier}</span>
                <span className="text-muted-foreground text-base">→</span>
                <span>{trend.later}</span>
                <TrendBadge delta={trend.delta} />
              </p>
            </div>
          ) : (
            // Below four points computeTrend returns null on purpose - two
            // attempts is noise. Say so rather than implying a trend.
            <p className="text-sm text-muted-foreground max-w-xs">
              {remaining} more scored {remaining === 1 ? "attempt" : "attempts"}{" "}
              and we can tell you whether you&apos;re improving.
            </p>
          )}
        </div>

        <ProgressChart points={chartPoints} />
      </CardContent>
    </Card>
  );
}

function TrendBadge({ delta }: { delta: number }) {
  // Direction is never colour-alone - the arrow carries it too.
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-base text-success">
        <ArrowUpRightIcon className="size-4" aria-hidden />+{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-base text-destructive">
        <ArrowDownRightIcon className="size-4" aria-hidden />
        {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-base text-muted-foreground">
      <MinusIcon className="size-4" aria-hidden />
      no change
    </span>
  );
}
