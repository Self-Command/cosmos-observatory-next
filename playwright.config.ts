import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:process.env.STRESS==='true'?'tests/performance':'tests/browser',timeout:60000,workers:1,use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1600,height:1000},headless:true,video:process.env.STRESS==='true'?'off':'on',launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4173',timeout:30000},outputDir:'test-results/browser'});

