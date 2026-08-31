import { experienceLevel } from "../../drizzle/schema";
import { z } from "zod";

export const jobInfoSchema = z.object({
  name: z.string().min(1, "Required"),
  // The column is nullable and the form writes null for an empty input, so
  // the schema has to round-trip null as well as undefined.
  title: z.string().min(1).nullish(),
  experienceLevel: z.enum(experienceLevel),
  description: z.string().min(1, "Required"),
});
