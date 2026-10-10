/* Shared vault logic. Loaded through vault.adapter.read on desktop and mobile. */
module.exports = function createSystem(app, schema) {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const unique = (values) => [...new Set(values)];
  const list = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const cleanTags = (value) => unique(list(value).map(v => String(v).replace(/^#/, "").trim()).filter(Boolean));
  const today = (now = new Date()) => [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  const route = (folder) => folder;
  const folderOf = (file) => file.parent?.path ?? file.path.split("/").slice(0, -1).join("/");
  const frontmatter = (file) => clone(app.metadataCache.getFileCache(file)?.frontmatter ?? {});
  const quote = (value) => JSON.stringify(String(value));
  const inside = (folder, root) => folder === root || folder.startsWith(root + "/");
  const busy = app.__cosmosRouteLocks || (app.__cosmosRouteLocks = new Set());
  const isTag = tag => typeof tag === "string" && /^(?=.*[^\p{N}/])[\p{L}\p{M}\p{N}_/-]+$/u.test(tag) && !tag.startsWith("route/") && !tag.split("/").some(p => !p);
  function normalizeTags(value) {
    const tags = cleanTags(list(value).flatMap(v => String(v).split(/[,，\s]+/)));
    if (tags.some(t => t.startsWith("route/"))) throw new Error("主题标签不能填写旧系统路由。");
    if (tags.some(t => !isTag(t))) throw new Error("标签只能包含文字、数字、下划线、连字符和层级斜线，且不能全部为数字。");
    return tags;
  }

  function allowedFolder(key, folder) {
    const e = schema.entities[key];
    if (!e || typeof folder !== "string" || folder.includes("\\") || folder.split("/").some(p => !p || p === "." || p === "..")) return false;
    const stage = folder.split("/").slice(0, 2).join("/");
    const branches = schema.stageCategories?.[stage];
    const child = folder.split("/")[2];
    if (branches && child && !branches.includes(child)) return false;
    return e.folders.some(root => e.allowSubfolders === false ? folder === root : inside(folder, root));
  }

  function folderOptions(key) {
    const e = schema.entities[key];
    if (!e) return [];
    const candidates = app.vault.getAllLoadedFiles ? app.vault.getAllLoadedFiles().filter(f => f.extension === undefined).map(f => f.path) : e.folders;
    return unique([e.folder, ...candidates.filter(p => allowedFolder(key, p))]);
  }

  function directoryOptions(key, selectedStage) {
    const folders = folderOptions(key).filter(p => {
      const f = app.vault.getAbstractFileByPath(p);
      return f && f.extension === undefined;
    });
    const stages = unique(folders.map(p => p.split("/").slice(0, 2).join("/")));
    const stage = stages.includes(selectedStage) ? selectedStage : stages[0];
    const categories = (schema.stageCategories[stage] || []).map(c => stage + "/" + c)
      .filter(p => allowedFolder(key,p) && folders.includes(p));
    const direct = !categories.length && folders.includes(stage);
    return { stages, stage, categories, direct, folders: folders.filter(p => inside(p,stage) && (!categories.length || categories.some(c => inside(p,c)))) };
  }

  function archiveDestination(file, fm) {
    const category = schema.archiveCategories[fm.type];
    if (!category) throw new Error("该实体没有归档分类。");
    return schema.archiveFolder + "/" + category + "/" + file.name;
  }

  function timestamp(value) {
    if (value instanceof Date) return value.getTime();
    const text = String(value ?? "");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match) {
      const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return today(d) === text ? d.getTime() : NaN;
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return NaN;
    if (!Number.isFinite(timestamp(text.slice(0, 10)))) return NaN;
    return new Date(text).getTime();
  }

  function validateName(value) {
    const name = String(value ?? "").trim();
    if (!name || /[\\/:*?"<>|\[\]#\u0000-\u001f]/.test(name) || /[. ]$/.test(name)
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
      throw new Error("名称不能为空，也不能包含路径、保留字符或 Windows 设备名。");
    }
    return name.replace(/\.md$/i, "");
  }

  function yaml(data) {
    const scalar = (value) => value !== null && typeof value === "object" ? JSON.stringify(value) : typeof value === "boolean" || typeof value === "number" ? String(value) : quote(value);
    return Object.entries(data).filter(([key, value]) => key !== "position" && value !== undefined)
      .map(([key, value]) => Array.isArray(value)
        ? value.length ? `${key}:\n${value.map(v => "  - " + scalar(v)).join("\n")}` : `${key}: []`
        : `${key}: ${value === null ? "null" : scalar(value)}`).join("\n");
  }

  function normalizeValues(key, values = {}, now = new Date()) {
    const entity = schema.entities[key];
    if (!entity) throw new Error("未知实体类型：" + key);
    const status = values.status || entity.defaultStatus;
    if (!entity.statuses.includes(status)) throw new Error("该实体不允许使用状态：" + status);
    const source = values.source || "manual";
    const format = values.format || "note";
    if (!schema.sources.includes(source) || !schema.formats.includes(format)) throw new Error("来源或格式不在允许值中。");
    const project = list(values.project).map(String).filter(Boolean);
    if (project.length > 1) throw new Error("一个实体只允许一个主项目。");
    const tags = normalizeTags(values.tags);
    const publish = values.publish === true || values.publish === "true";
    const folder = values.folder || entity.folder;
    if (!allowedFolder(key, folder)) throw new Error("目录不符合当前实体的阶段职责：" + folder);
    const data = {
      type: entity.type, status, project, area: String(values.area || ""), source,
      ...(entity.fields.includes("source_url") ? { source_url: String(values.source_url || "") } : {}),
      format, publish, tags, route: route(folder), created: now.toISOString(), updated: now.toISOString()
    };
    if (key === "record") data.date = values.date || today(now);
    if (key === "output" && publish && ["published", "retired"].includes(status)) data.publishedDate = today(now);
    return data;
  }

  function templateFor(key, folder = schema.entities[key]?.folder) {
    const entity = schema.entities[key];
    if (!entity) throw new Error("未知实体类型：" + key);
    const match = Object.entries(entity.directoryTemplates || {})
      .filter(([root]) => inside(folder, root)).sort((a, b) => b[0].length - a[0].length)[0];
    return match ? { ...entity, body: match[1].body, template: match[1].template } : entity;
  }

  function writingBody(kind, role, language, title) {
    if (!['zh', 'en'].includes(language)) throw new Error("发布语言无效。");
    const index = role === 'index' && ['collection', 'series', 'book'].includes(kind);
    const name = (index ? 'amytisIndex' : kind === 'book' ? 'amytisChapter' : 'amytisArticle') + (language === 'en' ? 'En' : '');
    const template = schema.specialTemplates?.[name]?.body;
    if (!template) throw new Error("发布正文模板未登记：" + name);
    return template.replaceAll('{{title}}', () => String(title));
  }

  async function createEntity(key, name, values = {}, options = {}) {
    const entity = schema.entities[key];
    if (!entity || entity.externalCreator) throw new Error("任务由 TaskNotes 创建，周期记录由 Periodic Notes 创建。");
    const target = values.folder || entity.folder;
    if (!allowedFolder(key, target)) throw new Error("目录不符合当前实体的阶段职责：" + target);
    const folder = app.vault.getAbstractFileByPath(target);
    if (!folder || folder.extension !== undefined) throw new Error("目标目录不存在：" + target);
    const title = validateName(name);
    const data = normalizeValues(key, values, options.now);
    let destination = `${target}/${title}.md`;
    for (let n = 2; app.vault.getAbstractFileByPath(destination); n++) destination = `${target}/${title} ${n}.md`;
    const origin = options.origin;
    const sourceSection = origin ? `\n## 来源链接\n\n- [[${origin.path.replace(/\.md$/, "")}]]\n` : "";
    const file = await app.vault.create(destination, `---\n${yaml(data)}\n---\n\n# ${title}\n\n${templateFor(key, target).body}${sourceSection}`);
    if (options.open !== false) await app.workspace.getLeaf(false).openFile(file);
    return file;
  }

  function archiveEligibility(file, fm = frontmatter(file), now = new Date()) {
    const isTask = fm.type === "task" && allowedFolder("task", folderOf(file));
    const isOutput = fm.type === "output" && allowedFolder("output", folderOf(file));
    if (!isTask && !isOutput) return { eligible: false, reason: "当前目录或实体类型不支持归档" };
    if (isTask && !["done", "cancelled"].includes(fm.status)) return { eligible: false, reason: "任务尚未进入终态" };
    if (isOutput && !(fm.publish === true && ["published", "retired"].includes(fm.status))) return { eligible: false, reason: "成果未进入允许发布的终态" };
    const key = isTask ? "completedDate" : "publishedDate";
    if (!fm[key]) return { eligible: false, reason: "缺少 " + key };
    const at = timestamp(fm[key]);
    if (!Number.isFinite(at)) return { eligible: false, reason: key + " 无效" };
    if (at > now.getTime() - schema.archiveDays * 86400000) return { eligible: false, reason: "终态确认窗口未满 " + schema.archiveDays + " 天" };
    const destination = archiveDestination(file, fm);
    const targetFolder = app.vault.getAbstractFileByPath(destination.slice(0, destination.lastIndexOf("/")));
    if (!targetFolder || targetFolder.extension !== undefined) return { eligible: false, reason: "归档目录不存在" };
    if (app.vault.getAbstractFileByPath(destination)) return { eligible: false, reason: "归档目标存在同名文件" };
    return { eligible: true, reason: key + " 满足确认窗口", destination };
  }

  function availableActions(file, fm = frontmatter(file)) {
    return schema.actions.filter(a => a.from.some(p => inside(folderOf(file), p)) && a.types.includes(fm.type)
      && allowedFolder(fm.type, folderOf(file)));
  }

  // Only supplement structure. Never replace, interpret or execute the user's text.
  function splitContent(text) {
    const header = /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
    return { prefix: header?.[0] || "", body: text.slice(header?.[0].length || 0) };
  }

  function bodySections(body) {
    const lines = body.split(/(?<=\n)/);
    const sections = [];
    let fence = null, comment = false, offset = 0;
    for (const line of lines) {
      // Comments in fenced code are literal. Outside code, mask them without
      // changing offsets so hidden headings cannot satisfy a visible section.
      let visible = line;
      if (!fence && (comment || !/^ {0,3}(?:`{3,}|~{3,})/.test(line))) {
        visible = "";
        for (let i = 0; i < line.length;) {
          if (!comment && line.startsWith("<!--", i)) { comment = true; visible += "    "; i += 4; }
          else if (comment && line.startsWith("-->", i)) { comment = false; visible += "   "; i += 3; }
          else { visible += comment && !/[\r\n]/.test(line[i]) ? " " : line[i]; i++; }
        }
      }
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(visible);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = null;
      }
      if (!fence) {
        const heading = /^ {0,3}##[ \t]+(.+?)[ \t]*(?:\r?\n)?$/.exec(visible);
        if (heading) sections.push({ title: heading[1].replace(/ +#+$/, ""), at: offset });
      }
      offset += line.length;
    }
    if (fence) throw new Error("正文代码围栏未闭合，请先修正后再补齐或推进。");
    if (comment) throw new Error("正文隐藏注释未闭合，请先修正后再补齐或推进。");
    return sections.map((s, i) => ({ ...s, text: body.slice(s.at, sections[i + 1]?.at ?? body.length) }));
  }

  function supplementBody(body, key, title, folder) {
    const present = new Set(bodySections(body).map(s => s.title));
    const missing = bodySections(templateFor(key, folder).body).filter(s => !present.has(s.title));
    if (!missing.length) return body;
    // A second run sees the added headings and is a no-op. Existing sections remain intact.
    const start = body.trim() ? body : `${body}# ${title}\n`;
    // Earlier-stage content remains first. Append only missing later-stage sections.
    return `${start}${start.endsWith("\n\n") ? "" : start.endsWith("\n") ? "\n" : "\n\n"}${missing.map(s => s.text).join("\n")}`;
  }

  function sameProperties(data, expected) {
    const current = clone(data); delete current.position;
    return Object.keys(current).length === Object.keys(expected).length
      && Object.keys(expected).every(key => JSON.stringify(current[key]) === JSON.stringify(expected[key]));
  }

  async function executeAction(file, id, values = {}, now = new Date()) {
    if (!file) throw new Error("没有打开的活动笔记。");
    if (busy.has(file)) throw new Error("文件正在处理，请稍后重试。");
    busy.add(file);
    try { return await executeActionUnlocked(file, id, values, now); }
    finally { busy.delete(file); }
  }

  async function executeActionUnlocked(file, id, values, now) {
    const action = schema.actions.find(a => a.id === id);
    const fm = frontmatter(file);
    if (!action || !availableActions(file, fm).some(a => a.id === id)) throw new Error("当前目录或实体类型不允许执行该操作。");
    if (list(fm.project).filter(Boolean).length > 1) throw new Error("请先修正多个主项目。");
    if (action.mode === "create") {
      const project = id === "output" ? [`[[${file.path.replace(/\.md$/, "")}]]`] : list(fm.project);
      return createEntity(action.entity, values.name || file.basename || file.name.replace(/\.md$/, ""), {
        project, area: fm.area, source: fm.source, tags: fm.tags,
        source_url: fm.source_url, ...values
      }, { origin: file, now });
    }
    if (id === "archive") {
      const eligibility = archiveEligibility(file, fm, now);
      if (!eligibility.eligible) throw new Error(eligibility.reason);
    }
    if (id === "published" && fm.site_target === "amytis") {
      if (typeof app.__amytisValidatePublished !== 'function') throw new Error('请先打开 Amytis 发布入口，核验当前版本上线后再标记成果已发布。');
      await app.__amytisValidatePublished(file);
    }
    const targetKey = action.updates?.type || fm.type;
    const folder = id === "archive" ? archiveDestination(file, fm).split("/").slice(0, -1).join("/") : values.folder || action.folder || folderOf(file);
    if (id !== "archive" && !allowedFolder(targetKey, folder)) throw new Error("目标目录不符合实体职责。");
    const targetFolder = app.vault.getAbstractFileByPath(folder);
    if (!targetFolder || targetFolder.extension !== undefined) throw new Error("目标目录不存在：" + folder);
    const destination = `${folder}/${file.name}`;
    if (destination !== file.path && app.vault.getAbstractFileByPath(destination)) throw new Error("目标文件已存在：" + destination);
    const original = clone(fm);
    delete original.position;
    const needsBody = id === "repair-body" || (action.updates?.type && targetKey !== fm.type);
    let oldBody, newBody;
    if (needsBody) {
      if (typeof app.vault.read !== "function" || typeof app.vault.process !== "function") throw new Error("当前 Obsidian 缺少安全正文更新接口，操作未执行。");
      oldBody = splitContent(await app.vault.read(file)).body;
      newBody = supplementBody(oldBody, targetKey, file.basename || file.name.replace(/\.md$/, ""), folder);
      if (id === "repair-body" && oldBody === newBody) return file;
    }
    const next = id === "repair-body" ? { ...original, updated: now.toISOString() }
      : { ...original, ...action.updates, project: list(original.project), updated: now.toISOString() };
    if (id !== "repair-body") {
      if (targetKey === "record" && !next.date) next.date = values.date || today(now);
      next.tags = normalizeTags(original.tags);
      next.route = route(folder);
    }
    if (id === "published") next.publishedDate = today(now);
    if (id === "archive" && fm.type === "task") next.tags.push("archived");
    let propertiesWritten = false, bodyWritten = false;
    try {
      await app.fileManager.processFrontMatter(file, data => {
        if (!sameProperties(data, original)) throw new Error("属性在操作期间发生变化，操作未执行，请重试。");
        delete data.position;
        Object.assign(data, next);
      });
      propertiesWritten = true;
      if (needsBody && oldBody !== newBody) {
        await app.vault.process(file, text => {
          const current = splitContent(text);
          if (current.body !== oldBody) throw new Error("正文在操作期间发生变化，已停止补入模板，请重试。");
          return current.prefix + newBody;
        });
        bodyWritten = true;
      }
      if (file.path !== destination) await app.fileManager.renameFile(file, destination);
    } catch (error) {
      if (bodyWritten) await app.vault.process(file, text => {
        const current = splitContent(text);
        if (current.body !== newBody) throw new Error("回滚时检测到新的正文修改，已保留正文，请检查当前属性与目录。原错误：" + error.message);
        return current.prefix + oldBody;
      });
      if (propertiesWritten) await app.fileManager.processFrontMatter(file, data => {
          if (!sameProperties(data, next)) throw new Error("回滚时检测到新的属性修改，已保留属性，请检查当前目录。原错误：" + error.message);
          for (const key of Object.keys(data)) delete data[key];
          Object.assign(data, original);
        });
      throw error;
    }
    return file;
  }

  function archivePreview(now = new Date()) {
    const items = [];
    for (const file of app.vault.getMarkdownFiles()) {
      const fm = frontmatter(file);
      if (!(fm.type === "task" && ["done", "cancelled"].includes(fm.status))
        && !(fm.type === "output" && ["published", "retired"].includes(fm.status))) continue;
      if (!allowedFolder(fm.type, folderOf(file))) continue;
      items.push({ file, ...archiveEligibility(file, fm, now) });
    }
    return items;
  }

  async function archiveFiles(items, now = new Date()) {
    const result = { moved: [], failed: [] };
    for (const item of items.filter(i => i.eligible)) {
      try { await executeAction(item.file, "archive", {}, now); result.moved.push(item.file.path); }
      catch (error) { result.failed.push({ path: item.file.path, reason: error.message }); }
    }
    return result;
  }

  function routeEligibility(file, fm = frontmatter(file)) {
    if (file.extension !== "md" || !/^(星云|太阳|月亮|地球)\//.test(file.path)
      || inside(file.path,schema.attachmentFolder) || inside(file.path,"星云/星尘/阅读数据")) return { eligible:false, reason:"不属于路由校正业务范围" };
    if (!allowedFolder(fm.type,folderOf(file))) return { eligible:false, reason:"当前目录与实体职责不一致，请先运行系统检查" };
    if (typeof fm.route !== "string" || !allowedFolder(fm.type,fm.route)) return { eligible:false, reason:"route 目标不符合当前实体职责" };
    if (folderOf(file).split("/").slice(0,2).join("/") !== fm.route.split("/").slice(0,2).join("/")) return { eligible:false, reason:"跨阶段移动必须使用生命周期命令" };
    const folder = app.vault.getAbstractFileByPath(fm.route);
    if (!folder || folder.extension !== undefined) return { eligible:false, reason:"route 目标目录不存在" };
    const destination = fm.route + "/" + file.name;
    if (destination === file.path) return { eligible:false, reason:"目录已一致", unchanged:true };
    if (app.vault.getAbstractFileByPath(destination)) return { eligible:false, reason:"目标存在同名文件" };
    return { eligible:true, destination };
  }

  async function moveByRoute(file, now = new Date()) {
    if (busy.has(file)) return { eligible:false, reason:"文件正在处理" };
    busy.add(file);
    try {
      const fm=frontmatter(file), decision=routeEligibility(file,fm);
      if (!decision.eligible) return decision;
      const original=clone(fm); delete original.position;
      await app.fileManager.processFrontMatter(file,d=>{d.updated=now.toISOString();});
      try { await app.fileManager.renameFile(file,decision.destination); }
      catch(error) {
        await app.fileManager.processFrontMatter(file,d=>{for(const k of Object.keys(d))delete d[k];Object.assign(d,original);});
        throw error;
      }
      return {...decision,moved:true};
    } finally { busy.delete(file); }
  }

  async function syncRouteAfterRename(file,oldPath) {
    if (busy.has(file) || file.extension !== "md" || !/^(星云|太阳|月亮|地球)\//.test(oldPath || "")) return;
    const fm=frontmatter(file);
    if (!allowedFolder(fm.type,folderOf(file))) return;
    if (fm.route===folderOf(file)) return;
    busy.add(file);
    try { await app.fileManager.processFrontMatter(file,d=>{d.route=folderOf(file);}); }
    finally {busy.delete(file);}
  }

  function inspect() {
    const issues = [];
    for (const file of app.vault.getMarkdownFiles()) {
      if (!/^(星云|太阳|月亮|地球|黑洞)\//.test(file.path)) continue;
      if (file.path.startsWith(schema.attachmentFolder + "/") || file.path.startsWith("星云/星尘/阅读数据/")) continue;
      const fm = frontmatter(file);
      const entity = schema.entities[fm.type];
      const add = reason => issues.push({ path: file.path, reason });
      if (!entity) { add("缺少或未知 type"); continue; }
      if (!entity.statuses.includes(fm.status)) add("status 不在允许值中");
      const historical = inside(folderOf(file), schema.archiveFolder) || inside(folderOf(file), schema.sealedFolder);
      if (historical) {
        const root = inside(folderOf(file), schema.archiveFolder) ? schema.archiveFolder : schema.sealedFolder;
        if (!inside(folderOf(file), root + "/" + schema.archiveCategories[fm.type])) add("归档分类与实体类型不一致");
      } else if (!allowedFolder(fm.type, folderOf(file))) add("目录与实体类型不一致");
      if (typeof fm.route !== "string" || fm.route !== folderOf(file)) add("route 与当前目录不一致");
      if (!Array.isArray(fm.tags) || fm.tags.some(t => !isTag(t))) add("tags 必须是合法的原生标签列表，不能包含旧路由");
      if (Object.prototype.hasOwnProperty.call(fm,"topics")) add("topics 尚未迁移至 tags");
      if (!schema.sources.includes(fm.source)) add("缺少或未知 source");
      if (!schema.formats.includes(fm.format)) add("缺少或未知 format");
      if (typeof fm.publish !== "boolean") add("publish 必须是布尔值");
      if (!Array.isArray(fm.project)) add("project 必须是列表");
      if (list(fm.project).filter(Boolean).length > 1) add("存在多个主项目");
      if (!Number.isFinite(timestamp(fm.created)) || !Number.isFinite(timestamp(fm.updated))) add("缺少或无效 created / updated");
      if (fm.type === "task" && ["done", "cancelled"].includes(fm.status) && !Number.isFinite(timestamp(fm.completedDate))) add("终态任务缺少有效 completedDate");
      if (fm.type === "output" && fm.publish === true && ["published", "retired"].includes(fm.status) && !Number.isFinite(timestamp(fm.publishedDate))) add("终态成果缺少有效 publishedDate");
    }
    return issues;
  }

  return { today, timestamp, yaml, normalizeValues, createEntity, availableActions, executeAction, archiveEligibility, archivePreview, archiveFiles, inspect, frontmatter, cleanTags, normalizeTags, isTag, allowedFolder, folderOptions, directoryOptions, archiveDestination, routeEligibility, moveByRoute, syncRouteAfterRename, splitContent, bodySections, supplementBody, templateFor, writingBody };
};
