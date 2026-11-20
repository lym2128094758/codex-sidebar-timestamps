# Codex 侧栏聊天时间

在 Windows 版 Codex 的原有聊天行右侧显示最后活动时间。今天显示为 `HH:mm`，更早的记录显示为 `MM/DD HH:mm`。时间随聊天行滚动，长标题自动截断。

**长期维护基线为 0.2.2（`8343777`）的行内实现。** 鼠标移入聊天行时，时间向左滑动，为置顶和归档按钮腾出空间；移开后滑回。关于架构、覆盖层方案的退步原因和后续维护要求，见[架构与维护说明](docs/architecture.md)。

## 环境要求

- Windows 版 Codex 桌面客户端。已在 Microsoft Store 版 Codex 26.1111.2228.0 上使用。
- 本机可运行 `codex` CLI，且 `python.exe` 和 `pythonw.exe` 可从 PATH 找到。需要 Python 3.11 或以上。
- Codex 客户端需要以启用本机调试接口的方式打开。普通入口如果没有提供该接口，安装或启用插件也不会显示时间。已运行的普通实例需要完全退出后再以相应方式启动。

## 安装

在仓库根目录运行以下命令。

```powershell
python -m pip install -r requirements.txt
codex plugin marketplace add .
codex plugin add sidebar-time@local-sidebar-tools
```

如果当前聊天没有加载新技能，在 Codex 里开一个新聊天。

## 使用

| 在 Codex 聊天中输入 | 效果 |
| --- | --- |
| `$sidebar-time:toggle` | 切换时间显示 |
| `$sidebar-time:toggle on` | 启动时间显示 |
| `$sidebar-time:toggle off` | 停止后台补丁并清除时间 |
| `$sidebar-time:toggle status` | 查看当前状态 |

补丁启动后会监听插件详情页里“侧栏时间”的开关。关闭开关后，时间通常在几秒内消失。只要后台补丁还在监听，重新打开开关就会恢复显示。安装本身不会启动后台补丁。

如果技能不可用，可双击 `plugins/sidebar-time/runtime/stop-client-patch.cmd` 来停止补丁。

## 时间来源

补丁按会话 ID 读取本机 Codex 数据库中的最近活动时间，必要时使用该会话的更新时间。找不到对应记录时，显示“时间未知”。补丁只读取会话 ID 和时间，运行时将标签插入客户端现有聊天行。

这是一个本地运行时补丁。它依赖当前客户端的聊天行结构和调试接口。客户端升级后可能需要适配。停止补丁会移除它加入的标签。

## 卸载

先停止补丁，再运行以下命令。

```powershell
codex plugin remove sidebar-time@local-sidebar-tools
codex plugin marketplace remove local-sidebar-tools
```
