#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const env = { ...process.env }

// place Sqlite3 database on volume
const source = path.resolve('./dev.sqlite')
// fs.unlinkSync(source)
// console.log('>> unlinked source', source)
const target = '/data/' + path.basename(source)
// const files = fs.readdirSync('./');
// console.log('>> files in current directory', files)
console.log('>> source', source)
console.log('>> target', target)
console.log('>> fs.existsSync(source)', fs.existsSync(source))
console.log('>> fs.existsSync(/data)', fs.existsSync('/data'))

if (!fs.existsSync(source) && fs.existsSync('/data')) {
  try {
    console.log('>> try to create a symlink from', target, 'to', source)
    fs.symlinkSync(target, source, 'file')
    console.log('>> now fs.existsSync(source)', fs.existsSync(source))
  } catch (error) {
    console.error('>> error', error)
  }
}

const newDb = !fs.existsSync(target)
console.log('>> newDb', newDb)

if (newDb && process.env.BUCKET_NAME) {
  console.log('>> restoring database from bucket')
  await exec(`npx litestream restore -config litestream.yml -if-replica-exists ${target}`)
}

const newDb2 = !fs.existsSync(target)
console.log('>> newDb2', newDb2)
if (newDb2) {
  console.log('>> preparing database')
  // prepare database
  await exec('npx prisma migrate deploy')
  await exec('npx prisma migrate status')
}

const newDb3 = !fs.existsSync(target)
console.log('>> newDb3', newDb3)


// prepare database
//await exec('npx prisma migrate deploy')

// launch application
if (process.env.BUCKET_NAME) {
  console.log('>> starting background litestream replication of database to bucket')
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
