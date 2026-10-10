import './guard.mjs';
import { cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sha = '2d3f1cd436b18ea12f24130de4df781355925b08';
const names = ['button', 'card', 'input', 'badge', 'switch', 'slider', 'tabs', 'scroll-area', 'dialog', 'table', 'select', 'tooltip', 'dropdown-menu', 'sheet'];
await mkdir('src/ui/official', { recursive: true });
const componentSources = [];
for (const name of names) {
  const url = `https://raw.githubusercontent.com/shadcn-ui/ui/${sha}/apps/v4/registry/new-york-v4/ui/${name}.tsx`;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Official component unavailable: ${name} / ${response.status}`);
  const raw = await response.text();
  let text = raw.replaceAll('from "cn"', 'from "@/lib/utils"').replaceAll('@/registry/new-york-v4/ui/', '@/ui/official/');
  if (name === 'dialog') {
    if (!text.includes('<DialogPrimitive.Portal data-slot="dialog-portal"')) throw Error('Dialog portal source changed');
    text = 'import { usePortalContainer } from "@/ui/PortalContext"\n' + text.replace('<DialogPrimitive.Portal data-slot="dialog-portal"', '<DialogPrimitive.Portal container={usePortalContainer()} data-slot="dialog-portal"');
  }
  await writeFile(`src/ui/official/${name}.tsx`, text);
  componentSources.push({ name, url, originalSHA256: createHash('sha256').update(raw).digest('hex'), customizedSHA256: createHash('sha256').update(text).digest('hex') });
}
const licenseURL = `https://raw.githubusercontent.com/shadcn-ui/ui/${sha}/LICENSE.md`;
const license = await fetch(licenseURL);
if (!license.ok) throw Error('Official shadcn license missing');
await writeFile('src/ui/official/LICENSE.md', await license.text());
await writeFile('docs/shadcn-source.json', JSON.stringify({ repository: 'shadcn-ui/ui', commit: sha, components: componentSources, patches: ['Import path adaptation', 'Dialog portal scoped to current Obsidian shadow view'] }, null, 2) + '\n');

await cp('vendor/cosmograph/src', 'src/framework/cosmograph', { recursive: true });
const graphPath = 'src/framework/cosmograph/graph/SphericalGraph.ts';
let graph = (await readFile(graphPath, 'utf8')).replaceAll('private ', 'protected ');
const replace = (from, to) => {
  if (!graph.includes(from)) throw Error(`CosmoGraph patch anchor not found: ${from.slice(0, 70)}`);
  graph = graph.replace(from, to);
};
replace('core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>', 'core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>');
replace('new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })', 'new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.35, transparent: true, opacity: 0.9 })');
replace('    this.camera.position.z = this.focusedId ? (width < 720 ? 18.8 : 10.45) : this.defaultCameraZ;', '    // Custom multi-world view retains the camera during resize.');
replace('uIntensity: { value: 1 },', 'uIntensity: { value: 1 },\n        uWorldColor: { value: new THREE.Color(0xb299ff) },');
replace('uniform float uIntensity;', 'uniform float uIntensity;\n        uniform vec3 uWorldColor;');
replace('auraColor = mix(auraColor, magenta, smoothstep(0.58, 0.96, flow) * 0.54);', 'auraColor = uWorldColor;');
// Release the original terrain and sky geometries as well as the customized network.
replace('    this.renderer.dispose();', `    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
      else mesh.material?.dispose();
    });
    this.renderer.dispose();`);
await writeFile(graphPath, graph);
const pluginPath = 'src/framework/cosmograph/obsidian/plugin.ts';
let plugin = await readFile(pluginPath, 'utf8');
plugin = plugin.replace('from "./CosmographView"', 'from "../../../host/ObservatoryView"').replace('from "./settings"', 'from "../../../host/Settings"').replaceAll('Open CosmoGraph 3D', '打开宇宙观测台').replaceAll('Open 3D knowledge graph', '打开宇宙观测台').replaceAll('Refresh 3D knowledge graph', '刷新宇宙观测台');
await writeFile(pluginPath, plugin);
await writeFile('docs/cosmograph-patches.json', JSON.stringify({ commit: 'c455f466f7df9c23724ba291aa9f2463ca553aaa', generation: 'Actions only', patches: ['Expose protected renderer extension points', 'Lit file-sphere material', 'Semantic aura uniform', 'Preserve camera during resize', 'Dispose all original scene resources', 'Route original native registration to customized view/settings'] }, null, 2) + '\n');
