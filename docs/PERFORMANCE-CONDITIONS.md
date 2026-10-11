# 软件渲染验收条件

性能门槛保持为：630 个文件节点平均至少 15 FPS；默认 1400 节点预算平均至少 10 FPS；原生输入事件到搜索结果绘制后下一帧的反馈 p95 最多 200 ms。两个场景各连续采样 20 秒，记录真实渲染完成帧、Worker、绘制调用、GPU 资源和输入样本。着色器失败、上下文丢失或节点数不符都会失败。

最终门禁使用独立的 `software-rendering` 作业：Ubuntu 24.04，4 vCPU、16 GB，锁文件对应的 Chromium，ANGLE/OpenGL 与 Mesa llvmpipe；Xvfb 1600×1200，应用视口 1560×1120，deviceScaleFactor=1；`LIBGL_ALWAYS_SOFTWARE=1`、`GALLIUM_DRIVER=llvmpipe`、`LP_NUM_THREADS=3`。测试直接核对 WebGL 驱动包含 llvmpipe，避免误用硬件 GPU。视频录制关闭；产品节点预算、分辨率上限、动画、巡查和引力默认值保持不变。实际 CPU、驱动、安装包版本及运行编号随证据保存。

性能测试与包含录制、故障注入和大量设置变化的功能回归分开执行，两者都使用 quality-build 生成的同一不可变构建。浏览器功能、原生宿主、十分钟耐久和独立软件性能都是必需任务。任何失败或意外跳过都会阻止打包；包内 PERFORMANCE-VERIFICATION.json 再核对提交、运行、软件驱动、节点数及三个性能门槛。

固定软件驱动是本轮验收条件的明确化。此前 `ubuntu-latest` 的 SwiftShader 场景在不同 CPU 上出现约一倍差异；这些失败结果保留，没有改写成达标。最终成绩明确标注 Mesa，不能声称是 SwiftShader 的成绩，也不能代替真实硬件测量。

| 记录 | CPU / 驱动 | 630 节点 FPS | 1400 节点 FPS | 输入 p95 ms | 结论 |
| --- | --- | --- | --- | --- | --- |
| 38104735227 | EPYC 7763 / SwiftShader | 9.79 | 5.54 | 174.9 | 旧软件条件失败 |
| 38104997404 | EPYC 9V45 / SwiftShader | 19.02 | 11.68 | 73.6 | 单次通过，未作为稳定候选证明 |
| 38106126912 | EPYC 9V74 / llvmpipe | 26.91 | 19.70 | 153.9 | 性能通过 |
| 38106300672 | EPYC 7763 / llvmpipe | 22.45 | 14.91 | 195.8 | 性能通过；独立空范围测试发现测试调用问题并修正 |
| 38106565163 | EPYC 7763 / llvmpipe | 21.49 | 14.26 | 184.3 | 性能、球体细节及库根／空范围流程通过 |

候选对应的最终成绩以包内 PERFORMANCE-VERIFICATION.json 为准，以上是复测追踪记录。开发期 SwiftShader 和 ARM 诊断入口保留，可单独运行；它们不混入最终软件基准的成绩。

软件驱动依据：[Mesa llvmpipe](https://docs.mesa3d.org/drivers/llvmpipe.html)、[Mesa 环境变量](https://docs.mesa3d.org/envvars.html)。
