import './guard.mjs';
import { readFile } from 'node:fs/promises';import { createHash } from 'node:crypto';
const integrity=JSON.parse(await readFile('dist/integrity.json','utf8'));for(const [file,expected] of Object.entries(integrity)){if(createHash('sha256').update(await readFile(`dist/plugin/${file}`)).digest('hex')!==expected)throw Error(`Immutable build changed: ${file}`);}
