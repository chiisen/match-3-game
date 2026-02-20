// ==============================================================================
// 模組名稱: game.js
// 功能描述: 三消遊戲核心邏輯 — 棋盤模型、匹配檢測、消除與掉落填充
// ==============================================================================

/** 寶石類型數量 */
export const GEM_TYPES = 6;

/** 棋盤尺寸 */
export const BOARD_SIZE = 8;

/** 遊戲狀態列舉 */
export const GameState = {
    IDLE: 'idle',
    SELECTED: 'selected',
    SWAPPING: 'swapping',
    REMOVING: 'removing',
    FALLING: 'falling',
    GAME_OVER: 'gameOver',
};

/**
 * Board — 棋盤資料模型
 * 管理方塊配置、匹配邏輯、掉落填充
 */
export class Board {
    constructor(size = BOARD_SIZE, types = GEM_TYPES) {
        this.size = size;
        this.types = types;
        /** @type {number[][]} 0 = 空, 1~types = 寶石類型 */
        this.grid = [];
        this.generateBoard();
    }

    /** 隨機生成棋盤，確保初始狀態無三消 */
    generateBoard() {
        this.grid = [];
        for (let r = 0; r < this.size; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.size; c++) {
                let type;
                do {
                    type = this._randomType();
                } while (this._wouldMatch(r, c, type));
                this.grid[r][c] = type;
            }
        }
    }

    /** 生成隨機寶石類型 (1 ~ types) */
    _randomType() {
        return Math.floor(Math.random() * this.types) + 1;
    }

    /** 檢查在 (r, c) 放置 type 是否會產生三消 */
    _wouldMatch(r, c, type) {
        // 水平檢查：左邊是否已有 2 個相同
        if (c >= 2 && this.grid[r][c - 1] === type && this.grid[r][c - 2] === type) {
            return true;
        }
        // 垂直檢查：上方是否已有 2 個相同
        if (r >= 2 && this.grid[r - 1][c] === type && this.grid[r - 2][c] === type) {
            return true;
        }
        return false;
    }

    /** 取得 (r, c) 的寶石類型 */
    getGem(r, c) {
        if (r < 0 || r >= this.size || c < 0 || c >= this.size) return 0;
        return this.grid[r][c];
    }

    /** 交換兩個位置的寶石 */
    swap(r1, c1, r2, c2) {
        const temp = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = temp;
    }

    /** 檢查兩個位置是否相鄰 */
    isAdjacent(r1, c1, r2, c2) {
        const dr = Math.abs(r1 - r2);
        const dc = Math.abs(c1 - c2);
        return (dr + dc) === 1;
    }

    /**
     * 掃描所有匹配（≥3 連續相同方塊）
     * @returns {Set<string>} 匹配位置集合，格式 "r,c"
     */
    findMatches() {
        const matched = new Set();

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const type = this.grid[r][c];
                if (type === 0) continue;

                // 水平掃描
                if (c + 2 < this.size) {
                    let count = 1;
                    while (c + count < this.size && this.grid[r][c + count] === type) {
                        count++;
                    }
                    if (count >= 3) {
                        for (let i = 0; i < count; i++) {
                            matched.add(`${r},${c + i}`);
                        }
                    }
                }

                // 垂直掃描
                if (r + 2 < this.size) {
                    let count = 1;
                    while (r + count < this.size && this.grid[r + count][c] === type) {
                        count++;
                    }
                    if (count >= 3) {
                        for (let i = 0; i < count; i++) {
                            matched.add(`${r + i},${c}`);
                        }
                    }
                }
            }
        }

        return matched;
    }

    /**
     * 分析匹配結果，計算各消除線的長度
     * @param {Set<string>} matched
     * @returns {number[]} 各消除線長度的陣列
     */
    analyzeMatches(matched) {
        if (matched.size === 0) return [];

        const lines = [];

        // 水平線段偵測
        for (let r = 0; r < this.size; r++) {
            let lineLen = 0;
            let lastType = 0;
            for (let c = 0; c < this.size; c++) {
                const key = `${r},${c}`;
                const type = this.grid[r][c];
                if (matched.has(key) && type === lastType && type !== 0) {
                    lineLen++;
                } else {
                    if (lineLen >= 3) lines.push(lineLen);
                    lineLen = matched.has(key) && type !== 0 ? 1 : 0;
                    lastType = type;
                }
            }
            if (lineLen >= 3) lines.push(lineLen);
        }

        // 垂直線段偵測
        for (let c = 0; c < this.size; c++) {
            let lineLen = 0;
            let lastType = 0;
            for (let r = 0; r < this.size; r++) {
                const key = `${r},${c}`;
                const type = this.grid[r][c];
                if (matched.has(key) && type === lastType && type !== 0) {
                    lineLen++;
                } else {
                    if (lineLen >= 3) lines.push(lineLen);
                    lineLen = matched.has(key) && type !== 0 ? 1 : 0;
                    lastType = type;
                }
            }
            if (lineLen >= 3) lines.push(lineLen);
        }

        return lines;
    }

    /**
     * 移除匹配的方塊（設為 0）
     * @param {Set<string>} matched
     */
    removeMatches(matched) {
        for (const key of matched) {
            const [r, c] = key.split(',').map(Number);
            this.grid[r][c] = 0;
        }
    }

    /**
     * 重力掉落：將空位上方的方塊下移
     * @returns {Array<{fromR: number, fromC: number, toR: number, toC: number}>} 移動紀錄
     */
    applyGravity() {
        const moves = [];

        for (let c = 0; c < this.size; c++) {
            let emptyRow = this.size - 1;

            for (let r = this.size - 1; r >= 0; r--) {
                if (this.grid[r][c] !== 0) {
                    if (r !== emptyRow) {
                        moves.push({ fromR: r, fromC: c, toR: emptyRow, toC: c });
                        this.grid[emptyRow][c] = this.grid[r][c];
                        this.grid[r][c] = 0;
                    }
                    emptyRow--;
                }
            }
        }

        return moves;
    }

    /**
     * 填充空位：頂部隨機生成新方塊
     * @returns {Array<{row: number, col: number, type: number}>} 新方塊紀錄
     */
    fillEmpty() {
        const newGems = [];

        for (let c = 0; c < this.size; c++) {
            for (let r = 0; r < this.size; r++) {
                if (this.grid[r][c] === 0) {
                    const type = this._randomType();
                    this.grid[r][c] = type;
                    newGems.push({ row: r, col: c, type });
                }
            }
        }

        return newGems;
    }

    /** 檢查棋盤上是否存在可用的交換步驟 */
    hasValidMoves() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                // 嘗試向右交換
                if (c + 1 < this.size) {
                    this.swap(r, c, r, c + 1);
                    const matches = this.findMatches();
                    this.swap(r, c, r, c + 1); // 還原
                    if (matches.size > 0) return true;
                }
                // 嘗試向下交換
                if (r + 1 < this.size) {
                    this.swap(r, c, r + 1, c);
                    const matches = this.findMatches();
                    this.swap(r, c, r + 1, c); // 還原
                    if (matches.size > 0) return true;
                }
            }
        }
        return false;
    }

    /**
     * 尋找一組可消除的提示位置
     * @returns {{r1: number, c1: number, r2: number, c2: number} | null}
     */
    findHint() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (c + 1 < this.size) {
                    this.swap(r, c, r, c + 1);
                    const matches = this.findMatches();
                    this.swap(r, c, r, c + 1);
                    if (matches.size > 0) {
                        return { r1: r, c1: c, r2: r, c2: c + 1 };
                    }
                }
                if (r + 1 < this.size) {
                    this.swap(r, c, r + 1, c);
                    const matches = this.findMatches();
                    this.swap(r, c, r + 1, c);
                    if (matches.size > 0) {
                        return { r1: r, c1: c, r2: r + 1, c2: c };
                    }
                }
            }
        }
        return null;
    }
}

