import { Effect, Layer } from "effect";
import {
  DuplicateIdError,
  PrdHasLockedStoriesError,
  InvalidPasswordError,
  PasswordNotConfiguredError,
  StoryLockedError,
  StoryNotFoundError,
} from "../src/domain/errors.js";
import {
  PrdId,
  ImportFile,
  StoryId,
  StoryItem,
  StoryItemInput,
  StoryItemPartialInput,
  Status,
} from "../src/domain/Story.js";
import { PasswordService } from "../src/services/PasswordService.js";
import { StoryRepo } from "../src/services/StoryRepo.js";

type DataStore = Map<PrdId, Map<StoryId, StoryItem>>;

export class TestStoryRepo {
  private store: DataStore = new Map();

  private getPrdMap(prdId: PrdId): Map<StoryId, StoryItem> {
    let prdMap = this.store.get(prdId);
    if (!prdMap) {
      prdMap = new Map();
      this.store.set(prdId, prdMap);
    }
    return prdMap;
  }

  readonly layer = Layer.succeed(StoryRepo, {
    create: (prdId: PrdId, input: StoryItemInput) =>
      Effect.gen(this, function* () {
        const prdMap = this.getPrdMap(prdId);

        if (prdMap.has(input.id)) {
          return yield* new DuplicateIdError({ prdId, id: input.id });
        }

        const now = new Date();
        const story = StoryItem.make({
          ...input,
          createdAt: now,
          updatedAt: now,
          locked: false,
        });

        prdMap.set(input.id, story);
        return story;
      }),

    update: (prdId: PrdId, id: StoryId, partial: StoryItemPartialInput) =>
      Effect.gen(this, function* () {
        const prdMap = this.getPrdMap(prdId);
        const existing = prdMap.get(id);

        if (!existing) {
          return yield* new StoryNotFoundError({ prdId, id });
        }

        if (existing.locked) {
          return yield* new StoryLockedError({ id });
        }

        const updated = StoryItem.make({
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

        prdMap.set(id, updated);
        return updated;
      }),

    updateStatus: (prdId: PrdId, id: StoryId, status: Status) =>
      Effect.gen(this, function* () {
        const prdMap = this.getPrdMap(prdId);
        const existing = prdMap.get(id);

        if (!existing) {
          return yield* new StoryNotFoundError({ prdId, id });
        }

        const updated = StoryItem.make({
          ...existing,
          status,
          updatedAt: new Date(),
        });

        prdMap.set(id, updated);
        return updated;
      }),

    delete: (prdId: PrdId, id: StoryId) =>
      Effect.gen(this, function* () {
        const prdMap = this.getPrdMap(prdId);
        const existing = prdMap.get(id);

        if (!existing) {
          return yield* new StoryNotFoundError({ prdId, id });
        }

        if (existing.locked) {
          return yield* new StoryLockedError({ id });
        }

        prdMap.delete(id);
      }),

    list: (prdId: PrdId) =>
      Effect.sync(() => {
        const prdMap = this.getPrdMap(prdId);
        return [...prdMap.values()].sort((a, b) => a.priority - b.priority);
      }),

    get: (prdId: PrdId, id: StoryId) =>
      Effect.gen(this, function* () {
        const prdMap = this.getPrdMap(prdId);
        const story = prdMap.get(id);

        if (!story) {
          return yield* new StoryNotFoundError({ prdId, id });
        }

        return story;
      }),

    lock: (prdId: PrdId, id: StoryId) =>
      Effect.gen(this, function* () {
        const prdMap = this.getPrdMap(prdId);
        const existing = prdMap.get(id);

        if (!existing) {
          return yield* new StoryNotFoundError({ prdId, id });
        }

        const updated = StoryItem.make({
          ...existing,
          locked: true,
          updatedAt: new Date(),
        });

        prdMap.set(id, updated);
      }),

    unlock: (prdId: PrdId, id: StoryId) =>
      Effect.gen(this, function* () {
        const prdMap = this.getPrdMap(prdId);
        const existing = prdMap.get(id);

        if (!existing) {
          return yield* new StoryNotFoundError({ prdId, id });
        }

        const updated = StoryItem.make({
          ...existing,
          locked: false,
          updatedAt: new Date(),
        });

        prdMap.set(id, updated);
      }),

    listPrds: () =>
      Effect.sync(() => {
        return [...this.store.keys()]
          .filter((key) => (this.store.get(key)?.size ?? 0) > 0)
          .sort();
      }),

    importFile: (data: ImportFile) =>
      Effect.gen(this, function* () {
        const prdMap = this.getPrdMap(data.id);
        let created = 0;
        let skipped = 0;

        for (const input of data.items) {
          if (prdMap.has(input.id)) {
            skipped++;
            continue;
          }

          const now = new Date();
          const story = StoryItem.make({
            ...input,
            createdAt: now,
            updatedAt: now,
            locked: false,
          });

          prdMap.set(input.id, story);
          created++;
        }

        return { created, skipped };
      }),

    deletePrd: (prdId: PrdId) =>
      Effect.gen(this, function* () {
        const prdMap = this.store.get(prdId);
        if (!prdMap || prdMap.size === 0) {
          return { deleted: 0 };
        }

        const lockedIds = [...prdMap.values()]
          .filter((story) => story.locked)
          .map((story) => story.id);

        if (lockedIds.length > 0) {
          return yield* new PrdHasLockedStoriesError({ prdId, lockedIds });
        }

        const deleted = prdMap.size;
        this.store.delete(prdId);
        return { deleted };
      }),

    deletePrdForce: (prdId: PrdId) =>
      Effect.sync(() => {
        const prdMap = this.store.get(prdId);
        if (!prdMap || prdMap.size === 0) {
          return { deleted: 0 };
        }

        const deleted = prdMap.size;
        this.store.delete(prdId);
        return { deleted };
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

export const createTestRepo = () => new TestStoryRepo();
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
