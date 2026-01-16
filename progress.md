# DELFEAT Progress

## DEL-0001 - Add FeatureHasLockedPrdsError

Added `FeatureHasLockedPrdsError` class to `src/domain/errors.ts` with:
- `featureId` (string) and `lockedIds` (string[]) fields
- Message format: `Cannot delete feature 'X': Y PRD(s) are locked: [IDs]. Use --password to force.`
- Follows existing `Schema.TaggedError` pattern

## DEL-0002 - Add deleteFeature methods to PrdRepo

Added two new method signatures to `src/services/PrdRepo.ts`:
- `deleteFeature(featureId)` - Returns `Effect.Effect<{ deleted: number }, FeatureHasLockedPrdsError>`
- `deleteFeatureForce(featureId)` - Returns `Effect.Effect<{ deleted: number }>` (no error channel)
- Added `FeatureHasLockedPrdsError` import to PrdRepo.ts

## DEL-0003 - Implement deleteFeature in PrdRepoJson

Implemented `deleteFeature` and `deleteFeatureForce` methods in `src/services/PrdRepoJson.ts`:
- `deleteFeature`: Loads data, checks for locked PRDs, fails with `FeatureHasLockedPrdsError` if any locked, otherwise deletes the feature key entirely
- `deleteFeatureForce`: Deletes feature key regardless of lock status
- Both return `{ deleted: count }` with accurate PRD count
- Non-existent or empty features return `{ deleted: 0 }`
- Also added stub implementations to `tests/test-layers.ts` TestPrdRepo for typecheck to pass

## DEL-0004 - Update TestPrdRepo with deleteFeature methods

Verified and confirmed the `deleteFeature` and `deleteFeatureForce` implementations in `tests/test-layers.ts`:
- `deleteFeature` (lines 213-231): Checks for locked PRDs and fails with `FeatureHasLockedPrdsError` if any exist, otherwise deletes the feature and returns `{ deleted: count }`
- `deleteFeatureForce` (lines 233-243): Uses `Effect.sync` to delete the feature regardless of lock status
- Both methods return `{ deleted: 0 }` for non-existent or empty features
- Implementation mirrors `PrdRepoJson` behavior
- All tests pass (43 tests)

## DEL-0005 - Modify delete command for optional prd-id

Updated the delete CLI command in `src/cli/commands.ts` to support feature deletion:
- Changed `prdIdArg` to optional using `optionalPrdIdArg` with `Args.optional`
- Added `--password / -p` option (optional) for force-deleting locked PRDs
- Added `--yes / -y` option (boolean flag, default false) to skip confirmation prompt
- Implemented branching logic: if prdId present uses single-delete, else feature-delete flow
- Feature deletion: lists PRDs with format `- ID: Name [LOCKED]`, shows confirmation prompt with `Prompt.confirm`
- If any PRDs locked and no password: displays error message and exits
- If any PRDs locked and password provided: verifies password via `PasswordService`, calls `deleteFeatureForce`
- If no PRDs locked: calls `deleteFeature`
- Empty feature shows "No PRDs found for feature X" message
- All 43 tests pass

## DEL-0006 - Add CLI tests for feature deletion

Added comprehensive CLI tests for feature deletion in `tests/cli.test.ts`:
- Added new `describe("feature deletion")` block inside the delete describe block
- Test: deletes all PRDs with `--yes` when none locked - verifies success message and data store state
- Test: fails with `--yes` when PRDs are locked without password - verifies error message and data preserved
- Test: succeeds with `--password --yes` when PRDs are locked - verifies force deletion works
- Test: shows message for empty feature - verifies "No PRDs found" message
- Test: single PRD deletion still works with prd-id argument - verifies backward compatibility
- Test: fails with wrong password for locked PRDs - verifies password validation
- Test: shows locked indicator in deletion list - verifies `[LOCKED]` formatting
- All 50 tests pass
