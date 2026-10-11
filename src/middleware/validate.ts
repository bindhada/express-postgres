
import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { z } from "zod";

type ValidationSource = "body" | "params" | "query";

type ValidatedData = Record<string, unknown>;

export function validate(
  schema: z.ZodType,
  source: ValidationSource,
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      res.status(400).json({
        errors: z.flattenError(result.error),
      });
      return;
    }

    const parsed: unknown = result.data;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      res.status(400).json({
        error: "Expected an object",
      });
      return;
    }

    const previous: unknown = res.locals.validated;

    const existing: ValidatedData =
      typeof previous === "object" &&
      previous !== null &&
      !Array.isArray(previous)
        ? (previous as ValidatedData)
        : {};

    const validated: ValidatedData = {
      ...existing,
      ...(parsed as ValidatedData),
    };

    res.locals.validated = validated;

    next();
  };
}