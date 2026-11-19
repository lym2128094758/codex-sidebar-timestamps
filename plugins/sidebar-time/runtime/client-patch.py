import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tomllib
import urllib.parse
import urllib.request

from websockets.sync.client import connect


ROOT = Path(__file__).resolve().parent
APP_URL = "app://-/index.html"
STOP_EVENT = r"Local\CodexInlineSidebarTimes.Stop"
SOURCE = (ROOT / "client-patch.js").read_text(encoding="utf-8")
HOME = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex")
kernel = ctypes.WinDLL("kernel32", use_last_error=True)
kernel.CreateEventW.argtypes = (wintypes.LPVOID, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR)
kernel.CreateEventW.restype = wintypes.HANDLE
kernel.SetEvent.argtypes = (wintypes.HANDLE,)
kernel.WaitForSingleObject.argtypes = (wintypes.HANDLE, wintypes.DWORD)
kernel.CloseHandle.argtypes = (wintypes.HANDLE,)


def debugger_ports():
    script = r"""
    Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe' OR Name='Codex.exe'" |
        Where-Object { $_.ExecutablePath -like '*\WindowsApps\OpenAI.Codex_*' } |
        ForEach-Object {
            if ($_.CommandLine -match '(?:^| )--remote-debugging-port=(\d+)(?: |$)') { $Matches[1] }
        } | Select-Object -Unique
    """
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", script],
        capture_output=True, text=True, timeout=6, creationflags=subprocess.CREATE_NO_WINDOW,
    )
    return [int(value) for value in result.stdout.split() if value.isascii() and value.isdigit()]


def thread_times():
    uri = (HOME / "state_5.sqlite").resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=1) as database:
        return dict(database.execute("""
            SELECT 'local:' || id,
                   COALESCE(NULLIF(recency_at_ms, 0), NULLIF(recency_at, 0) * 1000,
                            NULLIF(updated_at_ms, 0), updated_at * 1000)
            FROM threads WHERE archived = 0
        """))


def display_enabled():
    try:
        with (HOME / "config.toml").open("rb") as file:
            config = tomllib.load(file)
    except FileNotFoundError:
        return True
    plugin = config.get("plugins", {}).get("sidebar-time@local-sidebar-tools", {})
    skills = config.get("skills", {}).get("config", [])
    return plugin.get("enabled") is not False and not any(
        skill.get("name") == "sidebar-time:toggle" and skill.get("enabled") is False
        for skill in skills
    )


def patch(port, times):
    expression = SOURCE + "(" + json.dumps(times) + ")"
    results = []
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2) as response:
        targets = json.load(response)
    for target in targets:
        if target.get("type") != "page" or target.get("url") != APP_URL:
            continue
        endpoint = urllib.parse.urlsplit(target["webSocketDebuggerUrl"])
        if endpoint.scheme != "ws" or endpoint.hostname not in ("127.0.0.1", "localhost") or endpoint.port != port:
            continue
        with connect(endpoint.geturl(), open_timeout=2, close_timeout=1) as client:
            client.send(json.dumps(dict(id=1, method="Runtime.evaluate", params=dict(
                expression=expression, returnByValue=True,
            ))))
            reply = json.loads(client.recv(timeout=2))["result"]
            if "exceptionDetails" in reply:
                raise RuntimeError(reply["result"].get("description", "Sidebar patch failed"))
            results.append(reply["result"].get("value"))
    return results


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--stop", action="store_true")
    mode.add_argument("--once", action="store_true")
    mode.add_argument("--status", action="store_true")
    args = parser.parse_args()
    event = kernel.CreateEventW(None, True, False, STOP_EVENT)
    if not event:
        raise ctypes.WinError(ctypes.get_last_error())
    already_running = ctypes.get_last_error() == 183
    ports = []
    try:
        if args.status:
            watching = already_running and kernel.WaitForSingleObject(event, 0) != 0
            enabled = display_enabled()
            print(json.dumps({"running": watching and enabled, "watching": watching, "enabled": enabled}))
            return
        if args.stop:
            kernel.SetEvent(event)
            for port in debugger_ports():
                patch(port, None)
            return
        if already_running and not args.once:
            return
        cycle = 0
        previously_enabled = None
        while True:
            try:
                enabled = display_enabled()
                results = []
                if enabled:
                    if not ports or cycle == 0 or not previously_enabled:
                        ports = debugger_ports()
                    times = thread_times()
                    results = [result for port in ports for result in patch(port, times)]
                    cycle = (cycle + 1) % 8
                elif previously_enabled is not False:
                    for port in ports or debugger_ports():
                        patch(port, None)
                previously_enabled = enabled
                if args.once:
                    print(json.dumps(results))
                    return
            except (OSError, sqlite3.Error, TimeoutError, RuntimeError, subprocess.TimeoutExpired, tomllib.TOMLDecodeError):
                if args.once:
                    raise
                cycle = 0
            if kernel.WaitForSingleObject(event, 3000) == 0:
                break
    finally:
        if not (args.once or args.stop or args.status or already_running):
            for port in ports:
                try:
                    patch(port, None)
                except (OSError, TimeoutError, RuntimeError):
                    pass
        kernel.CloseHandle(event)


if __name__ == "__main__":
    main()
