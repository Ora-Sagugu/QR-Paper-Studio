/**
 * QR Paper Studio — client-side controller
 *
 * Architecture
 * - state: in-memory list of QrItem (layout + image data URI per code)
 * - render: sync DOM (#a4Paper, #qrList) from state (state-driven UI)
 * - API: one POST /api/qrcode per new code (no batch endpoint by design)
 * - export: Canvas composites full A4 (595×842) for PNG download
 *
 * Terms: data URI = inline image string; async/await = non-blocking HTTP
 */

const API_URL = "/api/qrcode";
const MAX_TEXT_LENGTH = 500;
const MAX_QR_COUNT = 12;
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const DEFAULT_QR_SIZE = 120;

/**
 * @typedef {Object} QrItem
 * @property {string} id
 * @property {string} text
 * @property {string} imageSrc
 * @property {number} x
 * @property {number} y
 * @property {number} size
 */

/** @type {{ items: QrItem[], selectedId: string|null }} */
const state = {
    items: [],
    selectedId: null,
};

const qrText = document.getElementById("qrText");
const charCount = document.getElementById("charCount");
const addBtn = document.getElementById("addBtn");
const deleteBtn = document.getElementById("deleteBtn");
const downloadBtn = document.getElementById("downloadBtn");
const printBtn = document.getElementById("printBtn");
const message = document.getElementById("message");
const qrList = document.getElementById("qrList");
const qrListEmpty = document.getElementById("qrListEmpty");
const a4Paper = document.getElementById("a4Paper");
const layoutControls = document.getElementById("layoutControls");
const qrSize = document.getElementById("qrSize");
const qrSizeValue = document.getElementById("qrSizeValue");
const qrX = document.getElementById("qrX");
const qrY = document.getElementById("qrY");

/**
 * @param {number} index - zero-based index in state.items
 * @returns {{ x: number, y: number, size: number }}
 */
function createDefaultLayout(index) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return {
        x: 40 + col * 180,
        y: 40 + row * 200,
        size: DEFAULT_QR_SIZE,
    };
}

/**
 * @returns {QrItem|null}
 */
function getSelectedItem() {
    return state.items.find((item) => item.id === state.selectedId) ?? null;
}

/**
 * @param {string} text
 * @param {"success"|"error"|""} [type]
 */
function setMessage(text, type = "") {
    message.textContent = text;
    message.classList.remove("is-success", "is-error");
    if (type === "success") message.classList.add("is-success");
    if (type === "error") message.classList.add("is-error");
}

function updateCharCount() {
    const len = qrText.value.length;
    charCount.textContent = `已输入 ${len} / ${MAX_TEXT_LENGTH} 字`;
}

function updateToolbarState() {
    const hasItems = state.items.length > 0;
    const atLimit = state.items.length >= MAX_QR_COUNT;
    addBtn.disabled = atLimit;
    deleteBtn.disabled = !state.selectedId;
    downloadBtn.disabled = !hasItems;
    printBtn.disabled = !hasItems;
}

function setLayoutControlsEnabled(enabled) {
    layoutControls.classList.toggle("is-disabled", !enabled);
    layoutControls.setAttribute("aria-disabled", String(!enabled));
    qrSize.disabled = !enabled;
    qrX.disabled = !enabled;
    qrY.disabled = !enabled;
}

/**
 * Push control values into the selected QrItem and refresh A4 boxes.
 */
function applyControlsToSelected() {
    const item = getSelectedItem();
    if (!item) return;

    item.size = Number(qrSize.value);
    item.x = Number(qrX.value);
    item.y = Number(qrY.value);
    qrSizeValue.textContent = `${item.size} px`;

    const box = a4Paper.querySelector(`[data-id="${item.id}"]`);
    if (box) {
        box.style.width = `${item.size}px`;
        box.style.height = `${item.size}px`;
        box.style.left = `${item.x}px`;
        box.style.top = `${item.y}px`;
    }
}

/**
 * Sync range/number inputs from the selected item.
 */
function syncControlsFromSelected() {
    const item = getSelectedItem();
    if (!item) {
        setLayoutControlsEnabled(false);
        return;
    }

    setLayoutControlsEnabled(true);
    qrSize.value = String(item.size);
    qrX.value = String(item.x);
    qrY.value = String(item.y);
    qrSizeValue.textContent = `${item.size} px`;
}

/**
 * @param {string} id
 */
function selectQr(id) {
    state.selectedId = id;
    syncControlsFromSelected();
    renderQrList();
    a4Paper.querySelectorAll(".qr-box").forEach((box) => {
        box.classList.toggle("is-selected", box.dataset.id === id);
    });
    updateToolbarState();
}

/**
 * Rebuild the sidebar list from state.items.
 */
