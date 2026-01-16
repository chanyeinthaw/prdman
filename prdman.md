# PRD Management CLI (`prdman`)

A CLI application for managing Product Requirement Documents (PRDs) scoped by feature.

## Data Model

### PRD Item

```typescript
{
  id: string,                    // e.g., "AUTH-0001" (user-provided, format: XXX-YYYY)
  priority: number,              // numeric priority for ordering
  name: string,                  // feature name
  description: string,           // detailed description
  steps: string[],               // list of implementation steps
  acceptanceCriteria: string[],  // optional, list of acceptance criteria
  status: "todo" | "done" | "sent-back",
  note?: string,                 // optional note

  // Internal fields (managed by system)
  createdAt: Date,
  updatedAt: Date,
  locked: boolean
}
```

### PRD Input (User-provided)

```json
{
  "id": "XXX-YYYY",
  "priority": 1,
  "name": "Feature name",
  "description": "Details...",
  "steps": ["Step 1", "Step 2"],
  "acceptanceCriteria": ["..."],
  "status": "todo",
  "note": "..."
}
```

- `id`, `priority`, `name`, `description`, `steps`, `status` are required
- `acceptanceCriteria`, `note` are optional

## CLI Commands

```
prdman <feature-id> create "<json-prd-item>"
prdman <feature-id> update <prd-id> "<json-prd-item>"
prdman <feature-id> update-status <prd-id> <status>
prdman <feature-id> delete <prd-id>
prdman <feature-id> list
prdman <feature-id> lock <prd-id> --password "<password>"
prdman <feature-id> unlock <prd-id> --password "<password>"
```

### Command Details

| Command | Description | Lock Check |
|---------|-------------|------------|
| `create` | Create a new PRD item | No |
| `update` | Update PRD item (partial JSON allowed) | Yes, blocked if locked |
| `update-status` | Update status only | No, ignores lock |
| `delete` | Delete PRD item | Yes, blocked if locked |
| `list` | List PRDs sorted by priority, shows lock status | No |
| `lock` | Lock PRD item (requires password) | No |
| `unlock` | Unlock PRD item (requires password) | No |

## Storage

- Location: `~/.config/prdman/data.json`
- Structure: `{ [featureId: string]: PrdItem[] }`
- Abstracted via `PrdRepo` service for future swappability (DB, Linear, etc.)

## Password Protection

- Password file: `~/.config/prdman/password`
- Plain text, manually configured by user
- Used to verify `lock`/`unlock` operations
- Prevents AI agents from forcefully unlocking PRDs

## File Structure

```
src/
├── index.ts                # CLI entry + layer wiring
├── cli/
│   └── commands.ts         # CLI command definitions
├── domain/
│   ├── PrdItem.ts          # Schema + branded types
│   └── errors.ts           # TaggedErrors
└── services/
    ├── PrdRepo.ts          # Abstract storage interface
    ├── PrdRepoJson.ts      # JSON file implementation
    └── PasswordService.ts  # Password verification
```

## Services

### PrdRepo (Abstract Interface)

```typescript
class PrdRepo extends Context.Tag("@prdman/PrdRepo")<PrdRepo, {
  readonly create: (featureId: string, item: PrdItemInput) => Effect<PrdItem, DuplicateIdError>
  readonly update: (featureId: string, id: string, partial: Partial<PrdItemInput>) => Effect<PrdItem, PrdNotFoundError | PrdLockedError>
  readonly updateStatus: (featureId: string, id: string, status: Status) => Effect<PrdItem, PrdNotFoundError>
  readonly delete: (featureId: string, id: string) => Effect<void, PrdNotFoundError | PrdLockedError>
  readonly list: (featureId: string) => Effect<PrdItem[]>
  readonly lock: (featureId: string, id: string) => Effect<void, PrdNotFoundError>
  readonly unlock: (featureId: string, id: string) => Effect<void, PrdNotFoundError>
  readonly get: (featureId: string, id: string) => Effect<PrdItem, PrdNotFoundError>
}>() {}
```

### PrdRepoJson (Implementation)

JSON file-based implementation of `PrdRepo`:
- Reads/writes `~/.config/prdman/data.json`
- Auto-creates file/directory if not exists
- Sets `createdAt`/`updatedAt` automatically

### PasswordService

```typescript
class PasswordService extends Context.Tag("@prdman/PasswordService")<PasswordService, {
  readonly verify: (password: string) => Effect<boolean, PasswordNotConfiguredError>
}>() {}
```

- Reads password from `~/.config/prdman/password`
- Returns `PasswordNotConfiguredError` if file doesn't exist

## Error Types

| Error | Description |
|-------|-------------|
| `PrdNotFoundError` | PRD item with given ID doesn't exist |
| `PrdLockedError` | Attempting to update/delete a locked PRD |
| `DuplicateIdError` | PRD with same ID already exists |
| `InvalidPasswordError` | Password mismatch on lock/unlock |
| `PasswordNotConfiguredError` | `~/.config/prdman/password` file missing |
| `InvalidPrdInputError` | Invalid JSON input for create/update |

## Error Handling

On invalid JSON input for `create`/`update`, display:
1. Parse error message
2. Help text with expected PRD structure:

```
Invalid PRD input: <error message>

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
```

## Implementation Notes

- Use Effect-TS with `@effect/cli` for CLI framework
- Use `@effect/platform-bun` for file system operations
- Use `Schema.Class` for PRD item definition
- Use `Schema.TaggedError` for error types
- Partial updates merge with existing data
- `list` output shows lock indicator (e.g., `[locked]`)
