import { Schema } from "effect"

export const StoryId = Schema.String.pipe(Schema.brand("StoryId"))
export type StoryId = typeof StoryId.Type

export const PrdId = Schema.String.pipe(Schema.brand("PrdId"))
export type PrdId = typeof PrdId.Type

export const Status = Schema.Literal("todo", "done", "sent-back")
export type Status = typeof Status.Type

export class StoryItem extends Schema.Class<StoryItem>("StoryItem")({
  id: StoryId,
  priority: Schema.Number,
  name: Schema.NonEmptyString,
  description: Schema.String,
  steps: Schema.Array(Schema.String),
  acceptanceCriteria: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => [],
  }),
  status: Status,
  note: Schema.optional(Schema.String),
  // Internal fields
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  locked: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

export class StoryItemInput extends Schema.Class<StoryItemInput>("StoryItemInput")({
  id: StoryId,
  priority: Schema.Number,
  name: Schema.NonEmptyString,
  description: Schema.String,
  steps: Schema.Array(Schema.String),
  acceptanceCriteria: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => [],
  }),
  status: Status,
  note: Schema.optional(Schema.String),
}) {}

export const StoryItemInputJson = Schema.parseJson(StoryItemInput)

export class StoryItemPartialInput extends Schema.Class<StoryItemPartialInput>(
  "StoryItemPartialInput"
)({
  id: Schema.optional(StoryId),
  priority: Schema.optional(Schema.Number),
  name: Schema.optional(Schema.NonEmptyString),
  description: Schema.optional(Schema.String),
  steps: Schema.optional(Schema.Array(Schema.String)),
  acceptanceCriteria: Schema.optional(Schema.Array(Schema.String)),
  status: Schema.optional(Status),
  note: Schema.optional(Schema.String),
}) {}

export const StoryItemPartialInputJson = Schema.parseJson(StoryItemPartialInput)

// Import file schema: { id: "prd-id", items: [...StoryItemInput] }
export class ImportFile extends Schema.Class<ImportFile>("ImportFile")({
  id: PrdId,
  items: Schema.Array(StoryItemInput),
}) {}

export const ImportFileJson = Schema.parseJson(ImportFile)

export const STORY_INPUT_HELP = `
Expected Story structure:
{
  "id": "XXX-YYYY",              // required, e.g., "AUTH-0001"
  "priority": 1,                 // required, number
  "name": "Story name",          // required, string
  "description": "Details...",   // required, string
  "steps": ["Step 1", "Step 2"], // required, string[]
  "acceptanceCriteria": ["..."], // optional, string[]
  "status": "todo",              // required: "todo" | "done" | "sent-back"
  "note": "..."                  // optional, string
}
`.trim()
