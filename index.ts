import { Command, ValidationError } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Layer, LogLevel, Logger } from "effect";
import { rootCommand } from "./src/cli/commands.js";
import { STORY_INPUT_HELP } from "./src/domain/Story.js";
import { PasswordService } from "./src/services/PasswordService.js";
import { StoryRepoJsonLayer } from "./src/services/StoryRepoJson.js";

const cli = Command.run(rootCommand, {
  name: "prdman",
  version: "1.0.0",
});

const MainLayer = Layer.mergeAll(StoryRepoJsonLayer, PasswordService.layer).pipe(
  Layer.provideMerge(BunContext.layer),
);

const getValidationErrorMessage = (
  error: ValidationError.ValidationError,
): string => {
  const errorDoc = error.error;
  if (errorDoc && typeof errorDoc === "object" && "value" in errorDoc) {
    const value = (errorDoc as { value?: unknown }).value;
    if (value && typeof value === "object" && "value" in value) {
      return String((value as { value: unknown }).value);
    }
  }
  return "Unknown validation error";
};

const isJsonArgError = (error: ValidationError.ValidationError): boolean => {
  const message = getValidationErrorMessage(error);
  return message.includes("<json>") || message.includes("json");
};

const program = cli(process.argv).pipe(
  Effect.catchIf(
    ValidationError.isValidationError,
    Effect.fn(function* (error) {
      if (isJsonArgError(error)) {
        yield* Console.error(`\n${STORY_INPUT_HELP}`);
      }
    }),
  ),
  Effect.provide(MainLayer),
);

program.pipe(BunRuntime.runMain());
