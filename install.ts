#!/usr/bin/env bun

import { $ } from "bun"

const BINARY_NAME = "prdman"
const INSTALL_DIR = `${process.env.HOME}/.local/bin`
const OPENCODE_DIR = `${process.env.HOME}/.config/opencode`

console.log("Building prdman...")

await $`bun build index.ts --compile --outfile ${BINARY_NAME}`

console.log(`Installing to ${INSTALL_DIR}...`)

await $`mkdir -p ${INSTALL_DIR}`
await $`mv ${BINARY_NAME} ${INSTALL_DIR}/${BINARY_NAME}`
await $`chmod +x ${INSTALL_DIR}/${BINARY_NAME}`

console.log(`Installing opencode commands & skills to ${OPENCODE_DIR}...`)

// copy prdman commands (replace if exists)
await $`mkdir -p ${OPENCODE_DIR}/command`
await $`cp opencode/command/convert-to-prd.md ${OPENCODE_DIR}/command/`
await $`cp opencode/command/iterate.md ${OPENCODE_DIR}/command/`

// copy prdman skill (replace if exists)
await $`rm -rf ${OPENCODE_DIR}/skill/prdman`
await $`mkdir -p ${OPENCODE_DIR}/skill`
await $`cp -r opencode/skill/prdman ${OPENCODE_DIR}/skill/`

console.log(`\nInstalled successfully!`)
console.log(`\nMake sure ${INSTALL_DIR} is in your PATH:`)
console.log(`  export PATH="$HOME/.local/bin:$PATH"`)
console.log(`\nRun 'prdman --help' to get started.`)
