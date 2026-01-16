import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { PasswordService } from "../src/services/PasswordService.js";
import { createTestPasswordService } from "./test-layers.js";

describe("PasswordService", () => {
  describe("verify", () => {
    it.effect(
      "succeeds with correct password",
      Effect.fn(
        function* () {
          const passwordService = yield* PasswordService;

          // Should not throw
          yield* passwordService.verify("test-password");
        },
        Effect.provide(createTestPasswordService("test-password").layer),
      ),
    );

    it.effect(
      "fails with InvalidPasswordError for wrong password",
      Effect.fn(
        function* () {
          const passwordService = yield* PasswordService;

          const result = yield* passwordService
            .verify("wrong-password")
            .pipe(Effect.flip);

          expect(result._tag).toBe("InvalidPasswordError");
        },
        Effect.provide(createTestPasswordService("test-password").layer),
      ),
    );

    it.effect(
      "fails with PasswordNotConfiguredError when no password set",
      Effect.fn(
        function* () {
          const passwordService = yield* PasswordService;

          const result = yield* passwordService
            .verify("any-password")
            .pipe(Effect.flip);

          expect(result._tag).toBe("PasswordNotConfiguredError");
        },
        Effect.provide(createTestPasswordService(null).layer),
      ),
    );

    it.effect(
      "handles empty password",
      Effect.fn(
        function* () {
          const passwordService = yield* PasswordService;

          // Empty password should work if configured as empty
          yield* passwordService.verify("");
        },
        Effect.provide(createTestPasswordService("").layer),
      ),
    );

    it.effect(
      "fails with InvalidPasswordError for empty input when password is set",
      Effect.fn(
        function* () {
          const passwordService = yield* PasswordService;

          const result = yield* passwordService.verify("").pipe(Effect.flip);

          expect(result._tag).toBe("InvalidPasswordError");
        },
        Effect.provide(createTestPasswordService("test-password").layer),
      ),
    );
  });
});
