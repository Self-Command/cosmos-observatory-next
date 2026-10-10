export type Vec3 = [number, number, number];
export type Coverage = 'evaluated' | 'pending' | 'unassessed';
export interface WorldDescriptor { id: string; path: string; name: string; color: string; role: string; confirmed: boolean; centerId?: string; coverage: Coverage; count: number }
export interface FileDescriptor { id: string; path: string; name: string; extension: string; worldId: string; version: string; size: number; cacheReady: boolean; asset?: 'template' | 'script' | 'model' | 'plugin' }
export interface RelationDescriptor { id: string; source: string; target: string; kind: 'link' | 'property' | 'dependency'; evidence: string }
export interface Issue { rule: string; message: string; line?: number }
export interface InspectionResult { fileId: string; path: string; version: string; hash: string; checkedAt: number; status: 'pass' | 'issues' | 'unassessed' | 'pending' | 'failed'; issues: Issue[]; unassessed: string[]; rules: string[]; businessCheckedAt?: number; businessVersion?: string; dependencies: string[] }
export interface PatrolState { phase: 'idle' | 'locating' | 'checking' | 'paused'; taskId?: string; targetId?: string; fromId?: string; route: string[]; direct: boolean; startedAt?: number; completed: number }
export interface ObservatoryEvent { id: string; at: number; kind: 'file' | 'inspection' | 'agent' | 'model' | 'system'; source: string; action: string; fileId?: string; path?: string; status: 'success' | 'failed' | 'unknown' | 'cancelled'; sessionId?: string; runId?: string; sequence?: number; evidence: string }
export interface ModelState { status: 'ready' | 'missing' | 'incompatible' | 'changed' | 'pending'; version: string; reason: string; checkedAt?: number; issues: {path: string; reason: string}[]; coveredPaths: string[] }
export interface Snapshot { at: number; revision: number; worlds: WorldDescriptor[]; files: FileDescriptor[]; relations: RelationDescriptor[]; results: Record<string, InspectionResult>; model: ModelState; events: ObservatoryEvent[]; patrol: PatrolState; sourceStatus: string; replay: boolean; error?: string }
export interface WorldLayout { position: Vec3; rotation: Vec3; locked: boolean; color?: string; role?: string; radius?: number; centerPath?: string; confirmed?: boolean }
export interface PanelLayout { x: number; y: number; width: number; height: number; z: number; visible: boolean; locked: boolean; maximized: boolean; previous?: {x: number; y: number; width: number; height: number} }
export interface PersistentState { schemaVersion: 1; settings: Record<string, number | string | boolean>; identities: Record<string, string>; worlds: Record<string, WorldLayout>; panels: Record<string, PanelLayout> }
export const emptySnapshot = (): Snapshot => ({at:Date.now(),revision:0,worlds:[],files:[],relations:[],results:{},model:{status:'missing',version:'',reason:'未加载模型',issues:[],coveredPaths:[]},events:[],patrol:{phase:'idle',route:[],direct:false,completed:0},sourceStatus:'未接入',replay:false});
