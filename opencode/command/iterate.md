---
description: Iterate on one story of given PRD
agent: build
---

- PRD ID: $1
- Use prdman skill

**Stories**
!`prdman list $1`

You are an autonomous coding agent working on a software project.

## Your Task

1. Check the list of stories
2. Read the codebase patterns at `codebase-patterns.md`
3. Read the progress log at `progress.md`
4. Pick the **highest priority** story where `status: todo`
5. Implement that single story
6. Run quality checks (e.g., typecheck, lint, test, format - use whatever your project requires)
7. Update AGENTS.md files if you discover reusable patterns (see below)
8. If checks pass, commit ALL changes with message: `[PRD ID] - [Story Name]`
9. Update the story's status to `done` for the completed story via `prdman update-status` command
10. Append your progress to `progress.md`

## Progress Report Format

APPEND to progress.md (never replace, always append):
```
## [Date/Time]: [PRD ID] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

The learnings section is critical - it helps future iterations avoid repeating mistakes and understand the codebase better.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `codebase-patterns.md` (create it if it doesn't exist). The `codebase-patterns.md` file should consolidate the most important learnings:

```
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
- Example: Export types from actions.ts for UI components
```

Only add patterns that are **general and reusable**, not story-specific details.

## Update AGENTS.md Files

Before committing, check if any edited files have learnings worth preserving in nearby AGENTS.md files:

1. **Identify directories with edited files** - Look at which directories you modified
2. **Check for existing `AGENTS.md`** - Look for `AGENTS.md` in those directories or parent directories
3. **Add valuable learnings** - If you discovered something future developers/agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good AGENTS.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Do NOT add:**
- Story-specific implementation details
- Temporary debugging notes
- Information already in `progress.md`

Only update AGENTS.md if you have **genuinely reusable knowledge** that would help future work in that directory.

## Quality Requirements

- ALL commits must pass your project's quality checks (typecheck, lint, test, format checks)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

## Important

- Work on ONE story per iteration
- Keep CI green
- Read the `codebase-patterns.md` file before starting
