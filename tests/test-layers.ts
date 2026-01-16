import { Effect, Layer } from "effect";
import {
  DuplicateIdError,
  InvalidPasswordError,
  PasswordNotConfiguredError,
  PrdLockedError,
  PrdNotFoundError,
} from "../src/domain/errors.js";
import {
  FeatureId,
  PrdId,
  PrdItem,
  PrdItemInput,
  PrdItemPartialInput,
  Status,
} from "../src/domain/PrdItem.js";
import { PasswordService } from "../src/services/PasswordService.js";
import { PrdRepo } from "../src/services/PrdRepo.js";

type DataStore = Map<FeatureId, Map<PrdId, PrdItem>>;

export class TestPrdRepo {
  private store: DataStore = new Map();

  private getFeatureMap(featureId: FeatureId): Map<PrdId, PrdItem> {
    let featureMap = this.store.get(featureId);
    if (!featureMap) {
      featureMap = new Map();
      this.store.set(featureId, featureMap);
    }
    return featureMap;
  }

  readonly layer = Layer.succeed(PrdRepo, {
    create: (featureId: FeatureId, input: PrdItemInput) =>
      Effect.gen(this, function* () {
        const featureMap = this.getFeatureMap(featureId);

        if (featureMap.has(input.id)) {
          return yield* new DuplicateIdError({ featureId, id: input.id });
        }

        const now = new Date();
        const item = PrdItem.make({
          ...input,
          createdAt: now,
          updatedAt: now,
          locked: false,
        });

        featureMap.set(input.id, item);
        return item;
      }),

    update: (featureId: FeatureId, id: PrdId, partial: PrdItemPartialInput) =>
      Effect.gen(this, function* () {
        const featureMap = this.getFeatureMap(featureId);
        const existing = featureMap.get(id);

        if (!existing) {
          return yield* new PrdNotFoundError({ featureId, id });
        }

        if (existing.locked) {
          return yield* new PrdLockedError({ id });
        }

        const updated = PrdItem.make({
          ...existing,
          ...(partial.priority !== undefined && { priority: partial.priority }),
          ...(partial.name !== undefined && { name: partial.name }),
          ...(partial.description !== undefined && {
            description: partial.description,
          }),
          ...(partial.steps !== undefined && { steps: partial.steps }),
          ...(partial.acceptanceCriteria !== undefined && {
            acceptanceCriteria: partial.acceptanceCriteria,
          }),
          ...(partial.status !== undefined && { status: partial.status }),
          ...(partial.note !== undefined && { note: partial.note }),
          updatedAt: new Date(),
        });

        featureMap.set(id, updated);
        return updated;
      }),

    updateStatus: (featureId: FeatureId, id: PrdId, status: Status) =>
      Effect.gen(this, function* () {
        const featureMap = this.getFeatureMap(featureId);
        const existing = featureMap.get(id);

        if (!existing) {
          return yield* new PrdNotFoundError({ featureId, id });
        }

        const updated = PrdItem.make({
          ...existing,
          status,
          updatedAt: new Date(),
        });

        featureMap.set(id, updated);
        return updated;
      }),

    delete: (featureId: FeatureId, id: PrdId) =>
      Effect.gen(this, function* () {
        const featureMap = this.getFeatureMap(featureId);
        const existing = featureMap.get(id);

        if (!existing) {
          return yield* new PrdNotFoundError({ featureId, id });
        }

        if (existing.locked) {
          return yield* new PrdLockedError({ id });
        }

        featureMap.delete(id);
      }),

    list: (featureId: FeatureId) =>
      Effect.sync(() => {
        const featureMap = this.getFeatureMap(featureId);
        return [...featureMap.values()].sort((a, b) => a.priority - b.priority);
      }),

    get: (featureId: FeatureId, id: PrdId) =>
      Effect.gen(this, function* () {
        const featureMap = this.getFeatureMap(featureId);
        const item = featureMap.get(id);

        if (!item) {
          return yield* new PrdNotFoundError({ featureId, id });
        }

        return item;
      }),

    lock: (featureId: FeatureId, id: PrdId) =>
      Effect.gen(this, function* () {
        const featureMap = this.getFeatureMap(featureId);
        const existing = featureMap.get(id);

        if (!existing) {
          return yield* new PrdNotFoundError({ featureId, id });
        }

        const updated = PrdItem.make({
          ...existing,
          locked: true,
          updatedAt: new Date(),
        });

        featureMap.set(id, updated);
      }),

    unlock: (featureId: FeatureId, id: PrdId) =>
      Effect.gen(this, function* () {
        const featureMap = this.getFeatureMap(featureId);
        const existing = featureMap.get(id);

        if (!existing) {
          return yield* new PrdNotFoundError({ featureId, id });
        }

        const updated = PrdItem.make({
          ...existing,
          locked: false,
          updatedAt: new Date(),
        });

        featureMap.set(id, updated);
      }),
  });

  clear() {
    this.store.clear();
  }
}

export class TestPasswordService {
  constructor(private password: string | null = "test-password") {}

  readonly layer = Layer.succeed(PasswordService, {
    verify: (password: string) =>
      Effect.gen(this, function* () {
        if (this.password === null) {
          return yield* new PasswordNotConfiguredError();
        }

        if (password !== this.password) {
          return yield* new InvalidPasswordError();
        }
      }),
  });

  setPassword(password: string | null) {
    this.password = password;
  }
}

export const createTestRepo = () => new TestPrdRepo();
export const createTestPasswordService = (
  password: string | null = "test-password",
) => new TestPasswordService(password);

export const createTestLayer = (password: string | null = "test-password") => {
  const repo = createTestRepo();
  const passwordService = createTestPasswordService(password);
  return {
    repo,
    passwordService,
    layer: Layer.mergeAll(repo.layer, passwordService.layer),
  };
};
