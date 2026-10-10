/* Project reverse index. The source note's project property is the only authority. */
module.exports = function projectIndex(app, schema, system) {
  const START = '<!-- cosmos-project-index:start -->';
  const END = '<!-- cosmos-project-index:end -->';
  const state = app.__cosmosProjectIndexState || (app.__cosmosProjectIndexState = {tail: Promise.resolve(), timer: null, stopped: false, report: null});
  const fm = file => system.frontmatter(file);
  const folder = file => file.parent?.path || file.path.split('/').slice(0, -1).join('/');
  const validProject = file => file?.extension === 'md' && fm(file).type === 'project' && system.allowedFolder('project', folder(file));
  function validSource(file) {
    const data = fm(file), key = data.type;
    if (file.extension !== 'md' || !schema.entities[key]) return false;
    if (system.allowedFolder(key, folder(file))) return true;
    return [schema.archiveFolder, schema.sealedFolder].some(root => root && folder(file).startsWith(root + '/' + schema.archiveCategories[key]));
  }
  function resolve(value, source) {
    if (typeof value !== 'string') return {reason: 'project 必须使用项目笔记的内部链接'};
    const match = /^\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]$/.exec(value.trim());
    if (!match) return {reason: 'project 中的“' + value + '”是普通文字；请先创建项目，再填写 [[项目笔记]]'};
    const target = match[1].replace(/\.md$/i, '');
    if (target.includes('\\') || target.split('/').some(p => !p || p === '.' || p === '..')) return {reason: '项目链接路径不合法'};
    let file = app.metadataCache.getFirstLinkpathDest?.(match[1], source.path);
    if (!file) file = app.vault.getAbstractFileByPath(target + '.md');
    if (!file && !target.includes('/')) {
      const candidates = app.vault.getMarkdownFiles().filter(f => f.basename === target && validProject(f));
      if (candidates.length > 1) return {reason: '项目名称重名，请使用完整路径链接'};
      file = candidates[0];
    }
    if (!validProject(file)) return {reason: file ? '链接目标不是合法项目实体' : '项目链接目标不存在，请先创建项目'};
    if (file.path === source.path) return {reason: '项目不能关联自身'};
    return {file};
  }
  function collect() {
    const files = app.vault.getMarkdownFiles();
    const entries = new Map(files.filter(validProject).map(f => [f.path, {file: f, members: []}]));
    const issues = [];
    const pending = files.filter(f => /^(星云|太阳|月亮|地球|黑洞)\//.test(f.path) && !app.metadataCache.getFileCache(f));
    for (const source of files.filter(validSource)) {
      const raw = fm(source).project;
      const values = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
      if (values.length > 1) {issues.push({path: source.path, reason: '存在多个主项目，未写入项目清单'});continue;}
      if (!values.length) continue;
      const target = resolve(values[0], source);
      if (target.reason) {issues.push({path: source.path, reason: target.reason});continue;}
      entries.get(target.file.path).members.push(source.path);
    }
    for (const entry of entries.values()) entry.members = [...new Set(entry.members)].sort((a,b) => a.localeCompare(b, 'zh-CN'));
    return {entries, issues, pending};
  }
  function replaceBlock(content, members) {
    const starts = content.split(START).length - 1, ends = content.split(END).length - 1;
    if (starts !== ends || starts > 1 || (starts && content.indexOf(START) > content.indexOf(END))) throw Error('关联笔记区块标记缺失或重复，已保留原正文');
    // A marker in a fenced example is not a managed section.
    if (starts) {
      let fenced = false, fenceChar = '', fenceLength = 0;
      for (const line of content.slice(0, content.indexOf(START)).split(/\r?\n/)) {
        const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
        if (!fence) continue;
        if (!fenced) {fenced = true;fenceChar = fence[1][0];fenceLength = fence[1].length;}
        else if (fence[1][0] === fenceChar && fence[1].length >= fenceLength) fenced = false;
      }
      if (fenced) throw Error('关联笔记标记位于代码示例内，已保留原正文');
    }
    const newline = content.includes('\r\n') ? '\r\n' : '\n';
    const block = [START, '## 关联笔记', '', '> 自动根据各笔记的 project 属性维护；请在来源笔记修改归属。', '', ...(members.length ? members.map(p => '- [[' + p.replace(/\.md$/i, '') + ']]') : ['暂无关联笔记。']), END].join(newline);
    if (starts) return content.slice(0, content.indexOf(START)) + block + content.slice(content.indexOf(END) + END.length);
    return content + (content.endsWith(newline + newline) ? '' : content.endsWith(newline) ? newline : newline + newline) + block + newline;
  }
  async function rebuild() {
    const {entries, issues, pending} = collect();
    if (pending.length) return {projects: entries.size, linked: 0, changed: 0, pending: pending.map(f => f.path), issues};
    const report = {projects: entries.size, linked: 0, changed: 0, issues: [...issues]};
    for (const {file, members} of entries.values()) {
      report.linked += members.length;
      try {
        const current = await app.vault.cachedRead(file);
        if (replaceBlock(current, members) === current) continue;
        let changed = false;
        await app.vault.process(file, content => {
          const next = replaceBlock(content, members);changed = next !== content;return next;
        });
        if (changed) report.changed++;
      } catch (error) {report.issues.push({path: file.path, reason: error.message});}
    }
    state.report = report;
    return report;
  }
  function sync() {
    state.tail = state.tail.catch(() => {}).then(() => state.stopped ? {stopped: true} : rebuild());
    return state.tail;
  }
  function schedule(onError) {
    if (state.stopped) return;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {state.timer = null;sync().catch(error => onError?.(error));}, 250);
  }
  function stop() {state.stopped = true;if (state.timer) clearTimeout(state.timer);state.timer = null;}
  function start() {state.stopped = false;}
  return {START, END, validProject, validSource, resolve, collect, replaceBlock, sync, schedule, stop, start, state};
};
