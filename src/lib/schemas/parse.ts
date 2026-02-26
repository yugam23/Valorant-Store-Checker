import { ZodSchema } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("schema");

export function parseWithLog<T>(
  schema: ZodSchema<T>,
  data: unknown,
  schemaName: string,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    log.warn(`[${schemaName}] validation failed:`, result.error.issues);
    return null;
  }
  return result.data;
}
