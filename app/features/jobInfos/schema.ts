import { experienceLevel } from "../../drizzle/schema";
import { z } from "zod";

// Bounds mirror the varchar lengths on jobInfoTable. The description in
// particular is billed on every Gemini call and sent to Hume as a session
// variable on every interview start, so it cannot be unbounded.
export const jobInfoSchema = z.object({
  name: z.string().min(1, "Required").max(200),
  // The column is nullable and the form writes null for an empty input, so
  // the schema has to round-trip null as well as undefined.
  title: z.string().min(1).max(200).nullish(),
  experienceLevel: z.enum(experienceLevel),
  description: z
    .string()
    .min(1, "Required")
    .max(10000, "Description must be 10,000 characters or fewer"),
});
