import { Schema } from "effect"

export class PrdNotFoundError extends Schema.TaggedError<PrdNotFoundError>()(
  "PrdNotFoundError",
  {
    featureId: Schema.String,
    id: Schema.String,
  }
) {
  override get message() {
    return `PRD item '${this.id}' not found in feature '${this.featureId}'`
  }
}

export class PrdLockedError extends Schema.TaggedError<PrdLockedError>()(
  "PrdLockedError",
  {
    id: Schema.String,
  }
) {
  override get message() {
    return `PRD item '${this.id}' is locked. Use 'unlock' command first.`
  }
}

export class DuplicateIdError extends Schema.TaggedError<DuplicateIdError>()(
  "DuplicateIdError",
  {
    featureId: Schema.String,
    id: Schema.String,
  }
) {
  override get message() {
    return `PRD item with ID '${this.id}' already exists in feature '${this.featureId}'`
  }
}

export class InvalidPasswordError extends Schema.TaggedError<InvalidPasswordError>()(
  "InvalidPasswordError",
  {}
) {
  override get message() {
    return "Invalid password"
  }
}

export class PasswordNotConfiguredError extends Schema.TaggedError<PasswordNotConfiguredError>()(
  "PasswordNotConfiguredError",
  {}
) {
  override get message() {
    return "Password not configured. Please create ~/.config/prdman/password file."
  }
}

export class InvalidPrdInputError extends Schema.TaggedError<InvalidPrdInputError>()(
  "InvalidPrdInputError",
  {
    reason: Schema.String,
  }
) {
  override get message() {
    return `Invalid PRD input: ${this.reason}`
  }
}
