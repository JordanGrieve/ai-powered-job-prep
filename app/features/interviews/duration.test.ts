import { describe, expect, it } from "vitest";
import {
  MAX_INTERVIEW_SECONDS,
  formatRemaining,
  parseDurationToSeconds,
  remainingSeconds,
} from "./duration";

describe("parseDurationToSeconds", () => {
  it("parses a Hume HH:MM:SS timestamp", () => {
    expect(parseDurationToSeconds("00:00:00")).toBe(0);
    expect(parseDurationToSeconds("00:01:30")).toBe(90);
    expect(parseDurationToSeconds("01:00:00")).toBe(3600);
    expect(parseDurationToSeconds("02:03:04")).toBe(7384);
  });

  // Null is what Hume sends before the first tick. Returning 0 here would read
  // as "no time elapsed" and hold the call open past the cap forever.
  it("returns null for null rather than 0", () => {
    expect(parseDurationToSeconds(null)).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseDurationToSeconds("")).toBeNull();
    expect(parseDurationToSeconds("1:30")).toBeNull();
    expect(parseDurationToSeconds("20 minutes")).toBeNull();
    expect(parseDurationToSeconds("00:00:00.5")).toBeNull();
  });

  it("rejects out-of-range minutes and seconds", () => {
    expect(parseDurationToSeconds("00:75:00")).toBeNull();
    expect(parseDurationToSeconds("00:00:99")).toBeNull();
  });
});

describe("remainingSeconds", () => {
  it("counts down to the cap", () => {
    expect(remainingSeconds(0)).toBe(MAX_INTERVIEW_SECONDS);
    expect(remainingSeconds(60)).toBe(MAX_INTERVIEW_SECONDS - 60);
  });

  it("floors at zero once the cap is passed", () => {
    expect(remainingSeconds(MAX_INTERVIEW_SECONDS)).toBe(0);
    expect(remainingSeconds(MAX_INTERVIEW_SECONDS + 500)).toBe(0);
  });
});

describe("formatRemaining", () => {
  it("formats as M:SS with a padded seconds field", () => {
    expect(formatRemaining(0)).toBe("0:00");
    expect(formatRemaining(9)).toBe("0:09");
    expect(formatRemaining(60)).toBe("1:00");
    expect(formatRemaining(1200)).toBe("20:00");
  });
});
