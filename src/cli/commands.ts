import { Args, Command, Options } from "@effect/cli";
import { Console, Effect, Schema } from "effect";
import {
  FeatureId,
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

const prdIdArg = Args.text({ name: "prd-id" }).pipe(
  Args.withDescription("PRD item ID (format: XXX-YYYY)"),
  Args.withSchema(PrdId),
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

const deleteCommand = Command.make(
  "delete",
  { featureId: featureIdArg, prdId: prdIdArg },
  Effect.fn(
    function* ({ featureId, prdId }) {
      const repo = yield* PrdRepo;
      yield* repo.delete(featureId, prdId);
      yield* Console.log(`Deleted PRD item: ${prdId}`);
    },
    Effect.catchTag("PrdNotFoundError", (e) => Console.error(e.message)),
    Effect.catchTag("PrdLockedError", (e) => Console.error(e.message)),
  ),
).pipe(Command.withDescription("Delete a PRD item (blocked if locked)"));

const listCommand = Command.make(
  "list",
  { featureId: featureIdArg },
  Effect.fn(function* ({ featureId }) {
    const repo = yield* PrdRepo;
    const items = yield* repo.list(featureId);

    if (items.length === 0) {
      yield* Console.log(`No PRD items found for feature: ${featureId}`);
      return;
    }

    yield* Console.log(`PRD items for feature: ${featureId}\n`);
    for (const item of items) {
      yield* Console.log(formatPrdItem(item));
    }
  }),
).pipe(Command.withDescription("List PRD items sorted by priority"));

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
  ]),
);
