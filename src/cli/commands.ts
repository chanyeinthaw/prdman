import { Args, Command, Options, Prompt } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import { Console, Effect, Option, Schema } from "effect";
import {
  PrdId,
  ImportFileJson,
  StoryId,
  StoryItem,
  StoryItemInputJson,
  StoryItemPartialInputJson,
  STORY_INPUT_HELP,
  Status,
} from "../domain/Story.js";
import { InvalidStoryInputError } from "../domain/errors.js";
import { PasswordService } from "../services/PasswordService.js";
import { StoryRepo } from "../services/StoryRepo.js";

const prdIdArg = Args.text({ name: "prd-id" }).pipe(
  Args.withDescription("PRD ID to scope stories"),
  Args.withSchema(PrdId),
);

const optionalPrdIdArg = Args.text({ name: "prd-id" }).pipe(
  Args.withDescription("PRD ID to scope stories (optional - lists PRDs if omitted)"),
  Args.withSchema(PrdId),
  Args.optional,
);

const storyIdArg = Args.text({ name: "story-id" }).pipe(
  Args.withDescription("Story ID (format: XXX-YYYY)"),
  Args.withSchema(StoryId),
);

const optionalStoryIdArg = Args.text({ name: "story-id" }).pipe(
  Args.withDescription("Story ID (format: XXX-YYYY) - if omitted, deletes entire PRD"),
  Args.withSchema(StoryId),
  Args.optional,
);

const jsonArg = Args.text({ name: "json" }).pipe(
  Args.withDescription("Story as JSON string"),
);

const statusChoices: ReadonlyArray<[string, Status]> = [
  ["todo", "todo"],
  ["done", "done"],
  ["sent-back", "sent-back"],
];

const statusArg = Args.choice(statusChoices, { name: "status" });

const passwordOption = Options.text("password").pipe(
  Options.withAlias("p"),
  Options.withDescription("Password for lock/unlock operations"),
);

const optionalPasswordOption = Options.text("password").pipe(
  Options.withAlias("p"),
  Options.withDescription("Password to force deletion of locked stories"),
  Options.optional,
);

const yesOption = Options.boolean("yes").pipe(
  Options.withAlias("y"),
  Options.withDescription("Skip confirmation prompt"),
  Options.withDefault(false),
);

const filePathArg = Args.text({ name: "file-path" }).pipe(
  Args.withDescription("Path to JSON file to import"),
);

const formatStoryItem = (story: StoryItem): string => {
  const lockIndicator = story.locked ? " [LOCKED]" : "";
  const statusIndicator = `[${story.status}]`;
  return `${statusIndicator} ${story.id}${lockIndicator} (priority: ${story.priority}) - ${story.name}`;
};

const formatStoryItemDetail = (story: StoryItem): string => {
  const lines = [
    `ID: ${story.id}${story.locked ? " [LOCKED]" : ""}`,
    `Priority: ${story.priority}`,
    `Name: ${story.name}`,
    `Status: ${story.status}`,
    `Description: ${story.description}`,
    `Steps:`,
    ...story.steps.map((s, i) => `  ${i + 1}. ${s}`),
  ];

  if (story.acceptanceCriteria.length > 0) {
    lines.push(`Acceptance Criteria:`);
    lines.push(...story.acceptanceCriteria.map((c, i) => `  ${i + 1}. ${c}`));
  }

  if (story.note) {
    lines.push(`Note: ${story.note}`);
  }

  lines.push(`Created: ${story.createdAt.toISOString()}`);
  lines.push(`Updated: ${story.updatedAt.toISOString()}`);

  return lines.join("\n");
};

const createCommand = Command.make(
  "create",
  { prdId: prdIdArg, json: jsonArg },
  Effect.fn(
    function* ({ prdId, json }) {
      const repo = yield* StoryRepo;

      const input = yield* Schema.decodeUnknown(StoryItemInputJson)(json).pipe(
        Effect.mapError(
          (e) =>
            new InvalidStoryInputError({
              reason: e.message,
            }),
        ),
      );

      const story = yield* repo.create(prdId, input);
      yield* Console.log(`Created story: ${story.id}`);
      yield* Console.log(formatStoryItemDetail(story));
    },
    Effect.catchTag("InvalidStoryInputError", (e) =>
      Console.error(`${e.message}\n\n${STORY_INPUT_HELP}`),
    ),
  ),
).pipe(Command.withDescription("Create a new story"));

