---
name: toggle
description: 开启、关闭或查看 Windows Codex 左侧栏的聊天时间。
---

在 Windows 本机执行。将 `../../runtime/client-patch.py` 解析为相对于本技能目录的绝对路径。

- `on` 或“开启”：启动侧栏时间。
- `off` 或“关闭”：停止侧栏时间。
- `status` 或“状态”：只查询当前状态。
- 无参数：开启时关闭，关闭时开启。

用 `python.exe <脚本绝对路径> --status` 读取 `running`、`watching` 和 `enabled`。关闭时如果 `watching` 为真，运行 `python.exe <脚本绝对路径> --stop`，然后查询状态。开启时如果 `enabled` 为假，请用户先打开插件详情页的开关。如果已经处于指定状态，直接报告。

开启时先运行 `python.exe <脚本绝对路径> --once`。如果结果里至少一个窗口的 `total` 大于零，用 `Start-Process` 和 `-WindowStyle Hidden` 通过 `pythonw.exe` 启动同一个脚本，不加参数。查询状态后报告结果。补丁找不到聊天行时，说明当前客户端没有提供可用的本机调试接口或窗口尚未加载。缺少 Python 或 `websockets` 时，说明缺少的依赖。
