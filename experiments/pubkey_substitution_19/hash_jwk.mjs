// SHA-256 hex over the exact JWK string argument — mirrors KeyHashing.sha256Hex.
import { createHash } from 'node:crypto'
process.stdout.write(createHash('sha256').update(process.argv[2], 'utf8').digest('hex'))
