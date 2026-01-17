import { Schema } from "effect"

export class StoryNotFoundError extends Schema.TaggedError<StoryNotFoundError>()(
  "StoryNotFoundError",
  {
    prdId: Schema.String,
    id: Schema.String,
  }
) {
  override get message() {
    return `Story '${this.id}' not found in PRD '${this.prdId}'`
  }
}

export class StoryLockedError extends Schema.TaggedError<StoryLockedError>()(
  "StoryLockedError",
  {
    id: Schema.String,
  }
) {
  override get message() {
    return `Story '${this.id}' is locked. Use 'unlock' command first.`
  }
}

export class DuplicateIdError extends Schema.TaggedError<DuplicateIdError>()(
  "DuplicateIdError",
  {
    prdId: Schema.String,
    id: Schema.String,
  }
) {
  override get message() {
    return `Story with ID '${this.id}' already exists in PRD '${this.prdId}'`
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

export class InvalidStoryInputError extends Schema.TaggedError<InvalidStoryInputError>()(
  "InvalidStoryInputError",
  {
    reason: Schema.String,
  }
) {
  override get message() {
    return `Invalid story input: ${this.reason}`
  }
}

export class PrdHasLockedStoriesError extends Schema.TaggedError<PrdHasLockedStoriesError>()(
  "PrdHasLockedStoriesError",
  {
    prdId: Schema.String,
    lockedIds: Schema.Array(Schema.String),
  }
) {
  override get message() {
    return `Cannot delete PRD '${this.prdId}': ${this.lockedIds.length} story(s) are locked: [${this.lockedIds.join(", ")}]. Use --password to force.`
  }
}
