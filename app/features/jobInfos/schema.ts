import { experienceLevel } from "../../drizzle/schema";
import { z } from "zod";

export const jobInfoSchema = z.object({
  name: z.string().min(1, "Required"),
  title: z.string().min(1).optional(),
  experienceLevel: z.enum(experienceLevel),
  description: z.string().min(1, "Required"),
});
