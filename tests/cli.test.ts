import { Command } from "@effect/cli";
import { Console, Effect, Layer } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { rootCommand } from "../src/cli/commands.js";
import { FeatureId, PrdId } from "../src/domain/PrdItem.js";
import { PrdRepo } from "../src/services/PrdRepo.js";
import { createTestLayer } from "./test-layers.js";
import * as MockConsole from "./mock-console.js";

const cli = Command.run(rootCommand, {
  name: "prdman",
  version: "1.0.0",
});

// Create test context with mock console and services
const createTestContext = (password: string | null = "test-password") => {
  const {
    repo,
    passwordService,
    layer: servicesLayer,
  } = createTestLayer(password);

  const testLayer = Effect.gen(function* () {
    const console = yield* MockConsole.make;
    return Layer.mergeAll(Console.setConsole(console), servicesLayer);
  }).pipe(Layer.unwrapEffect);

  return { repo, passwordService, testLayer };
};

// Helper to run CLI command
const runCli = (args: string[], layer: Layer.Layer<any>) =>
  cli(["node", "prdman", ...args]).pipe(
    Effect.catchAll(() => Effect.void), // Catch validation errors
    Effect.provide(layer),
  );

describe("CLI Commands", () => {
  describe("create", () => {
    it.effect(
      "creates a new PRD item",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        const json = JSON.stringify({
          id: "AUTH-0001",
          priority: 1,
          name: "User Login",
          description: "Implement login",
          steps: ["Step 1"],
          status: "todo",
        });

        yield* runCli(["create", "AUTH", json], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("Created PRD item: AUTH-0001");

        // Verify item was created
        const items = yield* Effect.provide(
          PrdRepo.pipe(Effect.flatMap((r) => r.list(FeatureId.make("AUTH")))),
          repo.layer,
        );
        expect(items.length).toBe(1);
        expect(items[0]?.id).toBe("AUTH-0001");
      }),
    );

    it.effect(
      "shows help on invalid JSON input",
      Effect.fn(function* () {
        const { testLayer } = createTestContext();

        yield* runCli(["create", "AUTH", '{"invalid": "json"}'], testLayer);

        const errorLines = yield* MockConsole.getErrorLines({
          stripAnsi: true,
        });
        expect(errorLines.join("\n")).toContain("Invalid PRD input");
        expect(errorLines.join("\n")).toContain("Expected PRD structure");
      }),
    );
  });

  describe("list", () => {
    it.effect(
      "lists PRD items sorted by priority",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        // Create items directly in repo
        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0002"),
              priority: 2,
              name: "Second",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "First",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "done",
            });
          }),
          repo.layer,
        );

        yield* runCli(["list", "AUTH"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        const output = lines.join("\n");

        // Should be sorted by priority
        const firstIdx = output.indexOf("AUTH-0001");
        const secondIdx = output.indexOf("AUTH-0002");
        expect(firstIdx).toBeLessThan(secondIdx);
      }),
    );

    it.effect(
      "shows empty message for no items",
      Effect.fn(function* () {
        const { testLayer } = createTestContext();

        yield* runCli(["list", "AUTH"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("No PRD items found");
      }),
    );

    it.effect(
      "shows lock indicator for locked items",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "Locked Item",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(FeatureId.make("AUTH"), PrdId.make("AUTH-0001"));
          }),
          repo.layer,
        );

        yield* runCli(["list", "AUTH"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("[LOCKED]");
      }),
    );
  });

  describe("update", () => {
    it.effect(
      "updates PRD fields",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "Original",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
          }),
          repo.layer,
        );

        yield* runCli(
          ["update", "AUTH", "AUTH-0001", '{"name": "Updated"}'],
          testLayer,
        );

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("Updated PRD item: AUTH-0001");
        expect(lines.join("\n")).toContain("Name: Updated");
      }),
    );

    it.effect(
      "fails when PRD is locked",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "Locked",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(FeatureId.make("AUTH"), PrdId.make("AUTH-0001"));
          }),
          repo.layer,
        );

        yield* runCli(
          ["update", "AUTH", "AUTH-0001", '{"name": "Updated"}'],
          testLayer,
        );

        const errorLines = yield* MockConsole.getErrorLines({
          stripAnsi: true,
        });
        expect(errorLines.join("\n")).toContain("is locked");
      }),
    );
  });

  describe("update-status", () => {
    it.effect(
      "updates status even when locked",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "Test",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(FeatureId.make("AUTH"), PrdId.make("AUTH-0001"));
          }),
          repo.layer,
        );

        yield* runCli(
          ["update-status", "AUTH", "AUTH-0001", "done"],
          testLayer,
        );

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("Updated status");
        expect(lines.join("\n")).toContain("done");
      }),
    );
  });

  describe("delete", () => {
    it.effect(
      "deletes a PRD item",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "To Delete",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
          }),
          repo.layer,
        );

        yield* runCli(["delete", "AUTH", "AUTH-0001"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("Deleted PRD item: AUTH-0001");

        // Verify deletion
        const items = yield* Effect.provide(
          PrdRepo.pipe(Effect.flatMap((r) => r.list(FeatureId.make("AUTH")))),
          repo.layer,
        );
        expect(items.length).toBe(0);
      }),
    );

    it.effect(
      "fails when PRD is locked",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "Locked",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(FeatureId.make("AUTH"), PrdId.make("AUTH-0001"));
          }),
          repo.layer,
        );

        yield* runCli(["delete", "AUTH", "AUTH-0001"], testLayer);

        const errorLines = yield* MockConsole.getErrorLines({
          stripAnsi: true,
        });
        expect(errorLines.join("\n")).toContain("is locked");
      }),
    );
  });

  describe("lock", () => {
    it.effect(
      "locks a PRD item with correct password",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext("secret123");

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "To Lock",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
          }),
          repo.layer,
        );

        yield* runCli(
          ["lock", "--password", "secret123", "AUTH", "AUTH-0001"],
          testLayer,
        );

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("Locked PRD item: AUTH-0001");

        // Verify lock
        const item = yield* Effect.provide(
          PrdRepo.pipe(
            Effect.flatMap((r) =>
              r.get(FeatureId.make("AUTH"), PrdId.make("AUTH-0001")),
            ),
          ),
          repo.layer,
        );
        expect(item.locked).toBe(true);
      }),
    );

    it.effect(
      "fails with wrong password",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext("secret123");

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "Test",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
          }),
          repo.layer,
        );

        yield* runCli(
          ["lock", "--password", "wrong", "AUTH", "AUTH-0001"],
          testLayer,
        );

        const errorLines = yield* MockConsole.getErrorLines({
          stripAnsi: true,
        });
        expect(errorLines.join("\n")).toContain("Invalid password");
      }),
    );

    it.effect(
      "fails when password not configured",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext(null);

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "Test",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
          }),
          repo.layer,
        );

        yield* runCli(
          ["lock", "--password", "any", "AUTH", "AUTH-0001"],
          testLayer,
        );

        const errorLines = yield* MockConsole.getErrorLines({
          stripAnsi: true,
        });
        expect(errorLines.join("\n")).toContain("Password not configured");
      }),
    );
  });

  describe("unlock", () => {
    it.effect(
      "unlocks a PRD item with correct password",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext("secret123");

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* PrdRepo;
            yield* r.create(FeatureId.make("AUTH"), {
              id: PrdId.make("AUTH-0001"),
              priority: 1,
              name: "To Unlock",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(FeatureId.make("AUTH"), PrdId.make("AUTH-0001"));
          }),
          repo.layer,
        );

        yield* runCli(
          ["unlock", "--password", "secret123", "AUTH", "AUTH-0001"],
          testLayer,
        );

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("Unlocked PRD item: AUTH-0001");

        // Verify unlock
        const item = yield* Effect.provide(
          PrdRepo.pipe(
            Effect.flatMap((r) =>
              r.get(FeatureId.make("AUTH"), PrdId.make("AUTH-0001")),
            ),
          ),
          repo.layer,
        );
        expect(item.locked).toBe(false);
      }),
    );
  });
});
