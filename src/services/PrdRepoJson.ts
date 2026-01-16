import { FileSystem } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"
import {
  DuplicateIdError,
  PrdLockedError,
  PrdNotFoundError,
} from "../domain/errors.js"
import {
  FeatureId,
  PrdId,
  PrdItem,
  PrdItemInput,
  PrdItemPartialInput,
  Status,
} from "../domain/PrdItem.js"
import { PrdRepo } from "./PrdRepo.js"

const CONFIG_DIR = `${process.env.HOME}/.config/prdman`
const DATA_PATH = `${CONFIG_DIR}/data.json`

const DataStore = Schema.Record({
  key: Schema.String,
  value: Schema.Array(PrdItem),
})
type DataStore = typeof DataStore.Type

const DataStoreJson = Schema.parseJson(DataStore)

export const PrdRepoJsonLayer = Layer.effect(
  PrdRepo,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const ensureDir = fs
      .makeDirectory(CONFIG_DIR, { recursive: true })
      .pipe(Effect.orDie)

    const load = Effect.gen(function* () {
      yield* ensureDir
      const exists = yield* fs.exists(DATA_PATH).pipe(Effect.orDie)
      if (!exists) {
        return {} as DataStore
      }
      const content = yield* fs.readFileString(DATA_PATH).pipe(Effect.orDie)
      if (content.trim() === "") {
        return {} as DataStore
      }
      return yield* Schema.decodeUnknown(DataStoreJson)(content).pipe(
        Effect.orDie
      )
    })

    const save = Effect.fn("PrdRepoJson.save")(function* (data: DataStore) {
      yield* ensureDir
      const json = yield* Schema.encode(DataStoreJson)(data).pipe(Effect.orDie)
      yield* fs.writeFileString(DATA_PATH, json).pipe(Effect.orDie)
    })

    const getFeatureItems = (
      data: DataStore,
      featureId: FeatureId
    ): readonly PrdItem[] => {
      return data[featureId] ?? []
    }

    const create = Effect.fn("PrdRepo.create")(function* (
      featureId: FeatureId,
      input: PrdItemInput
    ) {
      const data = yield* load
      const items = getFeatureItems(data, featureId)

      const exists = items.some((item) => item.id === input.id)
      if (exists) {
        return yield* new DuplicateIdError({ featureId, id: input.id })
      }

      const now = new Date()
      const newItem = PrdItem.make({
        ...input,
        createdAt: now,
        updatedAt: now,
        locked: false,
      })

      const newData: DataStore = {
        ...data,
        [featureId]: [...items, newItem],
      }
      yield* save(newData)
      return newItem
    })

    const update = Effect.fn("PrdRepo.update")(function* (
      featureId: FeatureId,
      id: PrdId,
      partial: PrdItemPartialInput
    ) {
      const data = yield* load
      const items = [...getFeatureItems(data, featureId)]

      const index = items.findIndex((item) => item.id === id)
      if (index === -1) {
        return yield* new PrdNotFoundError({ featureId, id })
      }

      const existing = items[index]!
      if (existing.locked) {
        return yield* new PrdLockedError({ id })
      }

      const updated = PrdItem.make({
        ...existing,
        ...(partial.priority !== undefined && { priority: partial.priority }),
        ...(partial.name !== undefined && { name: partial.name }),
        ...(partial.description !== undefined && {
          description: partial.description,
        }),
        ...(partial.steps !== undefined && { steps: partial.steps }),
        ...(partial.acceptanceCriteria !== undefined && {
          acceptanceCriteria: partial.acceptanceCriteria,
        }),
        ...(partial.status !== undefined && { status: partial.status }),
        ...(partial.note !== undefined && { note: partial.note }),
        id: existing.id, // prevent id change
        createdAt: existing.createdAt,
        updatedAt: new Date(),
        locked: existing.locked,
      })

      items[index] = updated
      const newData: DataStore = { ...data, [featureId]: items }
      yield* save(newData)
      return updated
    })

    const updateStatus = Effect.fn("PrdRepo.updateStatus")(function* (
      featureId: FeatureId,
      id: PrdId,
      status: Status
    ) {
      const data = yield* load
      const items = [...getFeatureItems(data, featureId)]

      const index = items.findIndex((item) => item.id === id)
      if (index === -1) {
        return yield* new PrdNotFoundError({ featureId, id })
      }

      const existing = items[index]!
      const updated = PrdItem.make({
        ...existing,
        status,
        updatedAt: new Date(),
      })

      items[index] = updated
      const newData: DataStore = { ...data, [featureId]: items }
      yield* save(newData)
      return updated
    })

    const delete_ = Effect.fn("PrdRepo.delete")(function* (
      featureId: FeatureId,
      id: PrdId
    ) {
      const data = yield* load
      const items = getFeatureItems(data, featureId)

      const item = items.find((item) => item.id === id)
      if (!item) {
        return yield* new PrdNotFoundError({ featureId, id })
      }

      if (item.locked) {
        return yield* new PrdLockedError({ id })
      }

      const newItems = items.filter((item) => item.id !== id)
      const newData: DataStore = { ...data, [featureId]: newItems }
      yield* save(newData)
    })

    const list = Effect.fn("PrdRepo.list")(function* (featureId: FeatureId) {
      const data = yield* load
      const items = getFeatureItems(data, featureId)
      return [...items].sort((a, b) => a.priority - b.priority)
    })

    const get = Effect.fn("PrdRepo.get")(function* (
      featureId: FeatureId,
      id: PrdId
    ) {
      const data = yield* load
      const items = getFeatureItems(data, featureId)

      const item = items.find((item) => item.id === id)
      if (!item) {
        return yield* new PrdNotFoundError({ featureId, id })
      }
      return item
    })

    const lock = Effect.fn("PrdRepo.lock")(function* (
      featureId: FeatureId,
      id: PrdId
    ) {
      const data = yield* load
      const items = [...getFeatureItems(data, featureId)]

      const index = items.findIndex((item) => item.id === id)
      if (index === -1) {
        return yield* new PrdNotFoundError({ featureId, id })
      }

      const existing = items[index]!
      items[index] = PrdItem.make({
        ...existing,
        locked: true,
        updatedAt: new Date(),
      })

      const newData: DataStore = { ...data, [featureId]: items }
      yield* save(newData)
    })

    const unlock = Effect.fn("PrdRepo.unlock")(function* (
      featureId: FeatureId,
      id: PrdId
    ) {
      const data = yield* load
      const items = [...getFeatureItems(data, featureId)]

      const index = items.findIndex((item) => item.id === id)
      if (index === -1) {
        return yield* new PrdNotFoundError({ featureId, id })
      }

      const existing = items[index]!
      items[index] = PrdItem.make({
        ...existing,
        locked: false,
        updatedAt: new Date(),
      })

      const newData: DataStore = { ...data, [featureId]: items }
      yield* save(newData)
    })

    const listFeatures = Effect.fn("PrdRepo.listFeatures")(function* () {
      const data = yield* load
      return Object.keys(data)
        .filter((key) => (data[key]?.length ?? 0) > 0)
        .sort()
        .map((key) => FeatureId.make(key))
    })

    return PrdRepo.of({
      create,
      update,
      updateStatus,
      delete: delete_,
      list,
      get,
      lock,
      unlock,
      listFeatures,
    })
  })
)
