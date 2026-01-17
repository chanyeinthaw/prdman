import { Effect } from "effect";
import { describe, expect, it, beforeEach } from "@effect/vitest";
import { PrdId, StoryId, StoryItemInput } from "../src/domain/Story.js";
import { StoryRepo } from "../src/services/StoryRepo.js";
import { createTestRepo } from "./test-layers.js";

describe("StoryRepo", () => {
  const testRepo = createTestRepo();

  beforeEach(() => {
    testRepo.clear();
  });

  const prdId = PrdId.make("AUTH");

  const createInput = (
    id: string,
    priority: number = 1,
    name: string = "Test Story",
  ): StoryItemInput =>
    StoryItemInput.make({
      id: StoryId.make(id),
      priority,
      name,
      description: "Test description",
      steps: ["Step 1", "Step 2"],
      status: "todo",
    });

  describe("create", () => {
    it.effect(
      "creates a new story",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        const story = yield* repo.create(prdId, input);

        expect(story.id).toBe("AUTH-0001");
        expect(story.name).toBe("Test Story");
        expect(story.status).toBe("todo");
        expect(story.locked).toBe(false);
        expect(story.createdAt).toBeInstanceOf(Date);
        expect(story.updatedAt).toBeInstanceOf(Date);
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with DuplicateIdError for duplicate ID",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(prdId, input);
        const result = yield* repo.create(prdId, input).pipe(Effect.flip);

        expect(result._tag).toBe("DuplicateIdError");
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "allows same ID in different PRDs",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("STORY-0001");

        const story1 = yield* repo.create(PrdId.make("AUTH"), input);
        const story2 = yield* repo.create(PrdId.make("BILLING"), input);

        expect(story1.id).toBe("STORY-0001");
        expect(story2.id).toBe("STORY-0001");
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("update", () => {
    it.effect(
      "updates story fields",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001", 1, "Original Name");

        yield* repo.create(prdId, input);
        const updated = yield* repo.update(prdId, StoryId.make("AUTH-0001"), {
          priority: 5,
          name: "Updated Name",
        });

        expect(updated.priority).toBe(5);
        expect(updated.name).toBe("Updated Name");
        expect(updated.description).toBe("Test description"); // unchanged
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with StoryNotFoundError for non-existent ID",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;

        const result = yield* repo
          .update(prdId, StoryId.make("NOPE-0001"), { priority: 5 })
          .pipe(Effect.flip);

        expect(result._tag).toBe("StoryNotFoundError");
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with StoryLockedError when story is locked",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(prdId, input);
        yield* repo.lock(prdId, StoryId.make("AUTH-0001"));

        const result = yield* repo
          .update(prdId, StoryId.make("AUTH-0001"), { priority: 5 })
          .pipe(Effect.flip);

        expect(result._tag).toBe("StoryLockedError");
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("updateStatus", () => {
    it.effect(
      "updates status",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(prdId, input);
        const updated = yield* repo.updateStatus(
          prdId,
          StoryId.make("AUTH-0001"),
          "done",
        );

        expect(updated.status).toBe("done");
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "ignores lock status",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(prdId, input);
        yield* repo.lock(prdId, StoryId.make("AUTH-0001"));

        // Should succeed even when locked
        const updated = yield* repo.updateStatus(
          prdId,
          StoryId.make("AUTH-0001"),
          "sent-back",
        );

        expect(updated.status).toBe("sent-back");
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("delete", () => {
    it.effect(
      "deletes a story",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(prdId, input);
        yield* repo.delete(prdId, StoryId.make("AUTH-0001"));

        const result = yield* repo
          .get(prdId, StoryId.make("AUTH-0001"))
          .pipe(Effect.flip);

        expect(result._tag).toBe("StoryNotFoundError");
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with StoryLockedError when story is locked",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(prdId, input);
        yield* repo.lock(prdId, StoryId.make("AUTH-0001"));

        const result = yield* repo
          .delete(prdId, StoryId.make("AUTH-0001"))
          .pipe(Effect.flip);

        expect(result._tag).toBe("StoryLockedError");
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("list", () => {
    it.effect(
      "returns empty array for empty PRD",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;

        const stories = yield* repo.list(prdId);

        expect(stories).toEqual([]);
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "returns stories sorted by priority",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;

        yield* repo.create(prdId, createInput("AUTH-0003", 3));
        yield* repo.create(prdId, createInput("AUTH-0001", 1));
        yield* repo.create(prdId, createInput("AUTH-0002", 2));

        const stories = yield* repo.list(prdId);

        expect(stories.map((s) => s.id)).toEqual([
          "AUTH-0001",
          "AUTH-0002",
          "AUTH-0003",
        ]);
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("lock/unlock", () => {
    it.effect(
      "locks a story",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(prdId, input);
        yield* repo.lock(prdId, StoryId.make("AUTH-0001"));

        const story = yield* repo.get(prdId, StoryId.make("AUTH-0001"));

        expect(story.locked).toBe(true);
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "unlocks a story",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(prdId, input);
        yield* repo.lock(prdId, StoryId.make("AUTH-0001"));
        yield* repo.unlock(prdId, StoryId.make("AUTH-0001"));

        const story = yield* repo.get(prdId, StoryId.make("AUTH-0001"));

        expect(story.locked).toBe(false);
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with StoryNotFoundError for non-existent ID",
      Effect.fn(function* () {
        const repo = yield* StoryRepo;

        const result = yield* repo
          .lock(prdId, StoryId.make("NOPE-0001"))
          .pipe(Effect.flip);

        expect(result._tag).toBe("StoryNotFoundError");
      }, Effect.provide(testRepo.layer)),
    );
  });
});
