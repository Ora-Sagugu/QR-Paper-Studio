/**
 * QR Paper Studio — 前端主逻辑（static/js/main.js）
 *
 * 【与其它文件的关系】
 * - index.html：提供 #a4Paper、#qrList、输入框等 DOM；本文件通过 getElementById 操作它们
 * - app.py：仅负责 POST /api/qrcode 生成图片；排版、拖拽、导出、打印全在前端完成
 * - style.css：.screen 布局 + @media print；拖拽时的 grab 光标也在 CSS 里
 *
 * 【核心思路】
 * - state.items：内存里的二维码列表（文字、图片 data URI、x/y/size）
 * - renderA4 / renderQrList：根据 state 重画页面（状态驱动 UI）
 * - 拖拽：改 state 里当前项的 x/y，并同步下方数字框；导出/打印读同一份 state
 */

// ========== 常量（与 A4 预览尺寸一致，导出 Canvas 也用这些值）==========
const API_URL = "/api/qrcode"; // 对应 app.py 的 @app.route("/api/qrcode")
const MAX_TEXT_LENGTH = 500;
const MAX_QR_COUNT = 12;
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const DEFAULT_QR_SIZE = 120;
/**
 * @typedef {Object} QrItem
 * @property {string} id
 * @property {string} text
 * @property {string} imageSrc  data:image/png;base64,...
 * @property {number} x
 * @property {number} y
 * @property {number} size
 */

// ========== 应用状态 ==========
/** @type {{ items: QrItem[], selectedId: string|null }} */
const state = {
    items: [],
    selectedId: null,
};

/** 拖拽进行中时记录的临时数据（与 state 分离，避免污染业务模型） */
const dragState = {
    dragging: false,
    itemId: null,
    offsetX: 0,
    offsetY: 0,
    pointerStartX: 0,
    pointerStartY: 0,
};

// ========== DOM 引用（id 定义见 templates/index.html）==========
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

// ========== 布局工具 ==========

/** 根据序号计算新二维码的默认位置（错开排列，减少重叠） */
function createDefaultLayout(index) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return {
        x: 40 + col * 180,
        y: 40 + row * 200,
        size: DEFAULT_QR_SIZE,
    };
}

/** 把 x/y 限制在 A4 范围内，避免拖出纸外 */
function clampPosition(item) {
    const maxX = A4_WIDTH - item.size;
    const maxY = A4_HEIGHT - item.size;
    item.x = Math.max(0, Math.min(item.x, maxX));
    item.y = Math.max(0, Math.min(item.y, maxY));
}

/** 只更新某一个二维码在预览区的 DOM 位置（拖拽时避免整页重绘） */
function updateItemDomPosition(item) {
    const box = a4Paper.querySelector(`[data-id="${item.id}"]`);
    if (!box) return;
    box.style.left = `${item.x}px`;
    box.style.top = `${item.y}px`;
    box.style.width = `${item.size}px`;
    box.style.height = `${item.size}px`;
}

function getSelectedItem() {
    return state.items.find((item) => item.id === state.selectedId) ?? null;
}

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

/** 滑块/数字框 → 写入当前选中项 → 更新预览区 DOM */
function applyControlsToSelected() {
    const item = getSelectedItem();
    if (!item) return;

    item.size = Number(qrSize.value);
    item.x = Number(qrX.value);
    item.y = Number(qrY.value);
    clampPosition(item);
    qrSizeValue.textContent = `${item.size} px`;
    updateItemDomPosition(item);
    qrX.value = String(item.x);
    qrY.value = String(item.y);
}

/** 当前选中项 → 回填到布局控件 */
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

function selectQr(id) {
    state.selectedId = id;
    syncControlsFromSelected();
    renderQrList();
    a4Paper.querySelectorAll(".qr-box").forEach((box) => {
        box.classList.toggle("is-selected", box.dataset.id === id);
    });
    updateToolbarState();
}

// ========== 渲染（state → DOM）==========

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

/** 根据 state.items 在 #a4Paper 内生成所有 .qr-box（含拖拽事件） */
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
        img.draggable = false;

        box.append(img);
        box.addEventListener("mousedown", (event) => onQrBoxMouseDown(event, item));

        a4Paper.append(box);
    });

    updateToolbarState();
}

// ========== 拖拽（指针事件挂在 document，拖出 A4 也不会丢）==========

function onDocumentMouseMove(event) {
    if (!dragState.dragging) return;

    const item = state.items.find((i) => i.id === dragState.itemId);
    if (!item) return;

    const paperRect = a4Paper.getBoundingClientRect();
    item.x = Math.round(event.clientX - paperRect.left - dragState.offsetX);
    item.y = Math.round(event.clientY - paperRect.top - dragState.offsetY);
    clampPosition(item);
    updateItemDomPosition(item);

    if (state.selectedId === item.id) {
        qrX.value = String(item.x);
        qrY.value = String(item.y);
    }
}

function onDocumentMouseUp() {
    if (!dragState.dragging) return;

    const box = a4Paper.querySelector(`[data-id="${dragState.itemId}"]`);
    if (box) box.classList.remove("is-dragging");

    dragState.dragging = false;
    dragState.itemId = null;
    document.body.style.userSelect = "";
}

function onQrBoxMouseDown(event, item) {
    event.preventDefault();
    selectQr(item.id);

    const box = event.currentTarget;
    const boxRect = box.getBoundingClientRect();

    dragState.dragging = true;
    dragState.itemId = item.id;
    dragState.offsetX = event.clientX - boxRect.left;
    dragState.offsetY = event.clientY - boxRect.top;
    dragState.pointerStartX = event.clientX;
    dragState.pointerStartY = event.clientY;

    box.classList.add("is-dragging");
    document.body.style.userSelect = "none";
}

// ========== 与后端通信（app.py）==========

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

/** 调用 Flask API 生成一个码，并 push 到 state.items */
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

function removeSelectedQr() {
    const item = getSelectedItem();
    if (!item) return;

    state.items = state.items.filter((i) => i.id !== item.id);
    state.selectedId = state.items.length ? state.items[state.items.length - 1].id : null;

    renderA4();
    renderQrList();
    syncControlsFromSelected();
    setMessage("已删除选中二维码", "success");
    updateToolbarState();
}

// ========== 导出与打印（读 state.items，与预览同一套坐标）==========

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

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

function printA4() {
    if (!state.items.length) {
        setMessage("请先添加至少一个二维码", "error");
        return;
    }
    window.print();
}

// ========== 事件绑定 ==========

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

    document.addEventListener("mousemove", onDocumentMouseMove);
    document.addEventListener("mouseup", onDocumentMouseUp);
}

bindEvents();
updateCharCount();
renderQrList();
setLayoutControlsEnabled(false);
updateToolbarState();
