import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { z } from "zod";

type ValidationSource = "body" | "params" | "query";

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

    res.locals.validated = result.data;
    next();
  };
}