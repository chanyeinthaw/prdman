import { FileSystem } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"
import {
  DuplicateIdError,
  PrdHasLockedStoriesError,
  StoryLockedError,
  StoryNotFoundError,
} from "../domain/errors.js"
import {
  PrdId,
  ImportFile,
  StoryId,
  StoryItem,
  StoryItemInput,
  StoryItemPartialInput,
  Status,
} from "../domain/Story.js"
import { StoryRepo } from "./StoryRepo.js"

const CONFIG_DIR = `${process.env.HOME}/.config/prdman`
const DATA_PATH = `${CONFIG_DIR}/data.json`

const DataStore = Schema.Record({
  key: Schema.String,
  value: Schema.Array(StoryItem),
})
type DataStore = typeof DataStore.Type

const DataStoreJson = Schema.parseJson(DataStore)

export const StoryRepoJsonLayer = Layer.effect(
  StoryRepo,
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

    const save = Effect.fn("StoryRepoJson.save")(function* (data: DataStore) {
      yield* ensureDir
      const json = yield* Schema.encode(DataStoreJson)(data).pipe(Effect.orDie)
      yield* fs.writeFileString(DATA_PATH, json).pipe(Effect.orDie)
    })

    const getPrdStories = (
      data: DataStore,
      prdId: PrdId
    ): readonly StoryItem[] => {
      return data[prdId] ?? []
    }

    const create = Effect.fn("StoryRepo.create")(function* (
      prdId: PrdId,
      input: StoryItemInput
    ) {
      const data = yield* load
      const stories = getPrdStories(data, prdId)

      const exists = stories.some((story) => story.id === input.id)
      if (exists) {
        return yield* new DuplicateIdError({ prdId, id: input.id })
      }

      const now = new Date()
      const newStory = StoryItem.make({
        ...input,
        createdAt: now,
        updatedAt: now,
        locked: false,
      })

      const newData: DataStore = {
        ...data,
        [prdId]: [...stories, newStory],
      }
      yield* save(newData)
      return newStory
    })

    const update = Effect.fn("StoryRepo.update")(function* (
      prdId: PrdId,
      id: StoryId,
      partial: StoryItemPartialInput
    ) {
      const data = yield* load
      const stories = [...getPrdStories(data, prdId)]

      const index = stories.findIndex((story) => story.id === id)
      if (index === -1) {
        return yield* new StoryNotFoundError({ prdId, id })
      }

      const existing = stories[index]!
      if (existing.locked) {
        return yield* new StoryLockedError({ id })
      }

      const updated = StoryItem.make({
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

      stories[index] = updated
      const newData: DataStore = { ...data, [prdId]: stories }
      yield* save(newData)
      return updated
    })

    const updateStatus = Effect.fn("StoryRepo.updateStatus")(function* (
      prdId: PrdId,
      id: StoryId,
      status: Status
    ) {
      const data = yield* load
      const stories = [...getPrdStories(data, prdId)]

      const index = stories.findIndex((story) => story.id === id)
      if (index === -1) {
        return yield* new StoryNotFoundError({ prdId, id })
      }

      const existing = stories[index]!
      const updated = StoryItem.make({
        ...existing,
        status,
        updatedAt: new Date(),
      })

      stories[index] = updated
      const newData: DataStore = { ...data, [prdId]: stories }
      yield* save(newData)
      return updated
    })

    const delete_ = Effect.fn("StoryRepo.delete")(function* (
      prdId: PrdId,
      id: StoryId
    ) {
      const data = yield* load
      const stories = getPrdStories(data, prdId)

      const story = stories.find((story) => story.id === id)
      if (!story) {
        return yield* new StoryNotFoundError({ prdId, id })
      }

      if (story.locked) {
        return yield* new StoryLockedError({ id })
      }

      const newStories = stories.filter((story) => story.id !== id)
      const newData: DataStore = { ...data, [prdId]: newStories }
      yield* save(newData)
    })

    const list = Effect.fn("StoryRepo.list")(function* (prdId: PrdId) {
      const data = yield* load
      const stories = getPrdStories(data, prdId)
      return [...stories].sort((a, b) => a.priority - b.priority)
    })

    const get = Effect.fn("StoryRepo.get")(function* (
      prdId: PrdId,
      id: StoryId
    ) {
      const data = yield* load
      const stories = getPrdStories(data, prdId)

      const story = stories.find((story) => story.id === id)
      if (!story) {
        return yield* new StoryNotFoundError({ prdId, id })
      }
      return story
    })

    const lock = Effect.fn("StoryRepo.lock")(function* (
      prdId: PrdId,
      id: StoryId
    ) {
      const data = yield* load
      const stories = [...getPrdStories(data, prdId)]

      const index = stories.findIndex((story) => story.id === id)
      if (index === -1) {
        return yield* new StoryNotFoundError({ prdId, id })
      }

      const existing = stories[index]!
      stories[index] = StoryItem.make({
        ...existing,
        locked: true,
        updatedAt: new Date(),
      })

      const newData: DataStore = { ...data, [prdId]: stories }
      yield* save(newData)
    })

    const unlock = Effect.fn("StoryRepo.unlock")(function* (
      prdId: PrdId,
      id: StoryId
    ) {
      const data = yield* load
      const stories = [...getPrdStories(data, prdId)]

      const index = stories.findIndex((story) => story.id === id)
      if (index === -1) {
        return yield* new StoryNotFoundError({ prdId, id })
      }

      const existing = stories[index]!
      stories[index] = StoryItem.make({
        ...existing,
        locked: false,
        updatedAt: new Date(),
      })

      const newData: DataStore = { ...data, [prdId]: stories }
      yield* save(newData)
    })

    const listPrds = Effect.fn("StoryRepo.listPrds")(function* () {
      const data = yield* load
      return Object.keys(data)
        .filter((key) => (data[key]?.length ?? 0) > 0)
        .sort()
        .map((key) => PrdId.make(key))
    })

    const importFile = Effect.fn("StoryRepo.importFile")(function* (
      importData: ImportFile
    ) {
      const data = yield* load
      const stories = [...getPrdStories(data, importData.id)]
      const existingIds = new Set(stories.map((story) => story.id))

      let created = 0
      let skipped = 0

      for (const input of importData.items) {
        if (existingIds.has(input.id)) {
          skipped++
          continue
        }

        const now = new Date()
        const newStory = StoryItem.make({
          ...input,
          createdAt: now,
          updatedAt: now,
          locked: false,
        })

        stories.push(newStory)
        existingIds.add(input.id)
        created++
      }

      const newData: DataStore = { ...data, [importData.id]: stories }
      yield* save(newData)

      return { created, skipped }
    })

    const deletePrd = Effect.fn("StoryRepo.deletePrd")(function* (
      prdId: PrdId
    ) {
      const data = yield* load
      const stories = getPrdStories(data, prdId)

      if (stories.length === 0) {
        return { deleted: 0 }
      }

      const lockedIds = stories.filter((story) => story.locked).map((story) => story.id)
      if (lockedIds.length > 0) {
        return yield* new PrdHasLockedStoriesError({ prdId, lockedIds })
      }

      const deleted = stories.length
      const { [prdId]: _, ...newData } = data
      yield* save(newData)
      return { deleted }
    })

    const deletePrdForce = Effect.fn("StoryRepo.deletePrdForce")(
      function* (prdId: PrdId) {
        const data = yield* load
        const stories = getPrdStories(data, prdId)
        const deleted = stories.length

        if (deleted === 0) {
          return { deleted: 0 }
        }

        const { [prdId]: _, ...newData } = data
        yield* save(newData)
        return { deleted }
      }
    )

    return StoryRepo.of({
      create,
      update,
      updateStatus,
      delete: delete_,
      list,
      get,
      lock,
      unlock,
      listPrds,
      importFile,
      deletePrd,
      deletePrdForce,
    })
  })
)
