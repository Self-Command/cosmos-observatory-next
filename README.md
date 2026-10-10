# 宇宙观测台 Next

原生 Obsidian 桌面插件：动态主目录世界、真实三维文件小球、可独立移动与旋转的大球、shadcn/ui 浮动六面板，以及由实际文件检查驱动的蜘蛛。

完整复用固定版本 CosmoGraph。默认球形、颜色和布局直接解析批准的 [SVG 源码](docs/assets/dashboard-spheres-v2.svg)；面板、背景与顶栏也复用其向量代码。观测数据来自真实 vault，展示锚点和装饰线不作为文件或关系统计。

依赖安装、编译、检查、测试、截图/录像和打包全部在 GitHub Actions 执行。现已通过浏览器交互和 Windows Obsidian 两个版本的核心测试；完整组合、Linux、压力与最终打包门槛的状态见 [执行记录](docs/PROGRESS.md)。当前仍为开发候选，不自动安装到真实库。

- [已批准开发计划](docs/DEVELOPMENT-PLAN.md)
- [实际架构与开发入口](docs/ARCHITECTURE.md)
- [使用指南](docs/USER-GUIDE.md)
- [公开来源接口与桥接](docs/SOURCE-INTEGRATIONS.md)
- [第三方来源与许可](docs/THIRD-PARTY-NOTICES.md)

公开源码和 CI 使用授权模型代码、独立测试插件程序和合成数据。私人笔记、会话、凭据、完整 vault 及私人插件配置不进入公开仓库。初版无大模型调用。

CosmoGraph 来自 [n1ghtmare-dev/obsidian-cosmograph](https://github.com/n1ghtmare-dev/obsidian-cosmograph/tree/c455f466f7df9c23724ba291aa9f2463ca553aaa)，保留 [MIT 许可](vendor/cosmograph/LICENSE)。