import { Context, Effect } from "effect"
import type {
  DuplicateIdError,
  PrdLockedError,
  PrdNotFoundError,
} from "../domain/errors.js"
import type {
  FeatureId,
  PrdId,
  PrdItem,
  PrdItemInput,
  PrdItemPartialInput,
  Status,
} from "../domain/PrdItem.js"

export class PrdRepo extends Context.Tag("@prdman/PrdRepo")<
  PrdRepo,
  {
    readonly create: (
      featureId: FeatureId,
      item: PrdItemInput
    ) => Effect.Effect<PrdItem, DuplicateIdError>

    readonly update: (
      featureId: FeatureId,
      id: PrdId,
      partial: PrdItemPartialInput
    ) => Effect.Effect<PrdItem, PrdNotFoundError | PrdLockedError>

    readonly updateStatus: (
      featureId: FeatureId,
      id: PrdId,
      status: Status
    ) => Effect.Effect<PrdItem, PrdNotFoundError>

    readonly delete: (
      featureId: FeatureId,
      id: PrdId
    ) => Effect.Effect<void, PrdNotFoundError | PrdLockedError>

    readonly list: (featureId: FeatureId) => Effect.Effect<readonly PrdItem[]>

    readonly get: (
      featureId: FeatureId,
      id: PrdId
    ) => Effect.Effect<PrdItem, PrdNotFoundError>

    readonly lock: (
      featureId: FeatureId,
      id: PrdId
    ) => Effect.Effect<void, PrdNotFoundError>

    readonly unlock: (
      featureId: FeatureId,
      id: PrdId
    ) => Effect.Effect<void, PrdNotFoundError>
  }
>() {}