const updateCommand = Command.make(
  "update",
  { prdId: prdIdArg, storyId: storyIdArg, json: jsonArg },
  Effect.fn(
    function* ({ prdId, storyId, json }) {
      const repo = yield* StoryRepo;

      const partial = yield* Schema.decodeUnknown(StoryItemPartialInputJson)(
        json,
      ).pipe(
        Effect.mapError(
          (e) =>
            new InvalidStoryInputError({
              reason: e.message,
            }),
        ),
      );

      // Warn if only status is being updated
      const keys = Object.keys(partial).filter(
        (k) => (partial as Record<string, unknown>)[k] !== undefined,
      );
      if (keys.length === 1 && keys[0] === "status") {
        yield* Console.log(
          "Tip: Use 'update-status' command to update status (bypasses lock check)",
        );
      }

      const story = yield* repo.update(prdId, storyId, partial);
      yield* Console.log(`Updated story: ${story.id}`);
      yield* Console.log(formatStoryItemDetail(story));
    },
    Effect.catchTag("InvalidStoryInputError", (e) =>
      Console.error(`${e.message}\n\n${STORY_INPUT_HELP}`),
    ),
    Effect.catchTag("StoryNotFoundError", (e) => Console.error(e.message)),
    Effect.catchTag("StoryLockedError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Update a story (blocked if locked)"));

const updateStatusCommand = Command.make(
  "update-status",
  { prdId: prdIdArg, storyId: storyIdArg, status: statusArg },
  Effect.fn(
    function* ({ prdId, storyId, status }) {
      const repo = yield* StoryRepo;
      const story = yield* repo.updateStatus(prdId, storyId, status);
      yield* Console.log(`Updated status of ${story.id} to: ${status}`);
    },
    Effect.catchTag("StoryNotFoundError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Update story status (ignores lock)"));

const formatStoryForDeletion = (story: StoryItem): string => {
  const lockIndicator = story.locked ? " [LOCKED]" : "";
  return `- ${story.id}: ${story.name}${lockIndicator}`;
};

const deleteCommand = Command.make(
  "delete",
  { prdId: prdIdArg, storyId: optionalStoryIdArg, password: optionalPasswordOption, yes: yesOption },
  Effect.fn(
    function* ({ prdId, storyId, password, yes }) {
      const repo = yield* StoryRepo;

      // Single story deletion (existing behavior)
      if (Option.isSome(storyId)) {
        yield* repo.delete(prdId, storyId.value);
        yield* Console.log(`Deleted story: ${storyId.value}`);
        return;
      }

      // PRD deletion flow
      const stories = yield* repo.list(prdId);

      if (stories.length === 0) {
        yield* Console.log(`No stories found for PRD '${prdId}'`);
        return;
      }

      // Check for locked stories
      const lockedStories = stories.filter((story) => story.locked);
      const hasLockedStories = lockedStories.length > 0;

      // Display stories that will be deleted
      yield* Console.log(`The following ${stories.length} story(s) will be deleted:\n`);
      for (const story of stories) {
        yield* Console.log(formatStoryForDeletion(story));
      }
      yield* Console.log("");

      // Require password for locked stories
      if (hasLockedStories && Option.isNone(password)) {
        yield* Console.error(
          `Cannot delete PRD '${prdId}': ${lockedStories.length} story(s) are locked: [${lockedStories.map((s) => s.id).join(", ")}]. Use --password to force.`
        );
        return;
      }

      // Verify password if provided and there are locked stories
      if (hasLockedStories && Option.isSome(password)) {
        const passwordService = yield* PasswordService;
        yield* passwordService.verify(password.value);
      }

      // Confirmation prompt (unless --yes flag is set)
      if (!yes) {
        const confirmed = yield* Prompt.confirm({
          message: `Are you sure you want to delete all ${stories.length} story(s) from PRD '${prdId}'?`,
          initial: false,
        });

        if (!confirmed) {
          yield* Console.log("Deletion cancelled.");
          return;
        }
      }

      // Perform deletion
      const result = hasLockedStories
        ? yield* repo.deletePrdForce(prdId)
        : yield* repo.deletePrd(prdId);

      yield* Console.log(`Deleted ${result.deleted} story(s) from PRD '${prdId}'`);
    },
    Effect.catchTag("StoryNotFoundError", (e) => Console.error(e.message)),
    Effect.catchTag("StoryLockedError", (e) => Console.error(e.message)),
    Effect.catchTag("PrdHasLockedStoriesError", (e) => Console.error(e.message)),
    Effect.catchTag("PasswordNotConfiguredError", (e) => Console.error(e.message)),
    Effect.catchTag("InvalidPasswordError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Delete a story or entire PRD (blocked if locked)"));

const listCommand = Command.make(
  "list",
  { prdId: optionalPrdIdArg },
  Effect.fn(function* ({ prdId }) {
    const repo = yield* StoryRepo;

    if (Option.isNone(prdId)) {
      const prds = yield* repo.listPrds();

      if (prds.length === 0) {
        yield* Console.log("No PRDs found");
        return;
      }

      yield* Console.log("PRDs:\n");
      for (const prd of prds) {
        yield* Console.log(`  ${prd}`);
      }
      return;
    }

    const stories = yield* repo.list(prdId.value);

    if (stories.length === 0) {
      yield* Console.log(`No stories found for PRD: ${prdId.value}`);
      return;
    }

    yield* Console.log(`Stories for PRD: ${prdId.value}\n`);
    for (const story of stories) {
      yield* Console.log(formatStoryItem(story));
    }
  }),
).pipe(Command.withDescription("List stories sorted by priority (or list PRDs if no prd-id)"));

const detailsCommand = Command.make(
  "details",
  { prdId: prdIdArg, storyId: storyIdArg },
  Effect.fn(
    function* ({ prdId, storyId }) {
      const repo = yield* StoryRepo;
      const story = yield* repo.get(prdId, storyId);
      yield* Console.log(formatStoryItemDetail(story));
    },
    Effect.catchTag("StoryNotFoundError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Show details of a story"));

const lockCommand = Command.make(
  "lock",
  { prdId: prdIdArg, storyId: storyIdArg, password: passwordOption },
  Effect.fn(
    function* ({ prdId, storyId, password }) {
      const passwordService = yield* PasswordService;
      const repo = yield* StoryRepo;

      yield* passwordService.verify(password);
      yield* repo.lock(prdId, storyId);
      yield* Console.log(`Locked story: ${storyId}`);
    },
    Effect.catchTag("PasswordNotConfiguredError", (e) =>
      Console.error(e.message),
    ),
    Effect.catchTag("InvalidPasswordError", (e) => Console.error(e.message)),
    Effect.catchTag("StoryNotFoundError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Lock a story (requires password)"));

const unlockCommand = Command.make(
  "unlock",
  { prdId: prdIdArg, storyId: storyIdArg, password: passwordOption },
  Effect.fn(
    function* ({ prdId, storyId, password }) {
      const passwordService = yield* PasswordService;
      const repo = yield* StoryRepo;

      yield* passwordService.verify(password);
      yield* repo.unlock(prdId, storyId);
      yield* Console.log(`Unlocked story: ${storyId}`);
    },
    Effect.catchTag("PasswordNotConfiguredError", (e) =>
      Console.error(e.message),
    ),
    Effect.catchTag("InvalidPasswordError", (e) => Console.error(e.message)),
    Effect.catchTag("StoryNotFoundError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Unlock a story (requires password)"));

const IMPORT_FILE_HELP = `
Expected import file structure:
{
  "id": "prd-id",            // required, PRD ID to import stories into
  "items": [                 // required, array of stories
    {
      "id": "XXX-YYYY",
      "priority": 1,
      "name": "Story name",
      "description": "Details...",
      "steps": ["Step 1", "Step 2"],
      "acceptanceCriteria": ["..."],  // optional
      "status": "todo",
      "note": "..."                   // optional
    }
  ]
}
`.trim();

const importCommand = Command.make(
  "import",
  { filePath: filePathArg },
  Effect.fn(
    function* ({ filePath }) {
      const repo = yield* StoryRepo;
      const fs = yield* FileSystem.FileSystem;

      const content = yield* fs.readFileString(filePath).pipe(
        Effect.mapError(() => new InvalidStoryInputError({ reason: `Failed to read file: ${filePath}` })),
      );

      const importData = yield* Schema.decodeUnknown(ImportFileJson)(content).pipe(
        Effect.mapError(
          (e) =>
            new InvalidStoryInputError({
              reason: e.message,
            }),
        ),
      );

      const { created, skipped } = yield* repo.importFile(importData);
      yield* Console.log(`Imported stories for PRD: ${importData.id}`);
      yield* Console.log(`  Created: ${created}`);
      yield* Console.log(`  Skipped (duplicate IDs): ${skipped}`);
    },
    Effect.catchTag("InvalidStoryInputError", (e) =>
      Console.error(`${e.message}\n\n${IMPORT_FILE_HELP}`),
    ),
  ),
).pipe(Command.withDescription("Import stories from a JSON file"));

export const rootCommand = Command.make("prdman", {}).pipe(
  Command.withDescription("PRD Management CLI"),
  Command.withSubcommands([
    createCommand,
    updateCommand,
    updateStatusCommand,
    deleteCommand,
    listCommand,
    detailsCommand,
    lockCommand,
    unlockCommand,
    importCommand,
  ]),
);
