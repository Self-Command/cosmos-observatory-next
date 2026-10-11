import manifest from '../manifest.json';

declare const __COSMOS_BUILD_COMMIT__:string;
const commit=typeof __COSMOS_BUILD_COMMIT__==='string'?__COSMOS_BUILD_COMMIT__:'development';
export const buildIdentity={version:manifest.version,commit,label:`v${manifest.version} · ${commit.slice(0,7)}`};
