import ts from 'typescript-eslint';
export default ts.config(
  {ignores:['vendor/**','src/framework/**','src/ui/official/**','src/model/reference/**','dist/**','sources/**','artifacts/**','fixtures/**','node_modules/**']},
  {files:['src/**/*.{ts,tsx}','tests/**/*.{ts,tsx}'],languageOptions:{parser:ts.parser},plugins:{'@typescript-eslint':ts.plugin},rules:{'no-unreachable':'error','no-constant-condition':['error',{checkLoops:false}],'no-dupe-args':'error','no-duplicate-case':'error','no-fallthrough':'error','no-async-promise-executor':'error','no-unsafe-finally':'error','@typescript-eslint/no-non-null-asserted-optional-chain':'error'}}
);

