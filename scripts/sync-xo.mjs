import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(new URL('..', import.meta.url)))
const from = join(root, 'backend/packages/domain/src/xo.ts')
const to = join(root, 'src/xo/rules.ts')

if (existsSync(from)) copyFileSync(from, to)
