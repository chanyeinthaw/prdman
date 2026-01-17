import { Command } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import { Console, Effect, Layer } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { rootCommand } from "../src/cli/commands.js";
import { PrdId, StoryId } from "../src/domain/Story.js";
import { StoryRepo } from "../src/services/StoryRepo.js";
import { createTestLayer } from "./test-layers.js";
import * as MockConsole from "./mock-console.js";

const cli = Command.run(rootCommand, {
  name: "prdman",
  version: "1.0.0",
});

// In-memory file system for testing
const createMockFileSystem = () => {
  const files = new Map<string, string>();

  return {
    files,
    layer: Layer.succeed(FileSystem.FileSystem, {
      readFileString: (path: string) =>
        Effect.gen(function* () {
          const content = files.get(path);
          if (content === undefined) {
            return yield* Effect.fail(new Error(`File not found: ${path}`));
          }
          return content;
        }),
      writeFileString: (path: string, content: string) =>
        Effect.sync(() => {
          files.set(path, content);
        }),
      exists: (path: string) => Effect.sync(() => files.has(path)),
      makeDirectory: () => Effect.void,
    } as unknown as FileSystem.FileSystem),
  };
};

// Create test context with mock console and services
const createTestContext = (password: string | null = "test-password") => {
  const {
    repo,
    passwordService,
    layer: servicesLayer,
  } = createTestLayer(password);
  const mockFs = createMockFileSystem();

  const testLayer = Effect.gen(function* () {
    const console = yield* MockConsole.make;
    return Layer.mergeAll(Console.setConsole(console), servicesLayer, mockFs.layer);
  }).pipe(Layer.unwrapEffect);

  return { repo, passwordService, testLayer, mockFs };
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
      "creates a new story",
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
        expect(lines.join("\n")).toContain("Created story: AUTH-0001");

        // Verify story was created
        const stories = yield* Effect.provide(
          StoryRepo.pipe(Effect.flatMap((r) => r.list(PrdId.make("AUTH")))),
          repo.layer,
        );
        expect(stories.length).toBe(1);
        expect(stories[0]?.id).toBe("AUTH-0001");
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
        expect(errorLines.join("\n")).toContain("Invalid story input");
        expect(errorLines.join("\n")).toContain("Expected Story structure");
      }),
    );
  });

  describe("list", () => {
    it.effect(
      "lists stories sorted by priority",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        // Create stories directly in repo
        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0002"),
              priority: 2,
              name: "Second",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
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
      "shows empty message for no stories",
      Effect.fn(function* () {
        const { testLayer } = createTestContext();

        yield* runCli(["list", "AUTH"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("No stories found");
      }),
    );

    it.effect(
      "shows lock indicator for locked stories",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
              priority: 1,
              name: "Locked Story",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0001"));
          }),
          repo.layer,
        );

        yield* runCli(["list", "AUTH"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("[LOCKED]");
      }),
    );

    it.effect(
      "lists all PRDs when no prd-id provided",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
              priority: 1,
              name: "Auth Story",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.create(PrdId.make("PAYMENTS"), {
              id: StoryId.make("PAY-0001"),
              priority: 1,
              name: "Payments Story",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
          }),
          repo.layer,
        );

        yield* runCli(["list"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        const output = lines.join("\n");
        expect(output).toContain("PRDs:");
        expect(output).toContain("AUTH");
        expect(output).toContain("PAYMENTS");
      }),
    );

    it.effect(
      "shows empty message when no PRDs exist",
      Effect.fn(function* () {
        const { testLayer } = createTestContext();

        yield* runCli(["list"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("No PRDs found");
      }),
    );

    it.effect(
      "lists PRDs in sorted order",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("ZEBRA"), {
              id: StoryId.make("ZEB-0001"),
              priority: 1,
              name: "Zebra Story",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.create(PrdId.make("ALPHA"), {
              id: StoryId.make("ALP-0001"),
              priority: 1,
              name: "Alpha Story",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
          }),
          repo.layer,
        );

        yield* runCli(["list"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        const output = lines.join("\n");
        const alphaIdx = output.indexOf("ALPHA");
        const zebraIdx = output.indexOf("ZEBRA");
        expect(alphaIdx).toBeLessThan(zebraIdx);
      }),
    );
  });

  describe("details", () => {
    it.effect(
      "shows story details",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
              priority: 1,
              name: "User Login",
              description: "Implement login flow",
              steps: ["Create form", "Add validation"],
              acceptanceCriteria: ["User can login"],
              status: "todo",
              note: "Important story",
            });
          }),
          repo.layer,
        );

        yield* runCli(["details", "AUTH", "AUTH-0001"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        const output = lines.join("\n");

        expect(output).toContain("ID: AUTH-0001");
        expect(output).toContain("Priority: 1");
        expect(output).toContain("Name: User Login");
        expect(output).toContain("Description: Implement login flow");
        expect(output).toContain("1. Create form");
        expect(output).toContain("2. Add validation");
        expect(output).toContain("Acceptance Criteria:");
        expect(output).toContain("1. User can login");
        expect(output).toContain("Note: Important story");
      }),
    );

    it.effect(
      "shows error for non-existent story",
      Effect.fn(function* () {
        const { testLayer } = createTestContext();

        yield* runCli(["details", "AUTH", "AUTH-9999"], testLayer);

        const errorLines = yield* MockConsole.getErrorLines({
          stripAnsi: true,
        });
        expect(errorLines.join("\n")).toContain("not found");
      }),
    );
  });

  describe("update", () => {
    it.effect(
      "updates story fields",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
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
        expect(lines.join("\n")).toContain("Updated story: AUTH-0001");
        expect(lines.join("\n")).toContain("Name: Updated");
      }),
    );

    it.effect(
      "fails when story is locked",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
              priority: 1,
              name: "Locked",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0001"));
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
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
              priority: 1,
              name: "Test",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0001"));
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
      "deletes a story",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
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
        expect(lines.join("\n")).toContain("Deleted story: AUTH-0001");

        // Verify deletion
        const stories = yield* Effect.provide(
          StoryRepo.pipe(Effect.flatMap((r) => r.list(PrdId.make("AUTH")))),
          repo.layer,
        );
        expect(stories.length).toBe(0);
      }),
    );

    it.effect(
      "fails when story is locked",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext();

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
              priority: 1,
              name: "Locked",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0001"));
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

    describe("PRD deletion", () => {
      it.effect(
        "deletes all stories with --yes when none locked",
        Effect.fn(function* () {
          const { repo, testLayer } = createTestContext();

          yield* Effect.provide(
            Effect.gen(function* () {
              const r = yield* StoryRepo;
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0001"),
                priority: 1,
                name: "First Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0002"),
                priority: 2,
                name: "Second Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "done",
              });
            }),
            repo.layer,
          );

          yield* runCli(["delete", "--yes", "AUTH"], testLayer);

          const lines = yield* MockConsole.getLines({ stripAnsi: true });
          const output = lines.join("\n");
          expect(output).toContain("The following 2 story(s) will be deleted:");
          expect(output).toContain("AUTH-0001: First Story");
          expect(output).toContain("AUTH-0002: Second Story");
          expect(output).toContain("Deleted 2 story(s) from PRD 'AUTH'");

          // Verify all stories deleted
          const stories = yield* Effect.provide(
            StoryRepo.pipe(Effect.flatMap((r) => r.list(PrdId.make("AUTH")))),
            repo.layer,
          );
          expect(stories.length).toBe(0);
        }),
      );

      it.effect(
        "fails with --yes when stories are locked without password",
        Effect.fn(function* () {
          const { repo, testLayer } = createTestContext("secret123");

          yield* Effect.provide(
            Effect.gen(function* () {
              const r = yield* StoryRepo;
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0001"),
                priority: 1,
                name: "Unlocked Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0002"),
                priority: 2,
                name: "Locked Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0002"));
            }),
            repo.layer,
          );

          yield* runCli(["delete", "--yes", "AUTH"], testLayer);

          const errorLines = yield* MockConsole.getErrorLines({
            stripAnsi: true,
          });
          const errorOutput = errorLines.join("\n");
          expect(errorOutput).toContain("Cannot delete PRD 'AUTH'");
          expect(errorOutput).toContain("1 story(s) are locked");
          expect(errorOutput).toContain("AUTH-0002");
          expect(errorOutput).toContain("Use --password to force");

          // Verify stories still exist
          const stories = yield* Effect.provide(
            StoryRepo.pipe(Effect.flatMap((r) => r.list(PrdId.make("AUTH")))),
            repo.layer,
          );
          expect(stories.length).toBe(2);
        }),
      );

      it.effect(
        "succeeds with --password --yes when stories are locked",
        Effect.fn(function* () {
          const { repo, testLayer } = createTestContext("secret123");

          yield* Effect.provide(
            Effect.gen(function* () {
              const r = yield* StoryRepo;
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0001"),
                priority: 1,
                name: "Unlocked Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0002"),
                priority: 2,
                name: "Locked Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0002"));
            }),
            repo.layer,
          );

          yield* runCli(
            ["delete", "--password", "secret123", "--yes", "AUTH"],
            testLayer,
          );

          const lines = yield* MockConsole.getLines({ stripAnsi: true });
          const output = lines.join("\n");
          expect(output).toContain("The following 2 story(s) will be deleted:");
          expect(output).toContain("AUTH-0002: Locked Story [LOCKED]");
          expect(output).toContain("Deleted 2 story(s) from PRD 'AUTH'");

          // Verify all stories deleted
          const stories = yield* Effect.provide(
            StoryRepo.pipe(Effect.flatMap((r) => r.list(PrdId.make("AUTH")))),
            repo.layer,
          );
          expect(stories.length).toBe(0);
        }),
      );

      it.effect(
        "shows message for empty PRD",
        Effect.fn(function* () {
          const { testLayer } = createTestContext();

          yield* runCli(["delete", "--yes", "NONEXISTENT"], testLayer);

          const lines = yield* MockConsole.getLines({ stripAnsi: true });
          expect(lines.join("\n")).toContain(
            "No stories found for PRD 'NONEXISTENT'",
          );
        }),
      );

      it.effect(
        "single story deletion still works with story-id argument",
        Effect.fn(function* () {
          const { repo, testLayer } = createTestContext();

          yield* Effect.provide(
            Effect.gen(function* () {
              const r = yield* StoryRepo;
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0001"),
                priority: 1,
                name: "Keep This",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0002"),
                priority: 2,
                name: "Delete This",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
            }),
            repo.layer,
          );

          yield* runCli(["delete", "AUTH", "AUTH-0002"], testLayer);

          const lines = yield* MockConsole.getLines({ stripAnsi: true });
          expect(lines.join("\n")).toContain("Deleted story: AUTH-0002");

          // Verify only one story deleted
          const stories = yield* Effect.provide(
            StoryRepo.pipe(Effect.flatMap((r) => r.list(PrdId.make("AUTH")))),
            repo.layer,
          );
          expect(stories.length).toBe(1);
          expect(stories[0]?.id).toBe("AUTH-0001");
        }),
      );

      it.effect(
        "fails with wrong password for locked stories",
        Effect.fn(function* () {
          const { repo, testLayer } = createTestContext("secret123");

          yield* Effect.provide(
            Effect.gen(function* () {
              const r = yield* StoryRepo;
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0001"),
                priority: 1,
                name: "Locked Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0001"));
            }),
            repo.layer,
          );

          yield* runCli(
            ["delete", "--password", "wrong", "--yes", "AUTH"],
            testLayer,
          );

          const errorLines = yield* MockConsole.getErrorLines({
            stripAnsi: true,
          });
          expect(errorLines.join("\n")).toContain("Invalid password");

          // Verify stories still exist
          const stories = yield* Effect.provide(
            StoryRepo.pipe(Effect.flatMap((r) => r.list(PrdId.make("AUTH")))),
            repo.layer,
          );
          expect(stories.length).toBe(1);
        }),
      );

      it.effect(
        "shows locked indicator in deletion list",
        Effect.fn(function* () {
          const { repo, testLayer } = createTestContext("secret123");

          yield* Effect.provide(
            Effect.gen(function* () {
              const r = yield* StoryRepo;
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0001"),
                priority: 1,
                name: "Unlocked Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.create(PrdId.make("AUTH"), {
                id: StoryId.make("AUTH-0002"),
                priority: 2,
                name: "Locked Story",
                description: "Desc",
                steps: [],
                acceptanceCriteria: [],
                status: "todo",
              });
              yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0002"));
            }),
            repo.layer,
          );

          yield* runCli(
            ["delete", "--password", "secret123", "--yes", "AUTH"],
            testLayer,
          );

          const lines = yield* MockConsole.getLines({ stripAnsi: true });
          const output = lines.join("\n");
          expect(output).toContain("AUTH-0001: Unlocked Story");
          expect(output).not.toContain("AUTH-0001: Unlocked Story [LOCKED]");
          expect(output).toContain("AUTH-0002: Locked Story [LOCKED]");
        }),
      );
    });
  });

  describe("lock", () => {
    it.effect(
      "locks a story with correct password",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext("secret123");

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
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
        expect(lines.join("\n")).toContain("Locked story: AUTH-0001");

        // Verify lock
        const story = yield* Effect.provide(
          StoryRepo.pipe(
            Effect.flatMap((r) =>
              r.get(PrdId.make("AUTH"), StoryId.make("AUTH-0001")),
            ),
          ),
          repo.layer,
        );
        expect(story.locked).toBe(true);
      }),
    );

    it.effect(
      "fails with wrong password",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext("secret123");

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
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
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
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
      "unlocks a story with correct password",
      Effect.fn(function* () {
        const { repo, testLayer } = createTestContext("secret123");

        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
              priority: 1,
              name: "To Unlock",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
            yield* r.lock(PrdId.make("AUTH"), StoryId.make("AUTH-0001"));
          }),
          repo.layer,
        );

        yield* runCli(
          ["unlock", "--password", "secret123", "AUTH", "AUTH-0001"],
          testLayer,
        );

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        expect(lines.join("\n")).toContain("Unlocked story: AUTH-0001");

        // Verify unlock
        const story = yield* Effect.provide(
          StoryRepo.pipe(
            Effect.flatMap((r) =>
              r.get(PrdId.make("AUTH"), StoryId.make("AUTH-0001")),
            ),
          ),
          repo.layer,
        );
        expect(story.locked).toBe(false);
      }),
    );
  });

  describe("import", () => {
    it.effect(
      "imports stories from a JSON file",
      Effect.fn(function* () {
        const { repo, testLayer, mockFs } = createTestContext();

        const importData = {
          id: "AUTH",
          items: [
            {
              id: "AUTH-0001",
              priority: 1,
              name: "User Login",
              description: "Implement login",
              steps: ["Step 1"],
              status: "todo",
            },
            {
              id: "AUTH-0002",
              priority: 2,
              name: "User Logout",
              description: "Implement logout",
              steps: ["Step 1"],
              status: "todo",
            },
          ],
        };

        mockFs.files.set("/tmp/import.json", JSON.stringify(importData));

        yield* runCli(["import", "/tmp/import.json"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        const output = lines.join("\n");
        expect(output).toContain("Imported stories for PRD: AUTH");
        expect(output).toContain("Created: 2");
        expect(output).toContain("Skipped (duplicate IDs): 0");

        // Verify stories were created
        const stories = yield* Effect.provide(
          StoryRepo.pipe(Effect.flatMap((r) => r.list(PrdId.make("AUTH")))),
          repo.layer,
        );
        expect(stories.length).toBe(2);
        expect(stories[0]?.id).toBe("AUTH-0001");
        expect(stories[1]?.id).toBe("AUTH-0002");
      }),
    );

    it.effect(
      "skips duplicate IDs during import",
      Effect.fn(function* () {
        const { repo, testLayer, mockFs } = createTestContext();

        // Create existing story
        yield* Effect.provide(
          Effect.gen(function* () {
            const r = yield* StoryRepo;
            yield* r.create(PrdId.make("AUTH"), {
              id: StoryId.make("AUTH-0001"),
              priority: 1,
              name: "Existing",
              description: "Desc",
              steps: [],
              acceptanceCriteria: [],
              status: "todo",
            });
          }),
          repo.layer,
        );

        const importData = {
          id: "AUTH",
          items: [
            {
              id: "AUTH-0001",
              priority: 1,
              name: "Duplicate",
              description: "Should be skipped",
              steps: [],
              status: "todo",
            },
            {
              id: "AUTH-0002",
              priority: 2,
              name: "New Story",
              description: "Should be created",
              steps: [],
              status: "todo",
            },
          ],
        };

        mockFs.files.set("/tmp/import.json", JSON.stringify(importData));

        yield* runCli(["import", "/tmp/import.json"], testLayer);

        const lines = yield* MockConsole.getLines({ stripAnsi: true });
        const output = lines.join("\n");
        expect(output).toContain("Created: 1");
        expect(output).toContain("Skipped (duplicate IDs): 1");

        // Verify original story unchanged
        const story = yield* Effect.provide(
          StoryRepo.pipe(
            Effect.flatMap((r) =>
              r.get(PrdId.make("AUTH"), StoryId.make("AUTH-0001")),
            ),
          ),
          repo.layer,
        );
        expect(story.name).toBe("Existing");
      }),
    );

    it.effect(
      "shows error for invalid JSON file",
      Effect.fn(function* () {
        const { testLayer, mockFs } = createTestContext();

        mockFs.files.set("/tmp/invalid.json", '{"invalid": "json"}');

        yield* runCli(["import", "/tmp/invalid.json"], testLayer);

        const errorLines = yield* MockConsole.getErrorLines({
          stripAnsi: true,
        });
        expect(errorLines.join("\n")).toContain("Invalid story input");
        expect(errorLines.join("\n")).toContain("Expected import file structure");
      }),
    );

    it.effect(
      "shows error for non-existent file",
      Effect.fn(function* () {
        const { testLayer } = createTestContext();

        yield* runCli(["import", "/tmp/nonexistent.json"], testLayer);

        const errorLines = yield* MockConsole.getErrorLines({
          stripAnsi: true,
        });
        expect(errorLines.join("\n")).toContain("Failed to read file");
      }),
    );
  });
});
