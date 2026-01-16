import { Effect } from "effect";
import { describe, expect, it, beforeEach } from "@effect/vitest";
import { FeatureId, PrdId, PrdItemInput } from "../src/domain/PrdItem.js";
import { PrdRepo } from "../src/services/PrdRepo.js";
import { createTestRepo } from "./test-layers.js";

describe("PrdRepo", () => {
  const testRepo = createTestRepo();

  beforeEach(() => {
    testRepo.clear();
  });

  const featureId = FeatureId.make("AUTH");

  const createInput = (
    id: string,
    priority: number = 1,
    name: string = "Test PRD",
  ): PrdItemInput =>
    PrdItemInput.make({
      id: PrdId.make(id),
      priority,
      name,
      description: "Test description",
      steps: ["Step 1", "Step 2"],
      status: "todo",
    });

  describe("create", () => {
    it.effect(
      "creates a new PRD item",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        const item = yield* repo.create(featureId, input);

        expect(item.id).toBe("AUTH-0001");
        expect(item.name).toBe("Test PRD");
        expect(item.status).toBe("todo");
        expect(item.locked).toBe(false);
        expect(item.createdAt).toBeInstanceOf(Date);
        expect(item.updatedAt).toBeInstanceOf(Date);
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with DuplicateIdError for duplicate ID",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(featureId, input);
        const result = yield* repo.create(featureId, input).pipe(Effect.flip);

        expect(result._tag).toBe("DuplicateIdError");
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "allows same ID in different features",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("PRD-0001");

        const item1 = yield* repo.create(FeatureId.make("AUTH"), input);
        const item2 = yield* repo.create(FeatureId.make("BILLING"), input);

        expect(item1.id).toBe("PRD-0001");
        expect(item2.id).toBe("PRD-0001");
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("update", () => {
    it.effect(
      "updates PRD fields",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001", 1, "Original Name");

        yield* repo.create(featureId, input);
        const updated = yield* repo.update(featureId, PrdId.make("AUTH-0001"), {
          priority: 5,
          name: "Updated Name",
        });

        expect(updated.priority).toBe(5);
        expect(updated.name).toBe("Updated Name");
        expect(updated.description).toBe("Test description"); // unchanged
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with PrdNotFoundError for non-existent ID",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;

        const result = yield* repo
          .update(featureId, PrdId.make("NOPE-0001"), { priority: 5 })
          .pipe(Effect.flip);

        expect(result._tag).toBe("PrdNotFoundError");
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with PrdLockedError when PRD is locked",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(featureId, input);
        yield* repo.lock(featureId, PrdId.make("AUTH-0001"));

        const result = yield* repo
          .update(featureId, PrdId.make("AUTH-0001"), { priority: 5 })
          .pipe(Effect.flip);

        expect(result._tag).toBe("PrdLockedError");
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("updateStatus", () => {
    it.effect(
      "updates status",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(featureId, input);
        const updated = yield* repo.updateStatus(
          featureId,
          PrdId.make("AUTH-0001"),
          "done",
        );

        expect(updated.status).toBe("done");
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "ignores lock status",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(featureId, input);
        yield* repo.lock(featureId, PrdId.make("AUTH-0001"));

        // Should succeed even when locked
        const updated = yield* repo.updateStatus(
          featureId,
          PrdId.make("AUTH-0001"),
          "sent-back",
        );

        expect(updated.status).toBe("sent-back");
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("delete", () => {
    it.effect(
      "deletes a PRD item",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(featureId, input);
        yield* repo.delete(featureId, PrdId.make("AUTH-0001"));

        const result = yield* repo
          .get(featureId, PrdId.make("AUTH-0001"))
          .pipe(Effect.flip);

        expect(result._tag).toBe("PrdNotFoundError");
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with PrdLockedError when PRD is locked",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(featureId, input);
        yield* repo.lock(featureId, PrdId.make("AUTH-0001"));

        const result = yield* repo
          .delete(featureId, PrdId.make("AUTH-0001"))
          .pipe(Effect.flip);

        expect(result._tag).toBe("PrdLockedError");
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("list", () => {
    it.effect(
      "returns empty array for empty feature",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;

        const items = yield* repo.list(featureId);

        expect(items).toEqual([]);
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "returns items sorted by priority",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;

        yield* repo.create(featureId, createInput("AUTH-0003", 3));
        yield* repo.create(featureId, createInput("AUTH-0001", 1));
        yield* repo.create(featureId, createInput("AUTH-0002", 2));

        const items = yield* repo.list(featureId);

        expect(items.map((i) => i.id)).toEqual([
          "AUTH-0001",
          "AUTH-0002",
          "AUTH-0003",
        ]);
      }, Effect.provide(testRepo.layer)),
    );
  });

  describe("lock/unlock", () => {
    it.effect(
      "locks a PRD item",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(featureId, input);
        yield* repo.lock(featureId, PrdId.make("AUTH-0001"));

        const item = yield* repo.get(featureId, PrdId.make("AUTH-0001"));

        expect(item.locked).toBe(true);
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "unlocks a PRD item",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;
        const input = createInput("AUTH-0001");

        yield* repo.create(featureId, input);
        yield* repo.lock(featureId, PrdId.make("AUTH-0001"));
        yield* repo.unlock(featureId, PrdId.make("AUTH-0001"));

        const item = yield* repo.get(featureId, PrdId.make("AUTH-0001"));

        expect(item.locked).toBe(false);
      }, Effect.provide(testRepo.layer)),
    );

    it.effect(
      "fails with PrdNotFoundError for non-existent ID",
      Effect.fn(function* () {
        const repo = yield* PrdRepo;

        const result = yield* repo
          .lock(featureId, PrdId.make("NOPE-0001"))
          .pipe(Effect.flip);

        expect(result._tag).toBe("PrdNotFoundError");
      }, Effect.provide(testRepo.layer)),
    );
  });
});
