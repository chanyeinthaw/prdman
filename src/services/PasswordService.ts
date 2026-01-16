import { FileSystem } from "@effect/platform"
import { Context, Effect, Layer } from "effect"
import {
  InvalidPasswordError,
  PasswordNotConfiguredError,
} from "../domain/errors.js"

const CONFIG_DIR = `${process.env.HOME}/.config/prdman`
const PASSWORD_PATH = `${CONFIG_DIR}/password`

export class PasswordService extends Context.Tag("@prdman/PasswordService")<
  PasswordService,
  {
    readonly verify: (
      password: string
    ) => Effect.Effect<
      void,
      PasswordNotConfiguredError | InvalidPasswordError
    >
  }
>() {
  static readonly layer = Layer.effect(
    PasswordService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem

      const verify = Effect.fn("PasswordService.verify")(function* (
        password: string
      ) {
        const exists = yield* fs.exists(PASSWORD_PATH).pipe(Effect.orDie)
        if (!exists) {
          return yield* new PasswordNotConfiguredError()
        }

        const storedPassword = yield* fs
          .readFileString(PASSWORD_PATH)
          .pipe(Effect.orDie)
        if (storedPassword.trim() !== password) {
          return yield* new InvalidPasswordError()
        }
      })

      return PasswordService.of({ verify })
    })
  )
}
