import { describe, expect, it } from "vitest";
import { resolveName } from "./resolveName";

describe("resolveName", () => {
  it("prefers the full name", () => {
    expect(
      resolveName({ first_name: "Jordan", last_name: "Grieve", email: "j@x.com" }),
    ).toBe("Jordan Grieve");
  });

  it("uses whichever half is present", () => {
    expect(
      resolveName({ first_name: "Jordan", last_name: null, email: "j@x.com" }),
    ).toBe("Jordan");
    expect(
      resolveName({ first_name: null, last_name: "Grieve", email: "j@x.com" }),
    ).toBe("Grieve");
  });

  // The bug this guards: `${first_name} ${last_name}` on a name-less account
  // wrote the literal "null null" into a notNull column, which then rendered
  // as the avatar initials and reached Gemini as the interviewee's name.
  it("never produces 'null null'", () => {
    expect(
      resolveName({ first_name: null, last_name: null, email: "jordan@x.com" }),
    ).toBe("jordan");
  });

  it("falls back to username before the email local part", () => {
    expect(
      resolveName({
        first_name: null,
        last_name: null,
        username: "jgrieve",
        email: "jordan@x.com",
      }),
    ).toBe("jgrieve");
  });

  it("falls back to the email local part last", () => {
    expect(resolveName({ email: "jordan@x.com" })).toBe("jordan");
  });

  it("trims whitespace-only names", () => {
    expect(
      resolveName({ first_name: "  ", last_name: "  ", email: "jordan@x.com" }),
    ).toBe("jordan");
  });
});
