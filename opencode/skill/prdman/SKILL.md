---
name: prdman
description: PRD management CLI for tracking PRD requirements. Use when managing PRDs, creating story specs, or tracking implementation status.
---

# prdman - PRD Management CLI

Manage Product Requirement Documents with stories scoped by PRD.

## Quick Reference

```bash
# create a story
prdman create <prd-id> '<json>'

# list all PRDs
prdman list

# list stories for a PRD (sorted by priority)
prdman list <prd-id>

# show details of a story
prdman details <prd-id> <story-id>

# update a story (blocked if locked)
prdman update <prd-id> <story-id> '<partial-json>'

# update status only (ignores lock)
prdman update-status <prd-id> <story-id> todo|done|sent-back

# delete a story (blocked if locked)
prdman delete <prd-id> <story-id>

# delete entire PRD (all stories)
prdman delete --yes <prd-id>

# force delete PRD with locked stories
prdman delete --password "<password>" --yes <prd-id>

# lock/unlock (requires password from ~/.config/prdman/password)
prdman lock <prd-id> <story-id> --password "<password>"
prdman unlock <prd-id> <story-id> --password "<password>"

# import stories from a JSON file
prdman import <file-path>
```

## Story JSON Structure

```json
{
  "id": "AUTH-0001",
  "priority": 1,
  "name": "User Authentication",
  "description": "Implement login flow",
  "steps": ["Create login form", "Add validation", "Connect to API"],
  "acceptanceCriteria": ["User can login with email/password"],
  "status": "todo",
  "note": "Optional notes"
}
```

**Required fields:** `id`, `priority`, `name`, `description`, `steps`, `status`
**Optional fields:** `acceptanceCriteria`, `note`

## ID Format

Story IDs follow `XXX-YYYY` pattern (e.g., `AUTH-0001`, `API-0042`).

## Status Values

- `todo` - Not started
- `done` - Completed
- `sent-back` - Returned for revision

## Common Workflows

### Create new PRD stories

```bash
prdman create payments '{"id":"PAY-0001","priority":1,"name":"Stripe Integration","description":"Add Stripe payments","steps":["Install SDK","Create checkout"],"status":"todo"}'
```

### Mark story complete

```bash
prdman update-status payments PAY-0001 done
```

### View all stories for PRD

```bash
prdman list payments
```

### View all PRDs

```bash
prdman list
```

### View story details

```bash
prdman details payments PAY-0001
```

### Import stories from file

```bash
prdman import ./stories.json
```

### Delete entire PRD

```bash
# Delete all stories in a PRD (prompts for confirmation)
prdman delete --yes payments

# Force delete PRD with locked stories
prdman delete --password "secret" --yes payments
```

## Import File Structure

```json
{
  "id": "prd-id",
  "items": [
    {
      "id": "AUTH-0001",
      "priority": 1,
      "name": "User Login",
      "description": "Implement login",
      "steps": ["Step 1"],
      "status": "todo"
    }
  ]
}
```

Duplicate IDs are skipped during import.
