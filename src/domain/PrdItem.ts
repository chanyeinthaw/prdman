import { Schema } from "effect"

export const PrdId = Schema.String.pipe(Schema.brand("PrdId"))
export type PrdId = typeof PrdId.Type

export const FeatureId = Schema.String.pipe(Schema.brand("FeatureId"))
export type FeatureId = typeof FeatureId.Type

export const Status = Schema.Literal("todo", "done", "sent-back")
export type Status = typeof Status.Type

export class PrdItem extends Schema.Class<PrdItem>("PrdItem")({
  id: PrdId,
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

export class PrdItemInput extends Schema.Class<PrdItemInput>("PrdItemInput")({
  id: PrdId,
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

export const PrdItemInputJson = Schema.parseJson(PrdItemInput)

export class PrdItemPartialInput extends Schema.Class<PrdItemPartialInput>(
  "PrdItemPartialInput"
)({
  id: Schema.optional(PrdId),
  priority: Schema.optional(Schema.Number),
  name: Schema.optional(Schema.NonEmptyString),
  description: Schema.optional(Schema.String),
  steps: Schema.optional(Schema.Array(Schema.String)),
  acceptanceCriteria: Schema.optional(Schema.Array(Schema.String)),
  status: Schema.optional(Status),
  note: Schema.optional(Schema.String),
}) {}

export const PrdItemPartialInputJson = Schema.parseJson(PrdItemPartialInput)

// Import file schema: { id: "feature-id", items: [...PrdItemInput] }
export class ImportFile extends Schema.Class<ImportFile>("ImportFile")({
  id: FeatureId,
  items: Schema.Array(PrdItemInput),
}) {}

export const ImportFileJson = Schema.parseJson(ImportFile)

export const PRD_INPUT_HELP = `
Expected PRD structure:
{
  "id": "XXX-YYYY",              // required, e.g., "AUTH-0001"
  "priority": 1,                 // required, number
  "name": "Feature name",        // required, string
  "description": "Details...",   // required, string
  "steps": ["Step 1", "Step 2"], // required, string[]
  "acceptanceCriteria": ["..."], // optional, string[]
  "status": "todo",              // required: "todo" | "done" | "sent-back"
  "note": "..."                  // optional, string
}
`.trim()
