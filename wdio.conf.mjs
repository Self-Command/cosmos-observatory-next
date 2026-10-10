import './scripts/guard.mjs';import path from 'node:path';import {readFileSync} from 'node:fs';
const combination=process.env.HOST_PROFILE==='combination'?JSON.parse(readFileSync('fixtures/plugin-paths.json','utf8')).map(directory=>path.resolve(directory)):[];
export const config={runner:'local',framework:'mocha',specs:process.env.HOST_PROFILE==='stress'?['./tests/host/stress.e2e.mjs']:['./tests/host/native.e2e.mjs'],maxInstances:1,capabilities:[{browserName:'obsidian',browserVersion:process.env.OBSIDIAN_VERSION??'1.14.4','wdio:obsidianOptions':{installerVersion:'latest',plugins:[path.resolve('dist/plugin'),...combination],vault:path.resolve('fixtures/synthetic-vault')},'goog:chromeOptions':{args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}],services:['obsidian'],reporters:['spec'],cacheDir:path.resolve('.obsidian-cache'),mochaOpts:{ui:'bdd',timeout:process.env.HOST_PROFILE==='stress'?850000:180000},logLevel:'warn',outputDir:'test-results/host'};



