#!/usr/bin/env bun

import { $ } from "bun"

const BINARY_NAME = "prdman"
const INSTALL_DIR = `${process.env.HOME}/.local/bin`

console.log("Building prdman...")

await $`bun build index.ts --compile --outfile ${BINARY_NAME}`

console.log(`Installing to ${INSTALL_DIR}...`)

await $`mkdir -p ${INSTALL_DIR}`
await $`mv ${BINARY_NAME} ${INSTALL_DIR}/${BINARY_NAME}`
await $`chmod +x ${INSTALL_DIR}/${BINARY_NAME}`

console.log(`\nInstalled successfully!`)
console.log(`\nMake sure ${INSTALL_DIR} is in your PATH:`)
console.log(`  export PATH="$HOME/.local/bin:$PATH"`)
console.log(`\nRun 'prdman --help' to get started.`)
