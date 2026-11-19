(function applySidebarTimes(records) {
    const key = "__localCodexSidebarTimes";
    const selector = "[data-app-action-sidebar-thread-id]";
    const marker = "data-local-sidebar-time";
    if (records === null) {
        if (window[key]?.dispose) window[key].dispose();
        else window[key]?.observer.disconnect();
        document.querySelectorAll("[" + marker + "]").forEach(node => node.remove());
        delete window[key];
        return;
    }
    if (!window[key]) {
        const state = { records: {}, scheduled: false };
        const pad = value => String(value).padStart(2, "0");
        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
        const movingRows = new Map();
        const rowIsActive = row => row.matches(":hover, :focus-visible, :has(:focus-visible)");
        const resize = new ResizeObserver(entries => {
            for (const { target } of entries) {
                const item = movingRows.get(target);
                if (!item?.stamp.isConnected) continue;
                const active = rowIsActive(item.row);
                const left = item.stamp.offsetLeft;
                const previousLeft = item.left;
                const activeChanged = active !== item.active;
                item.left = left;
                item.active = active;
                if (left === previousLeft) continue;
                const offset = item.animation
                    ? new DOMMatrixReadOnly(getComputedStyle(item.stamp).transform).m41
                    : 0;
                item.animation?.cancel();
                item.animation = null;
                if (!activeChanged || reducedMotion.matches) continue;
                item.animation = item.stamp.animate(
                    [{ transform: `translateX(${previousLeft + offset - left}px)` }, { transform: "translateX(0)" }],
                    { duration: 180, easing: "cubic-bezier(.2,.75,.25,1)" }
                );
            }
        });
        state.render = () => {
            if (window[key] !== state) return;
            let total = 0, applied = 0, missing = 0;
            const activeTitles = new Set();
            for (const row of document.querySelectorAll(selector)) {
                const layout = Array.from(row.children).find(child =>
                    child.classList.contains("items-center") && child.classList.contains("w-full"));
                if (!layout) continue;
                const title = Array.from(layout.children).find(child =>
                    child.classList.contains("min-w-0") && child.classList.contains("flex-1"));
                const rail = title?.nextElementSibling;
                if (!title || !rail) continue;
                activeTitles.add(title);
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
                } else {
                    const date = new Date(millis);
                    const time = pad(date.getHours()) + ":" + pad(date.getMinutes());
                    const label = date.toDateString() === new Date().toDateString() ? time :
                        pad(date.getMonth() + 1) + "/" + pad(date.getDate()) + " " + time;
                    if (stamp.textContent !== label) stamp.textContent = label;
                    stamp.dateTime = date.toISOString();
                    stamp.title = date.toLocaleString();
                    applied++;
                }
                if (movingRows.get(title)?.stamp !== stamp) {
                    movingRows.get(title)?.animation?.cancel();
                    movingRows.set(title, { row, stamp, left: stamp.offsetLeft, active: rowIsActive(row) });
                    resize.observe(title);
                }
            }
            for (const [title, item] of movingRows) {
                if (activeTitles.has(title)) continue;
                resize.unobserve(title);
                item.animation?.cancel();
                movingRows.delete(title);
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
        state.dispose = () => {
            state.observer.disconnect();
            resize.disconnect();
            for (const item of movingRows.values()) item.animation?.cancel();
            movingRows.clear();
        };
        window[key] = state;
    }
    window[key].records = records;
    return window[key].render();
})
