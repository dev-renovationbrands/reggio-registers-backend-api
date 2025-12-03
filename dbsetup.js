#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const env = { ...process.env }

// place Sqlite3 database on volume
const source = path.resolve('./dev.sqlite')
const target = '/data/' + path.basename(source)

if (!fs.existsSync(source) && fs.existsSync('/data')) {
  try {
    fs.symlinkSync(target, source, 'file')
  } catch (error) {
    console.error('error creating symlink', error)
  }
}

const newDb = !fs.existsSync(target)

if (newDb && process.env.BUCKET_NAME) {
  await exec(`npx litestream restore -config litestream.yml -if-replica-exists ${target}`)
}

const newDb2 = !fs.existsSync(target)
if (newDb2) {
  // prepare database
  await exec('npx prisma migrate deploy')
  await exec('npx prisma migrate status')
}

// launch application
if (process.env.BUCKET_NAME) {
  await exec(`npx litestream replicate -config litestream.yml -exec ${JSON.stringify(process.argv.slice(2).join(' '))}`)
} else {
  await exec(process.argv.slice(2).join(' '))
}

function exec(command) {
  const child = spawn(command, { shell: true, stdio: 'inherit', env })
  return new Promise((resolve, reject) => {
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} failed rc=${code}`))
      }
    })
  })
}
