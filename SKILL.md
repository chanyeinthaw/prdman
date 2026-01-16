---
name: prdman
description: PRD management CLI for tracking feature requirements. Use when managing PRDs, creating feature specs, or tracking implementation status.
---

# prdman - PRD Management CLI

Manage Product Requirement Documents scoped by feature.

## Quick Reference

```bash
# create a PRD
prdman create <feature-id> '<json>'

# list all features
prdman list

# list PRDs for a feature (sorted by priority)
prdman list <feature-id>

# show details of a PRD item
prdman details <feature-id> <prd-id>

# update a PRD (blocked if locked)
prdman update <feature-id> <prd-id> '<partial-json>'

# update status only (ignores lock)
prdman update-status <feature-id> <prd-id> todo|done|sent-back

# delete a PRD (blocked if locked)
prdman delete <feature-id> <prd-id>

# lock/unlock (requires password from ~/.config/prdman/password)
prdman lock <feature-id> <prd-id> --password "<password>"
prdman unlock <feature-id> <prd-id> --password "<password>"

# import PRDs from a JSON file
prdman import <file-path>
```

## PRD JSON Structure

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

PRD IDs follow `XXX-YYYY` pattern (e.g., `AUTH-0001`, `API-0042`).

## Status Values

- `todo` - Not started
- `done` - Completed
- `sent-back` - Returned for revision

## Common Workflows

### Create new feature PRDs

```bash
prdman create payments '{"id":"PAY-0001","priority":1,"name":"Stripe Integration","description":"Add Stripe payments","steps":["Install SDK","Create checkout"],"status":"todo"}'
```

### Mark PRD complete

```bash
prdman update-status payments PAY-0001 done
```

### View all PRDs for feature

```bash
prdman list payments
```

### View all features

```bash
prdman list
```

### View PRD details

```bash
prdman details payments PAY-0001
```

### Import PRDs from file

```bash
prdman import ./prds.json
```

## Import File Structure

```json
{
  "id": "feature-id",
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
