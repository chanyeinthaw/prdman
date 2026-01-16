import { Args, Command, Options, Prompt } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import { Console, Effect, Option, Schema } from "effect";
import {
  FeatureId,
  ImportFileJson,
  PrdId,
  PrdItem,
  PrdItemInputJson,
  PrdItemPartialInputJson,
  PRD_INPUT_HELP,
  Status,
} from "../domain/PrdItem.js";
import { InvalidPrdInputError } from "../domain/errors.js";
import { PasswordService } from "../services/PasswordService.js";
import { PrdRepo } from "../services/PrdRepo.js";

const featureIdArg = Args.text({ name: "feature-id" }).pipe(
  Args.withDescription("Feature ID to scope PRD items"),
  Args.withSchema(FeatureId),
);

const optionalFeatureIdArg = Args.text({ name: "feature-id" }).pipe(
  Args.withDescription("Feature ID to scope PRD items (optional - lists features if omitted)"),
  Args.withSchema(FeatureId),
  Args.optional,
);

const prdIdArg = Args.text({ name: "prd-id" }).pipe(
  Args.withDescription("PRD item ID (format: XXX-YYYY)"),
  Args.withSchema(PrdId),
);

const optionalPrdIdArg = Args.text({ name: "prd-id" }).pipe(
  Args.withDescription("PRD item ID (format: XXX-YYYY) - if omitted, deletes entire feature"),
  Args.withSchema(PrdId),
  Args.optional,
);

