declare module '*.css' { const text: string; export default text; }
declare module '*.cjs' { const factory: (...args: any[]) => any; export default factory; }
