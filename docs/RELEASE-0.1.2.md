修复整个宇宙背景与图谱一起闪烁的画布呈现链路。用户明确要求立即构建交付自行试用，本次没有运行自动测试、类型检查、宿主检查、截图或耐久测试；仅由 Actions 编译、打包并发布。此版本为试用预发布。

源码追踪发现的实际问题：configure 对每次设置变化无条件调用 setPixelRatio；Three.js 的该调用会重新设置画布尺寸并清除缓冲，即使像素比未变。resize 也无条件设置相同尺寸，清空的画布直到随后受帧率限制的 animation frame 才补画。另有自定义原始 WebGL READ_FRAMEBUFFER/blitFramebuffer 路径，绕过 Three.js 管理的最终输出；画布采用默认非保留缓冲。以上都在整张图谱的输出层，先前修改 CSS 面板未触及这些路径。

改动：只有实际宽、高或像素比改变时才调整绘制缓冲；真实缩放后在同一回调补画；启用 preserveDrawingBuffer 保留已完成画面；用 Three.js FullScreenQuad 呈现缓存背景，移除手动绑定帧缓冲及 blit；上下文恢复后重新上传背景纹理。图谱、背景、柔光和交互继续使用既有 CosmoGraph/Three.js。

这些是基于源码确认的缺陷及针对性修复，用户显卡环境下的最终效果待用户试用确认；本版不声明自动测试通过。保留绘制缓冲和全屏纹理拷贝可能影响性能，本次未测量。

下载 cosmos-observatory-next.zip，关闭观测台并禁用插件，完整覆盖程序文件，保留 state 与 data.json，完全退出并重新打开 Obsidian。底栏应显示 v0.1.2 及本次提交号。HOTFIX-STATUS.json 记录 testsRun=false 和精确构建来源。
