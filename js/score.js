// ==============================================================================
// 模組名稱: score.js
// 功能描述: 計分管理器 — 分數計算、最高分 localStorage 儲存
// ==============================================================================

/**
 * ScoreManager — 計分管理器
 * 管理分數累積、最高分記錄與 DOM 更新
 */
export class ScoreManager {
    /**
     * @param {HTMLElement} scoreEl 當前分數顯示元素
     * @param {HTMLElement} highScoreEl 最高分顯示元素
     * @param {HTMLElement} comboEl 連鎖數顯示元素
     */
    constructor(scoreEl, highScoreEl, comboEl) {
        this.scoreEl = scoreEl;
        this.highScoreEl = highScoreEl;
        this.comboEl = comboEl;
        this.currentScore = 0;
        this.highScore = this._loadHighScore();

        this._updateDisplay();
    }

    /** 從 localStorage 載入最高分 */
    _loadHighScore() {
        try {
            const saved = localStorage.getItem('match3_highScore');
            return saved ? parseInt(saved, 10) : 0;
        } catch {
            return 0;
        }
    }

    /** 儲存最高分到 localStorage */
    _saveHighScore() {
        try {
            localStorage.setItem('match3_highScore', String(this.highScore));
        } catch {
            // localStorage 不可用時靜默失敗
        }
    }

    /**
     * 更新分數
     * @param {number} points 新增分數
     * @param {boolean} reset 是否重設分數
     */
    updateScore(points, reset = false) {
        if (reset) {
            this.currentScore = 0;
        } else {
            this.currentScore += points;
        }

        // 更新最高分
        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
            this._saveHighScore();
        }

        this._updateDisplay();
        this._popAnimation(this.scoreEl);
    }

    /** 更新連鎖數 */
    updateCombo(combo) {
        if (this.comboEl) {
            this.comboEl.textContent = combo;
            if (combo > 1) {
                this._popAnimation(this.comboEl);
            }
        }
    }

    /** 取得當前分數 */
    getScore() {
        return this.currentScore;
    }

    /** 更新 DOM 顯示 */
    _updateDisplay() {
        if (this.scoreEl) this.scoreEl.textContent = this.currentScore;
        if (this.highScoreEl) this.highScoreEl.textContent = this.highScore;
    }

    /** 分數跳動動畫 */
    _popAnimation(el) {
        if (!el) return;
        el.classList.add('pop');
        setTimeout(() => el.classList.remove('pop'), 300);
    }

    /** 重置分數 */
    reset() {
        this.currentScore = 0;
        this._updateDisplay();
    }
}