const jsonArg = Args.text({ name: "json" }).pipe(
  Args.withDescription("PRD item as JSON string"),
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
  Options.withDescription("Password to force deletion of locked PRDs"),
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

const formatPrdItem = (item: PrdItem): string => {
  const lockIndicator = item.locked ? " [LOCKED]" : "";
  const statusIndicator = `[${item.status}]`;
  return `${statusIndicator} ${item.id}${lockIndicator} (priority: ${item.priority}) - ${item.name}`;
};

const formatPrdItemDetail = (item: PrdItem): string => {
  const lines = [
    `ID: ${item.id}${item.locked ? " [LOCKED]" : ""}`,
    `Priority: ${item.priority}`,
    `Name: ${item.name}`,
    `Status: ${item.status}`,
    `Description: ${item.description}`,
    `Steps:`,
    ...item.steps.map((s, i) => `  ${i + 1}. ${s}`),
  ];

  if (item.acceptanceCriteria.length > 0) {
    lines.push(`Acceptance Criteria:`);
    lines.push(...item.acceptanceCriteria.map((c, i) => `  ${i + 1}. ${c}`));
  }

  if (item.note) {
    lines.push(`Note: ${item.note}`);
  }

  lines.push(`Created: ${item.createdAt.toISOString()}`);
  lines.push(`Updated: ${item.updatedAt.toISOString()}`);

  return lines.join("\n");
};

const createCommand = Command.make(
  "create",
  { featureId: featureIdArg, json: jsonArg },
  Effect.fn(
    function* ({ featureId, json }) {
      const repo = yield* PrdRepo;

      const input = yield* Schema.decodeUnknown(PrdItemInputJson)(json).pipe(
        Effect.mapError(
          (e) =>
            new InvalidPrdInputError({
              reason: e.message,
            }),
        ),
      );

      const item = yield* repo.create(featureId, input);
      yield* Console.log(`Created PRD item: ${item.id}`);
      yield* Console.log(formatPrdItemDetail(item));
    },
    Effect.catchTag("InvalidPrdInputError", (e) =>
      Console.error(`${e.message}\n\n${PRD_INPUT_HELP}`),
    ),
  ),
).pipe(Command.withDescription("Create a new PRD item"));

const updateCommand = Command.make(
  "update",
  { featureId: featureIdArg, prdId: prdIdArg, json: jsonArg },
  Effect.fn(
    function* ({ featureId, prdId, json }) {
      const repo = yield* PrdRepo;

      const partial = yield* Schema.decodeUnknown(PrdItemPartialInputJson)(
        json,
      ).pipe(
        Effect.mapError(
          (e) =>
            new InvalidPrdInputError({
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

      const item = yield* repo.update(featureId, prdId, partial);
      yield* Console.log(`Updated PRD item: ${item.id}`);
      yield* Console.log(formatPrdItemDetail(item));
    },
    Effect.catchTag("InvalidPrdInputError", (e) =>
      Console.error(`${e.message}\n\n${PRD_INPUT_HELP}`),
    ),
    Effect.catchTag("PrdNotFoundError", (e) => Console.error(e.message)),
    Effect.catchTag("PrdLockedError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Update a PRD item (blocked if locked)"));

const updateStatusCommand = Command.make(
  "update-status",
  { featureId: featureIdArg, prdId: prdIdArg, status: statusArg },
  Effect.fn(
    function* ({ featureId, prdId, status }) {
      const repo = yield* PrdRepo;
      const item = yield* repo.updateStatus(featureId, prdId, status);
      yield* Console.log(`Updated status of ${item.id} to: ${status}`);
    },
    Effect.catchTag("PrdNotFoundError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Update PRD status (ignores lock)"));

const formatPrdForDeletion = (item: PrdItem): string => {
  const lockIndicator = item.locked ? " [LOCKED]" : "";
  return `- ${item.id}: ${item.name}${lockIndicator}`;
};

const deleteCommand = Command.make(
  "delete",
  { featureId: featureIdArg, prdId: optionalPrdIdArg, password: optionalPasswordOption, yes: yesOption },
  Effect.fn(
    function* ({ featureId, prdId, password, yes }) {
      const repo = yield* PrdRepo;

      // Single PRD deletion (existing behavior)
      if (Option.isSome(prdId)) {
        yield* repo.delete(featureId, prdId.value);
        yield* Console.log(`Deleted PRD item: ${prdId.value}`);
        return;
      }

      // Feature deletion flow
      const items = yield* repo.list(featureId);

      if (items.length === 0) {
        yield* Console.log(`No PRDs found for feature '${featureId}'`);
        return;
      }

      // Check for locked PRDs
      const lockedItems = items.filter((item) => item.locked);
      const hasLockedPrds = lockedItems.length > 0;

      // Display PRDs that will be deleted
      yield* Console.log(`The following ${items.length} PRD(s) will be deleted:\n`);
      for (const item of items) {
        yield* Console.log(formatPrdForDeletion(item));
      }
      yield* Console.log("");

      // Require password for locked PRDs
      if (hasLockedPrds && Option.isNone(password)) {
        yield* Console.error(
          `Cannot delete feature '${featureId}': ${lockedItems.length} PRD(s) are locked: [${lockedItems.map((i) => i.id).join(", ")}]. Use --password to force.`
        );
        return;
      }

      // Verify password if provided and there are locked PRDs
      if (hasLockedPrds && Option.isSome(password)) {
        const passwordService = yield* PasswordService;
        yield* passwordService.verify(password.value);
      }

      // Confirmation prompt (unless --yes flag is set)
      if (!yes) {
        const confirmed = yield* Prompt.confirm({
          message: `Are you sure you want to delete all ${items.length} PRD(s) from feature '${featureId}'?`,
          initial: false,
        });

        if (!confirmed) {
          yield* Console.log("Deletion cancelled.");
          return;
        }
      }

      // Perform deletion
      const result = hasLockedPrds
        ? yield* repo.deleteFeatureForce(featureId)
        : yield* repo.deleteFeature(featureId);

      yield* Console.log(`Deleted ${result.deleted} PRD(s) from feature '${featureId}'`);
    },
    Effect.catchTag("PrdNotFoundError", (e) => Console.error(e.message)),
    Effect.catchTag("PrdLockedError", (e) => Console.error(e.message)),
    Effect.catchTag("FeatureHasLockedPrdsError", (e) => Console.error(e.message)),
    Effect.catchTag("PasswordNotConfiguredError", (e) => Console.error(e.message)),
    Effect.catchTag("InvalidPasswordError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Delete a PRD item or entire feature (blocked if locked)"));

const listCommand = Command.make(
  "list",
  { featureId: optionalFeatureIdArg },
  Effect.fn(function* ({ featureId }) {
    const repo = yield* PrdRepo;

    if (Option.isNone(featureId)) {
      const features = yield* repo.listFeatures();

      if (features.length === 0) {
        yield* Console.log("No features found");
        return;
      }

      yield* Console.log("Features:\n");
      for (const feature of features) {
        yield* Console.log(`  ${feature}`);
      }
      return;
    }

    const items = yield* repo.list(featureId.value);

    if (items.length === 0) {
      yield* Console.log(`No PRD items found for feature: ${featureId.value}`);
      return;
    }

    yield* Console.log(`PRD items for feature: ${featureId.value}\n`);
    for (const item of items) {
      yield* Console.log(formatPrdItem(item));
    }
  }),
).pipe(Command.withDescription("List PRD items sorted by priority (or list features if no feature-id)"));

const detailsCommand = Command.make(
  "details",
  { featureId: featureIdArg, prdId: prdIdArg },
  Effect.fn(
    function* ({ featureId, prdId }) {
      const repo = yield* PrdRepo;
      const item = yield* repo.get(featureId, prdId);
      yield* Console.log(formatPrdItemDetail(item));
    },
    Effect.catchTag("PrdNotFoundError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Show details of a PRD item"));

const lockCommand = Command.make(
  "lock",
  { featureId: featureIdArg, prdId: prdIdArg, password: passwordOption },
  Effect.fn(
    function* ({ featureId, prdId, password }) {
      const passwordService = yield* PasswordService;
      const repo = yield* PrdRepo;

      yield* passwordService.verify(password);
      yield* repo.lock(featureId, prdId);
      yield* Console.log(`Locked PRD item: ${prdId}`);
    },
    Effect.catchTag("PasswordNotConfiguredError", (e) =>
      Console.error(e.message),
    ),
    Effect.catchTag("InvalidPasswordError", (e) => Console.error(e.message)),
    Effect.catchTag("PrdNotFoundError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Lock a PRD item (requires password)"));

const unlockCommand = Command.make(
  "unlock",
  { featureId: featureIdArg, prdId: prdIdArg, password: passwordOption },
  Effect.fn(
    function* ({ featureId, prdId, password }) {
      const passwordService = yield* PasswordService;
      const repo = yield* PrdRepo;

      yield* passwordService.verify(password);
      yield* repo.unlock(featureId, prdId);
      yield* Console.log(`Unlocked PRD item: ${prdId}`);
    },
    Effect.catchTag("PasswordNotConfiguredError", (e) =>
      Console.error(e.message),
    ),
    Effect.catchTag("InvalidPasswordError", (e) => Console.error(e.message)),
    Effect.catchTag("PrdNotFoundError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Unlock a PRD item (requires password)"));

const IMPORT_FILE_HELP = `
Expected import file structure:
{
  "id": "feature-id",        // required, feature ID to import items into
  "items": [                 // required, array of PRD items
    {
      "id": "XXX-YYYY",
      "priority": 1,
      "name": "Feature name",
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
      const repo = yield* PrdRepo;
      const fs = yield* FileSystem.FileSystem;

      const content = yield* fs.readFileString(filePath).pipe(
        Effect.mapError(() => new InvalidPrdInputError({ reason: `Failed to read file: ${filePath}` })),
      );

      const importData = yield* Schema.decodeUnknown(ImportFileJson)(content).pipe(
        Effect.mapError(
          (e) =>
            new InvalidPrdInputError({
              reason: e.message,
            }),
        ),
      );

      const { created, skipped } = yield* repo.importFile(importData);
      yield* Console.log(`Imported PRDs for feature: ${importData.id}`);
      yield* Console.log(`  Created: ${created}`);
      yield* Console.log(`  Skipped (duplicate IDs): ${skipped}`);
    },
    Effect.catchTag("InvalidPrdInputError", (e) =>
      Console.error(`${e.message}\n\n${IMPORT_FILE_HELP}`),
    ),
  ),
).pipe(Command.withDescription("Import PRD items from a JSON file"));

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
