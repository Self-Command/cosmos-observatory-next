import './guard.mjs';
import './verify-build.mjs';
import archiver from 'archiver';import { createWriteStream } from 'node:fs';import { readFile,writeFile } from 'node:fs/promises';import { createHash } from 'node:crypto';
const output=createWriteStream('dist/cosmos-observatory-next.zip'),archive=archiver('zip',{zlib:{level:9}});const done=new Promise((resolve,reject)=>{output.on('close',resolve);output.on('error',reject);archive.on('error',reject);});archive.pipe(output);archive.directory('dist/plugin',false);await archive.finalize();await done;await writeFile('dist/SHA256SUMS',createHash('sha256').update(await readFile('dist/cosmos-observatory-next.zip')).digest('hex')+'  cosmos-observatory-next.zip\n');
