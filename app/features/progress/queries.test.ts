import { describe, expect, it, vi } from "vitest";

// queries.ts pulls in the Drizzle client and the env module at import scope.
vi.mock("@/app/data/env/server", () => ({ env: {} }));
vi.mock("@/app/drizzle/db", () => ({ db: { select: vi.fn() } }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));

import { computeTrend, type ProgressPoint } from "./queries";

function points(...ratings: number[]): ProgressPoint[] {
  return ratings.map((rating, i) => ({
    kind: "question",
    id: String(i),
    rating,
    at: new Date(2026, 0, i + 1),
    label: `q${i}`,
  }));
}

describe("computeTrend", () => {
  // The honesty guard: two or three attempts is noise. Reporting "you improved"
  // off that would be telling the user something we cannot actually know.
  it.each([0, 1, 2, 3])("returns null for %i points", (n) => {
    expect(computeTrend(points(...Array(n).fill(5)))).toBeNull();
  });

  it("reports improvement across the halves", () => {
    // first half mean 4, second half mean 8
    expect(computeTrend(points(3, 5, 7, 9))).toEqual({
      earlier: 4,
      later: 8,
      delta: 4,
    });
  });

  it("reports a decline as a negative delta rather than hiding it", () => {
    expect(computeTrend(points(9, 7, 5, 3))).toEqual({
      earlier: 8,
      later: 4,
      delta: -4,
    });
  });

  it("reports no movement as a zero delta", () => {
    expect(computeTrend(points(6, 6, 6, 6))).toEqual({
      earlier: 6,
      later: 6,
      delta: 0,
    });
  });

  it("puts the middle point in the later half when the count is odd", () => {
    // 5 points -> mid = 2, so earlier is [1,2] and later is [3,4,5]
    const trend = computeTrend(points(1, 2, 3, 4, 5));
    expect(trend).toEqual({ earlier: 1.5, later: 4, delta: 2.5 });
  });

  it("rounds to one decimal place", () => {
    // means are 3.5 and 6.666..., which must not leak float noise into the UI
    const trend = computeTrend(points(3, 4, 6, 7, 7));
    expect(trend).toEqual({ earlier: 3.5, later: 6.7, delta: 3.2 });
  });
});
