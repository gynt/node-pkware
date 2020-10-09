#!/usr/bin/env node --experimental-modules

import fs from 'fs'
import minimist from 'minimist'
import {
  implode,
  ASCII_COMPRESSION,
  BINARY_COMPRESSION,
  DICTIONARY_SIZE1,
  DICTIONARY_SIZE2,
  DICTIONARY_SIZE3
} from '../src/index.mjs'
import { isBetween, through, transformSplitByIdx, transformIdentity, transformEmpty } from '../src/helpers.mjs'
import { isNil } from '../node_modules/ramda/src/index.mjs'
import { fileExists, getPackageVersion, isDecimalString, isHexadecimalString } from './helpers.mjs'

const decompress = (input, output, offset, keepHeader, compressionType, dictionarySize) => {
  const handler = isNil(offset)
    ? implode(compressionType, dictionarySize)
    : transformSplitByIdx(
        offset,
        keepHeader ? transformIdentity() : transformEmpty(),
        implode(compressionType, dictionarySize)
      )

  return new Promise((resolve, reject) => {
    input.pipe(through(handler).on('error', reject)).pipe(output).on('finish', resolve).on('error', reject)
  })
}

const args = minimist(process.argv.slice(2), {
  string: ['output'],
  boolean: ['version', 'binary', 'ascii', 'drop-before-offset']
})

;(async () => {
  if (args.version) {
    console.log(await getPackageVersion())
    process.exit(0)
  }

  let input = args._[0]
  let output = args.output

  let hasErrors = false

  if (input) {
    if (await fileExists(input)) {
      input = fs.createReadStream(input)
    } else {
      console.error('error: given file does not exist')
      hasErrors = true
    }
  } else {
    input = process.openStdin()
  }

  if (args.ascii && args.binary) {
    console.error('error: --ascii and --binary both specified, can only work with one')
    hasErrors = true
  } else if (!args.ascii && !args.binary) {
    console.error('error: compression type missing: --ascii or --binary was not specified')
    hasErrors = true
  }

  if (!args.level) {
    console.error('error: compression level missing: --level was not specified')
    hasErrors = true
  } else if (!isBetween(1, 3, args.level)) {
    console.error('error: incorrect compression level specified: --level should be between 1 and 3')
    hasErrors = true
  }

  if (output) {
    output = fs.createWriteStream(output)
  } else {
    output = process.stdout
  }

  if (hasErrors) {
    process.exit(1)
  }

  let offset = args.offset
  if (isDecimalString(offset)) {
    offset = parseInt(offset)
  } else if (isHexadecimalString(offset)) {
    offset = parseInt(offset.replace(/^0x/, ''), 16)
  } else {
    offset = 0
  }

  const keepHeader = !args['drop-before-offset']

  const compressionType = args.ascii ? ASCII_COMPRESSION : BINARY_COMPRESSION
  const dictionarySize = args.level === 1 ? DICTIONARY_SIZE1 : args.level === 2 ? DICTIONARY_SIZE2 : DICTIONARY_SIZE3
  decompress(input, output, offset, keepHeader, compressionType, dictionarySize)
    .then(() => {
      process.exit(0)
    })
    .catch(e => {
      console.error(e)
      process.exit(1)
    })
})()