function renderQrList() {
    qrList.innerHTML = "";
    qrListEmpty.hidden = state.items.length > 0;

    state.items.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "qr-list-item";
        if (item.id === state.selectedId) li.classList.add("is-active");
        li.dataset.id = item.id;

        const badge = document.createElement("span");
        badge.className = "qr-list-index";
        badge.textContent = String(index + 1);

        const label = document.createElement("span");
        label.className = "qr-list-text";
        label.textContent = item.text;
        label.title = item.text;

        li.append(badge, label);
        li.addEventListener("click", () => selectQr(item.id));
        qrList.append(li);
    });
}

/**
 * Rebuild all .qr-box elements inside #a4Paper from state.items.
 */
function renderA4() {
    a4Paper.innerHTML = "";

    state.items.forEach((item) => {
        const box = document.createElement("div");
        box.className = "qr-box";
        box.dataset.id = item.id;
        if (item.id === state.selectedId) box.classList.add("is-selected");

        box.style.width = `${item.size}px`;
        box.style.height = `${item.size}px`;
        box.style.left = `${item.x}px`;
        box.style.top = `${item.y}px`;

        const img = document.createElement("img");
        img.src = item.imageSrc;
        img.alt = `二维码：${item.text}`;

        box.append(img);
        box.addEventListener("click", (event) => {
            event.stopPropagation();
            selectQr(item.id);
        });

        a4Paper.append(box);
    });

    updateToolbarState();
}

/**
 * @returns {string|null}
 */
function getValidatedInputText() {
    const text = qrText.value.trim();
    if (!text) {
        setMessage("请输入内容", "error");
        return null;
    }
    if (state.items.length >= MAX_QR_COUNT) {
        setMessage(`单页最多 ${MAX_QR_COUNT} 个二维码`, "error");
        return null;
    }
    return text;
}

/**
 * Request image from backend and append a new QrItem to state.
 * @returns {Promise<void>}
 */
async function addQrFromInput() {
    const text = getValidatedInputText();
    if (!text) return;

    setMessage("正在生成二维码...");
    addBtn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });

        const result = await response.json();
        if (!response.ok) {
            setMessage(result.error || "生成失败", "error");
            return;
        }

        const layout = createDefaultLayout(state.items.length);
        const item = {
            id: crypto.randomUUID(),
            text,
            imageSrc: result.image,
            ...layout,
        };

        state.items.push(item);
        renderA4();
        renderQrList();
        selectQr(item.id);
        setMessage(`已添加第 ${state.items.length} 个二维码`, "success");
        qrText.value = "";
        updateCharCount();
        qrText.focus();
    } catch {
        setMessage("网络错误，请确认后端已启动", "error");
    } finally {
        updateToolbarState();
    }
}

/** Remove the currently selected QrItem, if any. */
function removeSelectedQr() {
    const item = getSelectedItem();
    if (!item) return;

    state.items = state.items.filter((i) => i.id !== item.id);
    state.selectedId = state.items.length ? state.items[state.items.length - 1].id : null;

    renderA4();
    renderQrList();
    syncControlsFromSelected();
    a4Paper.querySelectorAll(".qr-box").forEach((box) => {
        box.classList.toggle("is-selected", box.dataset.id === state.selectedId);
    });

    setMessage("已删除选中二维码", "success");
    updateToolbarState();
}

/**
 * Load a data URI into an HTMLImageElement.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Composite all QrItems onto an off-screen canvas and trigger PNG download.
 * @returns {Promise<void>}
 */
async function exportA4Png() {
    if (!state.items.length) {
        setMessage("请先添加至少一个二维码", "error");
        return;
    }

    setMessage("正在导出 A4 图片...");

    try {
        const canvas = document.createElement("canvas");
        canvas.width = A4_WIDTH;
        canvas.height = A4_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

        for (const item of state.items) {
            const img = await loadImage(item.imageSrc);
            ctx.drawImage(img, item.x, item.y, item.size, item.size);
        }

        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "a4-layout.png";
        link.click();
        setMessage("A4 图片已开始下载", "success");
    } catch {
        setMessage("导出失败，请重试", "error");
    }
}

/** Open the browser print dialog (print CSS hides chrome, keeps #a4Paper). */
function printA4() {
    if (!state.items.length) {
        setMessage("请先添加至少一个二维码", "error");
        return;
    }
    window.print();
}

function bindEvents() {
    qrText.addEventListener("input", updateCharCount);

    qrSize.addEventListener("input", applyControlsToSelected);
    qrX.addEventListener("input", applyControlsToSelected);
    qrY.addEventListener("input", applyControlsToSelected);

    addBtn.addEventListener("click", addQrFromInput);
    deleteBtn.addEventListener("click", removeSelectedQr);
    downloadBtn.addEventListener("click", exportA4Png);
    printBtn.addEventListener("click", printA4);

    qrText.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.key === "Enter") {
            event.preventDefault();
            addQrFromInput();
        }
    });
}

bindEvents();
updateCharCount();
renderQrList();
setLayoutControlsEnabled(false);
updateToolbarState();
