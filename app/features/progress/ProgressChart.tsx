"use client";

import { useState } from "react";

export type ChartPoint = {
  id: string;
  kind: "interview" | "question" | "resume";
  rating: number;
  at: string; // ISO - Dates do not survive the server/client boundary cleanly
  label: string;
};

const KIND_LABEL: Record<ChartPoint["kind"], string> = {
  interview: "Mock interview",
  question: "Practice question",
  resume: "Resume review",
};

// Geometry. Thin marks, recessive axes - the data is the ink.
const W = 720;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 30 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/**
 * Single series, one hue. The subject is the trajectory, not the three
 * artefact types - colouring by kind would make identity the story and bury
 * the thing the reader actually came for. Kind is carried in the tooltip and
 * the table instead.
 *
 * The scale is fixed 0-10 rather than fitted to the data: an auto-fitted axis
 * would make a 6->7 wobble look like a transformation.
 */
export function ProgressChart({ points }: { points: ChartPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) return null;

  const t0 = new Date(points[0].at).getTime();
  const t1 = new Date(points[points.length - 1].at).getTime();
  const span = Math.max(t1 - t0, 1);

  const x = (p: ChartPoint) =>
    points.length === 1
      ? PAD.left + PLOT_W / 2
      : PAD.left + ((new Date(p.at).getTime() - t0) / span) * PLOT_W;
  const y = (rating: number) => PAD.top + PLOT_H - (rating / 10) * PLOT_H;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p)},${y(p.rating)}`).join(" ");
  const activePoint = active == null ? null : points[active];

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Your ratings over time, ${points.length} scored attempts, from ${points[0].rating} out of 10 to ${points[points.length - 1].rating} out of 10.`}
          onMouseLeave={() => setActive(null)}
        >
          {/* Recessive gridlines at 0/5/10 only - enough to read the scale,
              not enough to compete with the data. */}
          {[0, 5, 10].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {v}
              </text>
            </g>
          ))}

          {activePoint && (
            <line
              x1={x(activePoint)}
              x2={x(activePoint)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              className="stroke-border"
              strokeWidth={1}
            />
          )}

          <path
            d={path}
            fill="none"
            className="stroke-chart-line"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => (
            <g key={p.id}>
              {/* A 2px surface ring keeps overlapping marks separable. */}
              <circle
                cx={x(p)}
                cy={y(p.rating)}
                r={active === i ? 7 : 5}
                className="fill-chart-line stroke-card"
                strokeWidth={2}
              />
              {/* Hit target deliberately larger than the mark. */}
              <circle
                cx={x(p)}
                cy={y(p.rating)}
                r={18}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                tabIndex={0}
                role="button"
                aria-label={`${KIND_LABEL[p.kind]}, ${p.rating} out of 10`}
              />
            </g>
          ))}

          <text
            x={PAD.left}
            y={H - 8}
            className="fill-muted-foreground text-[11px]"
          >
            {new Date(points[0].at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </text>
          {points.length > 1 && (
            <text
              x={W - PAD.right}
              y={H - 8}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {new Date(points[points.length - 1].at).toLocaleDateString(
                undefined,
                { day: "numeric", month: "short" },
              )}
            </text>
          )}
        </svg>

        {activePoint && (
          <div className="pointer-events-none absolute top-0 left-0 w-full">
            <div
              className="inline-block rounded border bg-popover px-3 py-2 text-xs shadow-md"
              style={{
                marginLeft: `calc(${(x(activePoint) / W) * 100}% - 4rem)`,
              }}
            >
              <div className="font-medium tabular-nums">
                {activePoint.rating}/10 · {KIND_LABEL[activePoint.kind]}
              </div>
              <div className="text-muted-foreground line-clamp-2 max-w-[16rem]">
                {activePoint.label}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Identity is never colour-alone, and the numbers stay readable for
          anyone who cannot use the plot. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          View as table
        </summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="font-medium py-1">Date</th>
              <th className="font-medium py-1">Type</th>
              <th className="font-medium py-1 text-right">Rating</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-1 tabular-nums">
                  {new Date(p.at).toLocaleDateString()}
                </td>
                <td className="py-1">{KIND_LABEL[p.kind]}</td>
                <td className="py-1 text-right tabular-nums">{p.rating}/10</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
