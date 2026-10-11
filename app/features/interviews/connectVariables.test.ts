import { describe, expect, it } from "vitest";
import {
  CONNECT_VARIABLES_BUDGET,
  TRUNCATION_MARKER,
  encodedVariablesLength,
  fitVariablesForConnect,
} from "./connectVariables";

const base = {
  userName: "Jordan Grieve",
  title: "Software Engineer",
  experienceLevel: "junior",
};

function jobAdvert(chars: number) {
  // Newlines and typographic punctuation on purpose: each costs 3 to 9
  // characters once encoded, which is what pushed a real 5,719-character
  // advert to 7,897 in the URL.
  const paragraph =
    "• Build reliable, well-tested endpoints – and keep the customer’s data safe.\n";
  let text = "";
  while (text.length < chars) text += paragraph;
  return text.slice(0, chars);
}

describe("encodedVariablesLength", () => {
  it("counts the URL form, not the raw characters", () => {
    const variables = { ...base, description: "a b\n•" };
    // "a%20b%0A%E2%80%A2" is 17 characters for a 5-character value.
    const rawOnly = encodedVariablesLength({ ...base, description: "" });
    expect(encodedVariablesLength(variables) - rawOnly).toBe(17);
  });
});

describe("fitVariablesForConnect", () => {
  it("leaves a short description untouched", () => {
    const variables = { ...base, description: jobAdvert(800) };

    const result = fitVariablesForConnect(variables);

    expect(result.truncated).toBe(false);
    expect(result.forConnect).toBe(variables);
  });

  it("brings a long advert under budget and marks the cut", () => {
    // The production advert that could not connect: 5,719 characters.
    const variables = { ...base, description: jobAdvert(5719) };
    expect(encodedVariablesLength(variables)).toBeGreaterThan(
      CONNECT_VARIABLES_BUDGET,
    );

    const { forConnect, truncated } = fitVariablesForConnect(variables);

    expect(truncated).toBe(true);
    expect(encodedVariablesLength(forConnect)).toBeLessThanOrEqual(
      CONNECT_VARIABLES_BUDGET,
    );
    expect(forConnect.description.endsWith(TRUNCATION_MARKER)).toBe(true);
    // The cut lands at a word boundary: what was kept is a prefix of the
    // original, and the next character in the original is whitespace.
    const kept = forConnect.description.slice(0, -TRUNCATION_MARKER.length);
    expect(variables.description.startsWith(kept)).toBe(true);
    expect(variables.description.charAt(kept.length)).toMatch(/\s/);
    // Everything else is passed through as-is.
    expect(forConnect.userName).toBe(base.userName);
    expect(forConnect.title).toBe(base.title);
    expect(forConnect.experienceLevel).toBe(base.experienceLevel);
  });

  it("keeps most of the context rather than cutting to nothing", () => {
    const { forConnect } = fitVariablesForConnect({
      ...base,
      description: jobAdvert(10_000),
    });

    // 4 KB of budget holds well over a thousand characters of this advert.
    expect(forConnect.description.length).toBeGreaterThan(1_500);
  });

  it("never splits a surrogate pair", () => {
    // Every character is an astral emoji: 2 UTF-16 units, 12 encoded.
    const emoji = "😀".repeat(2_000);

    const { forConnect } = fitVariablesForConnect(
      { ...base, description: emoji },
      1_000,
    );

    expect(() => encodeURIComponent(forConnect.description)).not.toThrow();
    expect(encodedVariablesLength(forConnect)).toBeLessThanOrEqual(1_000);
  });

  it("honours a custom budget", () => {
    const { forConnect, truncated } = fitVariablesForConnect(
      { ...base, description: jobAdvert(2_000) },
      600,
    );

    expect(truncated).toBe(true);
    expect(encodedVariablesLength(forConnect)).toBeLessThanOrEqual(600);
  });
});
