# 公开来源接口与桥接边界

截至 2026-10-10 已核对 [Claude Code 官方 hooks](https://code.claude.com/docs/en/hooks) 和 [OpenAI 官方 App Server 协议](https://learn.chatgpt.com/docs/app-server)。具体适配在 `src/events/adapters.ts`，脱敏桥接 CLI 在 `src/events/bridge.ts`，Actions 将其编译为 bridge.mjs。

Claude 支持 SessionStart / SessionEnd / PreToolUse / PostToolUse / PostToolUseFailure。只投影 session_id、tool_use_id、事件名称、文件路径和结果；忽略 transcript_path、正文、工具输入内容与输出。Read 一律按部分读取记录，不把成功调用当作全文理解。写操作只在完成事件中归因。

Codex 适配 item/started 与 item/completed；只观察公开通知中 commandExecution、fileChange、mcpToolCall 与 dynamicToolCall 的生命周期。fileChange 完成时可投影 changes[].path；不接收 diff、命令、日志、消息 delta 或推理。该桥接需要由用户拥有的 App Server 客户端转发通知，不能凭这些接口访问 Codex 桌面已有会话。没有转发时显示未接入。

生产接收只监听 127.0.0.1，默认关闭，端口、事件容量和限流都可在设置中调整。接收端仅在观测面板打开时运行；关闭最后一个面板后停止接收，不补造关闭期间的来源事件。令牌在当前 vault 插件 state/receiver-token 文件，由本地桥接读取，不导出、不放在命令参数中。

```text
node bridge.mjs claude-hook <vault绝对路径> <receiver-token文件路径> <端口>
node bridge.mjs codex-public-api <vault绝对路径> <receiver-token文件路径> <端口>
```

第一种模式从 stdin 读取一份完整 hook JSON；第二种模式逐行读取客户端提供的通知。桥接只向本机接收端发脱敏事件，不启动模型、会话、进程工具或网络代理。客户端原来如何工作不由本插件接管。路径在 vault 外时不关联具体文件。

接收契约为 `/v1/events`，Bearer 鉴权，严格 Ajv 校验、8KiB 事件上限。id、at、source、action、sessionId、runId、status、sequence 必填，path 可选且必须是库内相对路径。禁止正文和自由格式附加字段。去重按来源和会话隔离；乱序或序号缺口单独留证。直接 bridge 来源只代表发送方声明，不代表独立验证工具行为。

目前没有修改用户真实 hooks，也没有把所有文件变化归因于 AI。hook 安装和实际来源接通在候选审阅后落实。
