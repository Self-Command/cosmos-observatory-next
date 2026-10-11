import { defineConfig } from '@playwright/test';
const mesa=process.env.SOFTWARE_GL==='llvmpipe';
export default defineConfig({testDir:process.env.STRESS==='true'?'tests/performance':'tests/browser',testIgnore:process.env.RENDER_DIAG==='true'?[]:['**/render-diagnosis.spec.ts'],timeout:90000,workers:1,use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1560,height:1120},headless:!mesa,video:process.env.STRESS==='true'?'off':'on',launchOptions:{args:['--enable-webgl','--use-gl=angle',mesa?'--use-angle=gl':'--use-angle=swiftshader','--enable-unsafe-swiftshader',...(mesa?['--ignore-gpu-blocklist']:[])]}},webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4173',timeout:30000},outputDir:'test-results/browser'});

