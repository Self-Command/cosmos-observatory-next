# 宇宙观测台 Next

原生 Obsidian 桌面插件的全新开发工程：动态目录世界、真实三维文件球、独立球体布局、shadcn/ui 浮动控制台和由实际检查驱动的蜘蛛。

本仓库按用户要求公开，使用标准 GitHub-hosted runners。安装依赖、编译、测试和打包全部在 GitHub Actions 执行。

目前处于 M0 工程准备。已完整引入固定版本的 CosmoGraph；首个工作流只验证上游底座，不是新版插件的完成验收，也不是安装候选。具体进度见 [PROGRESS](docs/PROGRESS.md)，完整约束见 [开发计划](docs/DEVELOPMENT-PLAN.md)。

公开源码和 CI 仅使用已登记第三方源码及合成数据。私人笔记、会话、凭据、完整 vault 以及旧插件配置不进入本仓库或公开产物。

CosmoGraph 原始源码来自 [n1ghtmare-dev/obsidian-cosmograph](https://github.com/n1ghtmare-dev/obsidian-cosmograph/tree/c455f466f7df9c23724ba291aa9f2463ca553aaa)，保留 [MIT 许可](vendor/cosmograph/LICENSE)。
