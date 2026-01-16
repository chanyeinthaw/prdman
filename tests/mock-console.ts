import * as Array from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

export interface MockConsole extends Console.Console {
  readonly getLines: (
    params?: Partial<{ readonly stripAnsi: boolean }>,
  ) => Effect.Effect<ReadonlyArray<string>>;
  readonly getErrorLines: (
    params?: Partial<{ readonly stripAnsi: boolean }>,
  ) => Effect.Effect<ReadonlyArray<string>>;
  readonly clear: Effect.Effect<void>;
}

export const MockConsole = Context.GenericTag<Console.Console, MockConsole>(
  "effect/Console",
);

const ansiPattern = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))",
  ].join("|"),
  "g",
);

const stripAnsi = (str: string) => str.replace(ansiPattern, "");

export const make = Effect.gen(function* () {
  const lines = yield* Ref.make(Array.empty<string>());
  const errorLines = yield* Ref.make(Array.empty<string>());

  const getLines: MockConsole["getLines"] = (params = {}) =>
    Ref.get(lines).pipe(
      Effect.map((lines) =>
        params.stripAnsi ? Array.map(lines, stripAnsi) : lines,
      ),
    );

  const getErrorLines: MockConsole["getErrorLines"] = (params = {}) =>
    Ref.get(errorLines).pipe(
      Effect.map((lines) =>
        params.stripAnsi ? Array.map(lines, stripAnsi) : lines,
      ),
    );

  const log: MockConsole["log"] = (...args) =>
    Ref.update(lines, Array.appendAll(args));

  const error: MockConsole["error"] = (...args) =>
    Ref.update(errorLines, Array.appendAll(args));

  const clear: MockConsole["clear"] = Effect.all([
    Ref.set(lines, []),
    Ref.set(errorLines, []),
  ]).pipe(Effect.asVoid);

  return MockConsole.of({
    [Console.TypeId]: Console.TypeId,
    getLines,
    getErrorLines,
    clear,
    log,
    error,
    unsafe: globalThis.console,
    assert: () => Effect.void,
    count: () => Effect.void,
    countReset: () => Effect.void,
    debug: () => Effect.void,
    dir: () => Effect.void,
    dirxml: () => Effect.void,
    group: () => Effect.void,
    groupEnd: Effect.void,
    info: () => Effect.void,
    table: () => Effect.void,
    time: () => Effect.void,
    timeEnd: () => Effect.void,
    timeLog: () => Effect.void,
    trace: () => Effect.void,
    warn: () => Effect.void,
  });
});

export const getLines = (
  params?: Partial<{ readonly stripAnsi?: boolean }>,
): Effect.Effect<ReadonlyArray<string>> =>
  Effect.consoleWith((console) => (console as MockConsole).getLines(params));

export const getErrorLines = (
  params?: Partial<{ readonly stripAnsi?: boolean }>,
): Effect.Effect<ReadonlyArray<string>> =>
  Effect.consoleWith((console) =>
    (console as MockConsole).getErrorLines(params),
  );

export const clearConsole = (): Effect.Effect<void> =>
  Effect.consoleWith((console) => (console as MockConsole).clear);
