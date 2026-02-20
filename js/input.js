// ==============================================================================
// 模組名稱: input.js
// 功能描述: 輸入事件處理器 — 支援滑鼠點擊、觸控點擊與觸控滑動 (swipe)
// ==============================================================================

/**
 * InputHandler — 輸入事件處理器
 *
 * 支援兩種操作模式：
 * 1. 點擊模式（桌面 / 手機）：點擊選取，再點相鄰格交換
 * 2. 滑動模式（手機）：在寶石上直接向相鄰方向滑動即交換
 *
 * @param {HTMLCanvasElement} canvas
 * @param {import('./renderer.js').Renderer} renderer
 * @param {function({row: number, col: number})} onClick 點擊/滑動回呼
 */
export class InputHandler {
    constructor(canvas, renderer, onClick) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.onClick = onClick;
        this.enabled = true;

        // 觸控起始點紀錄（用於 swipe 偵測）
        this._touchStart = null;
        /** 滑動最小距離（像素），小於此視為點擊 */
        this._swipeThreshold = 20;

        this._onMouseClick = this._onMouseClick.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);

        canvas.addEventListener('click', this._onMouseClick);
        canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    }

    /** 滑鼠點擊處理（桌面） */
    _onMouseClick(e) {
        if (!this.enabled) return;
        const { row, col } = this.renderer.screenToBoard(e.clientX, e.clientY);
        this.onClick({ row, col });
    }

    /** 觸控開始：記錄起始座標 */
    _onTouchStart(e) {
        if (!this.enabled) return;
        e.preventDefault();
        const touch = e.touches[0];
        this._touchStart = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            ...this.renderer.screenToBoard(touch.clientX, touch.clientY),
        };
    }

    /** 觸控結束：判斷是點擊還是 swipe */
    _onTouchEnd(e) {
        if (!this.enabled || !this._touchStart) return;
        e.preventDefault();

        const touch = e.changedTouches[0];
        const dx = touch.clientX - this._touchStart.clientX;
        const dy = touch.clientY - this._touchStart.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this._swipeThreshold) {
            // 距離太短 → 視為點擊
            this.onClick({ row: this._touchStart.row, col: this._touchStart.col });
        } else {
            // 距離夠長 → 視為 swipe，計算方向
            const { row: r, col: c } = this._touchStart;

            let targetRow = r;
            let targetCol = c;

            if (Math.abs(dx) > Math.abs(dy)) {
                // 水平滑動
                targetCol = dx > 0 ? c + 1 : c - 1;
            } else {
                // 垂直滑動
                targetRow = dy > 0 ? r + 1 : r - 1;
            }

            // 先觸發起始格的選取，再觸發目標格
            this.onClick({ row: r, col: c });
            // 略延遲，讓 game 先記錄 selectedGem
            requestAnimationFrame(() => {
                this.onClick({ row: targetRow, col: targetCol });
            });
        }

        this._touchStart = null;
    }

    /** 啟用/停用輸入 */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /** 銷毀（移除所有事件監聽） */
    destroy() {
        this.canvas.removeEventListener('click', this._onMouseClick);
        this.canvas.removeEventListener('touchstart', this._onTouchStart);
        this.canvas.removeEventListener('touchend', this._onTouchEnd);
    }
}
