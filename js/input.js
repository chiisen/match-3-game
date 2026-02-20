// ==============================================================================
// 模組名稱: input.js
// 功能描述: 輸入事件處理器 — 處理滑鼠點擊與觸控事件
// ==============================================================================

/**
 * InputHandler — 輸入事件處理器
 * 監聽 Canvas 的滑鼠與觸控事件，轉換為棋盤座標後通知回呼
 */
export class InputHandler {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {import('./renderer.js').Renderer} renderer
     * @param {function({row: number, col: number})} onClick 點擊回呼
     */
    constructor(canvas, renderer, onClick) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.onClick = onClick;
        this.enabled = true;

        this._onMouseClick = this._onMouseClick.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);

        canvas.addEventListener('click', this._onMouseClick);
        canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    }

    /** 滑鼠點擊處理 */
    _onMouseClick(e) {
        if (!this.enabled) return;
        const { row, col } = this.renderer.screenToBoard(e.clientX, e.clientY);
        this.onClick({ row, col });
    }

    /** 觸控開始處理 */
    _onTouchStart(e) {
        if (!this.enabled) return;
        e.preventDefault(); // 防止滑鼠事件重複觸發
        const touch = e.touches[0];
        const { row, col } = this.renderer.screenToBoard(touch.clientX, touch.clientY);
        this.onClick({ row, col });
    }

    /** 啟用/停用輸入 */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /** 銷毀（移除事件監聽） */
    destroy() {
        this.canvas.removeEventListener('click', this._onMouseClick);
        this.canvas.removeEventListener('touchstart', this._onTouchStart);
    }
}
