// ==============================================================================
// 模組名稱: main.js
// 功能描述: 主程式入口 — 初始化遊戲、綁定 UI 事件、啟動遊戲主循環
// ==============================================================================

import { Game, GameState } from './game.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { ScoreManager } from './score.js';

/** 遊戲初始化 */
function init() {
    // DOM 元素
    const canvas = document.getElementById('game-canvas');
    const scoreEl = document.getElementById('current-score');
    const highScoreEl = document.getElementById('high-score');
    const comboEl = document.getElementById('combo-count');
    const timerContainer = document.getElementById('timer-container');
    const timerEl = document.getElementById('timer');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const finalScoreEl = document.getElementById('final-score');
    const btnClassic = document.getElementById('btn-classic');
    const btnTimed = document.getElementById('btn-timed');
    const btnHint = document.getElementById('btn-hint');
    const btnRestart = document.getElementById('btn-restart');
    const btnRestartOverlay = document.getElementById('btn-restart-overlay');

    // 初始化渲染器
    const renderer = new Renderer(canvas);

    // 初始化計分管理器
    const scoreManager = new ScoreManager(scoreEl, highScoreEl, comboEl);

    // 當前遊戲模式
    let currentMode = 'classic';

    // 初始化遊戲控制器
    const game = new Game({
        onScoreUpdate: (points, reset) => {
            scoreManager.updateScore(points, reset);
        },
        onComboUpdate: (combo) => {
            scoreManager.updateCombo(combo);
        },
        onTimerUpdate: (seconds) => {
            if (timerEl) timerEl.textContent = seconds;
        },
        onGameOver: () => {
            if (finalScoreEl) finalScoreEl.textContent = scoreManager.getScore();
            if (gameOverOverlay) gameOverOverlay.style.display = 'flex';
        },
        onStateChange: (_state) => {
            // 可用於除錯
        },
    });

    // 初始化輸入處理
    const inputHandler = new InputHandler(canvas, renderer, ({ row, col }) => {
        game.handleClick(row, col);
    });

    // 遊戲主循環
    function gameLoop() {
        renderer.render(game);
        requestAnimationFrame(gameLoop);
    }

    // 啟動遊戲
    function startGame(mode) {
        currentMode = mode;
        scoreManager.reset();
        game.startGame(mode);
        if (gameOverOverlay) gameOverOverlay.style.display = 'none';

        // 計時模式顯示計時器
        if (timerContainer) {
            timerContainer.style.display = mode === 'timed' ? 'flex' : 'none';
        }
    }

    // --- 綁定 UI 按鈕事件 ---

    // 模式選擇
    btnClassic?.addEventListener('click', () => {
        btnClassic.classList.add('active');
        btnTimed?.classList.remove('active');
        startGame('classic');
    });

    btnTimed?.addEventListener('click', () => {
        btnTimed.classList.add('active');
        btnClassic?.classList.remove('active');
        startGame('timed');
    });

    // 提示按鈕
    btnHint?.addEventListener('click', () => {
        game.showHint();
    });

    // 重新開始按鈕
    btnRestart?.addEventListener('click', () => {
        startGame(currentMode);
    });

    btnRestartOverlay?.addEventListener('click', () => {
        startGame(currentMode);
    });

    // 視窗大小變更（桌面縮放）
    window.addEventListener('resize', () => {
        renderer.resize();
    });

    // 手機旋轉（延遲確保 innerWidth/innerHeight 已更新）
    window.addEventListener('orientationchange', () => {
        setTimeout(() => renderer.resize(), 100);
    });

    // 開始遊戲
    startGame('classic');
    requestAnimationFrame(gameLoop);
}

// 等待 DOM 載入完成後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
