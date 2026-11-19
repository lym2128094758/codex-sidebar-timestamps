(function applySidebarTimes(records) {
    const key = "__localCodexSidebarTimes";
    const selector = "[data-app-action-sidebar-thread-id]";
    const marker = "data-local-sidebar-time";
    if (records === null) {
        window[key]?.observer.disconnect();
        document.querySelectorAll("[" + marker + "]").forEach(node => node.remove());
        delete window[key];
        return;
    }
    if (!window[key]) {
        const state = { records: {}, scheduled: false };
        const pad = value => String(value).padStart(2, "0");
        state.render = () => {
            let total = 0, applied = 0, missing = 0;
            for (const row of document.querySelectorAll(selector)) {
                const layout = Array.from(row.children).find(child =>
                    child.classList.contains("items-center") && child.classList.contains("w-full"));
                if (!layout) continue;
                const title = Array.from(layout.children).find(child =>
                    child.classList.contains("min-w-0") && child.classList.contains("flex-1"));
                const rail = title?.nextElementSibling;
                if (!title || !rail) continue;
                total++;
                const id = row.getAttribute("data-app-action-sidebar-thread-id");
                let stamp = layout.querySelector(":scope > [" + marker + "]");
                if (!stamp) {
                    stamp = document.createElement("time");
                    stamp.setAttribute(marker, "");
                    Object.assign(stamp.style, {
                        flex: "0 0 auto",
                        marginInline: "6px 2px",
                        fontSize: "11px",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                        opacity: ".72",
                        pointerEvents: "none"
                    });
                    title.after(stamp);
                }
                const millis = state.records[id];
                if (!Number.isFinite(millis) || millis <= 0) {
                    if (stamp.textContent !== "时间未知") stamp.textContent = "时间未知";
                    stamp.removeAttribute("datetime");
                    stamp.removeAttribute("title");
                    missing++;
                    continue;
                }
                const date = new Date(millis);
                const time = pad(date.getHours()) + ":" + pad(date.getMinutes());
                const label = date.toDateString() === new Date().toDateString() ? time :
                    pad(date.getMonth() + 1) + "/" + pad(date.getDate()) + " " + time;
                if (stamp.textContent !== label) stamp.textContent = label;
                stamp.dateTime = date.toISOString();
                stamp.title = date.toLocaleString();
                applied++;
            }
            return { total, applied, missing };
        };
        state.observer = new MutationObserver(events => {
            if (events.every(event => event.target.closest?.("[" + marker + "]"))) return;
            if (state.scheduled) return;
            state.scheduled = true;
            requestAnimationFrame(() => {
                state.scheduled = false;
                state.render();
            });
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
        window[key] = state;
    }
    window[key].records = records;
    return window[key].render();
})
