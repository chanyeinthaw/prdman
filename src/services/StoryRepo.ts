import { Context, Effect } from "effect"
import type {
  DuplicateIdError,
  PrdHasLockedStoriesError,
  StoryLockedError,
  StoryNotFoundError,
} from "../domain/errors.js"
import type {
  PrdId,
  ImportFile,
  StoryId,
  StoryItem,
  StoryItemInput,
  StoryItemPartialInput,
  Status,
} from "../domain/Story.js"

export class StoryRepo extends Context.Tag("@prdman/StoryRepo")<
  StoryRepo,
  {
    readonly create: (
      prdId: PrdId,
      story: StoryItemInput
    ) => Effect.Effect<StoryItem, DuplicateIdError>

    readonly update: (
      prdId: PrdId,
      id: StoryId,
      partial: StoryItemPartialInput
    ) => Effect.Effect<StoryItem, StoryNotFoundError | StoryLockedError>

    readonly updateStatus: (
      prdId: PrdId,
      id: StoryId,
      status: Status
    ) => Effect.Effect<StoryItem, StoryNotFoundError>

    readonly delete: (
      prdId: PrdId,
      id: StoryId
    ) => Effect.Effect<void, StoryNotFoundError | StoryLockedError>

    readonly list: (prdId: PrdId) => Effect.Effect<readonly StoryItem[]>

    readonly get: (
      prdId: PrdId,
      id: StoryId
    ) => Effect.Effect<StoryItem, StoryNotFoundError>

    readonly lock: (
      prdId: PrdId,
      id: StoryId
    ) => Effect.Effect<void, StoryNotFoundError>

    readonly unlock: (
      prdId: PrdId,
      id: StoryId
    ) => Effect.Effect<void, StoryNotFoundError>

    readonly listPrds: () => Effect.Effect<readonly PrdId[]>

    readonly importFile: (
      data: ImportFile
    ) => Effect.Effect<
      { created: number; skipped: number },
      DuplicateIdError
    >

    readonly deletePrd: (
      prdId: PrdId
    ) => Effect.Effect<{ deleted: number }, PrdHasLockedStoriesError>

    readonly deletePrdForce: (
      prdId: PrdId
    ) => Effect.Effect<{ deleted: number }>
  }
>() {}
