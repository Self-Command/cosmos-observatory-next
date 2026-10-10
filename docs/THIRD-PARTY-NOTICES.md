# Sources and reuse

- CosmoGraph: n1ghtmare-dev, MIT, commit `c455f466f7df9c23724ba291aa9f2463ca553aaa`. Full original source preserved in vendor/cosmograph; full adapted source generated in Actions in src/framework/cosmograph. Native registration, original ItemView, vault graph reader and SphericalGraph renderer are reused. Customization is registered in cosmograph-patches.json.
- shadcn/ui: shadcn, MIT, commit `2d3f1cd436b18ea12f24130de4df781355925b08`. Official new-york-v4 Radix component sources generated in Actions; hashes and import/portal patches registered in shadcn-source.json. License retained in src/ui/official/LICENSE.md.
- Quaternius Spider: https://poly.pizza/m/yRYJiAJyiM, CC0. Model and Idle/Walk/Attack/Jump/Death animations reused with Three GLTFLoader and AnimationMixer. Asset hash in spider-source.json.
- Mission Control: composition reference only. No code or image used as product assets.
- Vault v3 schema, system-engine.cjs and project-index.cjs: Self-Command. Source byte hashes in model-source.json; only inspect/collect called through a read-only facade. Newly discovered engine code is never evaluated.

Runtime packages and precise versions are recorded in package-lock.json. Framework capabilities are composed; custom code implements vault projection, multi-world grouping, evidence binding, settings and the product theme.

- d3-force-3d 3.0.6: Vasco Asturiano, MIT, https://github.com/vasturiano/d3-force-3d. Mature 3D force simulation runs inside an isolated Worker. Custom forces only constrain members to their real world and preserve world transforms during drag. Dependency lock generation and validation run in Actions.