/**
 * Game — 遊戲主控制器
 * 管理遊戲狀態流程、模式切換、計時器
 */
export class Game {
    /**
     * @param {object} callbacks 回呼介面
     * @param {function} callbacks.onScoreUpdate 分數更新
     * @param {function} callbacks.onComboUpdate 連鎖更新
     * @param {function} callbacks.onTimerUpdate 計時器更新
     * @param {function} callbacks.onGameOver 遊戲結束
     * @param {function} callbacks.onStateChange 狀態變更
     */
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.board = new Board();
        this.state = GameState.IDLE;
        this.mode = 'classic'; // 'classic' | 'timed'
        this.selectedGem = null; // { row, col }
        this.combo = 0;
        this.timerSeconds = 60;
        this.timerInterval = null;
        this.hintTimer = null;
        this.hintTarget = null;

        // 動畫相關狀態
        this.animating = false;
        this.swapAnim = null;   // { r1, c1, r2, c2, progress, reverse }
        this.removeAnim = null; // { cells: Set, progress }
        this.fallAnim = null;   // { moves: [], newGems: [], progress }
    }

    /** 開始新遊戲 */
    startGame(mode = 'classic') {
        this.mode = mode;
        this.board.generateBoard();
        this.state = GameState.IDLE;
        this.selectedGem = null;
        this.combo = 0;
        this.animating = false;
        this.swapAnim = null;
        this.removeAnim = null;
        this.fallAnim = null;
        this.hintTarget = null;

        this.callbacks.onScoreUpdate?.(0, true); // reset
        this.callbacks.onComboUpdate?.(0);
        this.callbacks.onStateChange?.(this.state);

        this._clearTimers();

        if (mode === 'timed') {
            this.timerSeconds = 60;
            this.callbacks.onTimerUpdate?.(this.timerSeconds);
            this.timerInterval = setInterval(() => {
                this.timerSeconds--;
                this.callbacks.onTimerUpdate?.(this.timerSeconds);
                if (this.timerSeconds <= 0) {
                    this._clearTimers();
                    this._gameOver();
                }
            }, 1000);
        }

        this._resetHintTimer();
    }

    /** 處理玩家點擊棋盤位置 */
    handleClick(row, col) {
        if (this.animating || this.state === GameState.GAME_OVER) return;

        if (row < 0 || row >= this.board.size || col < 0 || col >= this.board.size) return;

        this._resetHintTimer();
        this.hintTarget = null;

        if (this.selectedGem === null) {
            // 第一次選取
            this.selectedGem = { row, col };
            this.state = GameState.SELECTED;
            this.callbacks.onStateChange?.(this.state);
        } else if (this.selectedGem.row === row && this.selectedGem.col === col) {
            // 點擊同一個方塊 → 取消選取
            this.selectedGem = null;
            this.state = GameState.IDLE;
            this.callbacks.onStateChange?.(this.state);
        } else if (this.board.isAdjacent(this.selectedGem.row, this.selectedGem.col, row, col)) {
            // 相鄰方塊 → 嘗試交換
            this._trySwap(this.selectedGem.row, this.selectedGem.col, row, col);
        } else {
            // 不相鄰 → 改選新方塊
            this.selectedGem = { row, col };
            this.state = GameState.SELECTED;
            this.callbacks.onStateChange?.(this.state);
        }
    }

    /** 嘗試交換兩個方塊 */
    async _trySwap(r1, c1, r2, c2) {
        this.animating = true;
        this.state = GameState.SWAPPING;
        this.callbacks.onStateChange?.(this.state);

        // 播放交換動畫
        await this._animateSwap(r1, c1, r2, c2);

        // 執行交換
        this.board.swap(r1, c1, r2, c2);

        // 檢查匹配
        const matches = this.board.findMatches();

        if (matches.size === 0) {
            // 無效交換 → 回退
            await this._animateSwap(r2, c2, r1, c1);
            this.board.swap(r1, c1, r2, c2);
            this.selectedGem = null;
            this.state = GameState.IDLE;
            this.animating = false;
            this.callbacks.onStateChange?.(this.state);
            return;
        }

        // 有效交換 → 開始消除連鎖
        this.selectedGem = null;
        this.combo = 0;
        await this._processMatches(matches);

        // 檢查是否還有可用步驟
        if (!this.board.hasValidMoves()) {
            this._gameOver();
        } else {
            this.state = GameState.IDLE;
            this.animating = false;
            this.callbacks.onStateChange?.(this.state);
            this._resetHintTimer();
        }
    }

    /** 處理消除連鎖 */
    async _processMatches(matches) {
        while (matches.size > 0) {
            this.combo++;
            this.callbacks.onComboUpdate?.(this.combo);

            // 分析消除線段長度
            const lines = this.board.analyzeMatches(matches);

            // 計分
            this.callbacks.onScoreUpdate?.(this._calculateScore(lines, this.combo));

            // 播放消除動畫
            this.state = GameState.REMOVING;
            this.callbacks.onStateChange?.(this.state);
            await this._animateRemove(matches);

            // 移除方塊
            this.board.removeMatches(matches);

            // 掉落 + 填充
            this.state = GameState.FALLING;
            this.callbacks.onStateChange?.(this.state);
            const moves = this.board.applyGravity();
            const newGems = this.board.fillEmpty();
            await this._animateFall(moves, newGems);

            // 再次檢查連鎖
            matches = this.board.findMatches();
        }
    }

    /** 計算分數 */
    _calculateScore(lines, combo) {
        let score = 0;
        for (const len of lines) {
            if (len === 3) score += 30;
            else if (len === 4) score += 60;
            else if (len >= 5) score += 100;
        }
        // 連鎖加成
        if (combo > 1) {
            score = Math.floor(score * Math.pow(1.5, combo - 1));
        }
        return score;
    }

    /** 交換動畫 */
    _animateSwap(r1, c1, r2, c2) {
        return new Promise((resolve) => {
            this.swapAnim = { r1, c1, r2, c2, progress: 0 };
            const duration = 200; // ms
            const start = performance.now();
            const animate = (now) => {
                const elapsed = now - start;
                this.swapAnim.progress = Math.min(elapsed / duration, 1);
                if (this.swapAnim.progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.swapAnim = null;
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    /** 消除動畫 */
    _animateRemove(cells) {
        return new Promise((resolve) => {
            this.removeAnim = { cells, progress: 0 };
            const duration = 300;
            const start = performance.now();
            const animate = (now) => {
                const elapsed = now - start;
                this.removeAnim.progress = Math.min(elapsed / duration, 1);
                if (this.removeAnim.progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.removeAnim = null;
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    /** 掉落動畫 */
    _animateFall(moves, newGems) {
        return new Promise((resolve) => {
            this.fallAnim = { moves, newGems, progress: 0 };
            const duration = 300;
            const start = performance.now();
            const animate = (now) => {
                const elapsed = now - start;
                this.fallAnim.progress = Math.min(elapsed / duration, 1);
                if (this.fallAnim.progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.fallAnim = null;
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    /** 遊戲結束 */
    _gameOver() {
        this._clearTimers();
        this.state = GameState.GAME_OVER;
        this.animating = false;
        this.callbacks.onStateChange?.(this.state);
        this.callbacks.onGameOver?.();
    }

    /** 清除所有計時器 */
    _clearTimers() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.hintTimer) {
            clearTimeout(this.hintTimer);
            this.hintTimer = null;
        }
    }

    /** 重置提示計時器（5 秒無操作後觸發提示） */
    _resetHintTimer() {
        if (this.hintTimer) clearTimeout(this.hintTimer);
        this.hintTarget = null;

        this.hintTimer = setTimeout(() => {
            if (this.state === GameState.IDLE || this.state === GameState.SELECTED) {
                this.hintTarget = this.board.findHint();
            }
        }, 5000);
    }

    /** 手動觸發提示 */
    showHint() {
        if (this.animating || this.state === GameState.GAME_OVER) return;
        this.hintTarget = this.board.findHint();
    }

    /** 銷毀遊戲（清理資源） */
    destroy() {
        this._clearTimers();
    }
}
