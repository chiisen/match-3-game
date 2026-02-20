// ==============================================================================
// 模組名稱: main.js
// 功能描述: 主程式入口 — 初始化遊戲、綁定 UI 事件、啟動遊戲主循環
// ==============================================================================

import { Game, GameState } from './game.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { ScoreManager } from './score.js';
import { AudioManager } from './audio.js';

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
    const btnSound = document.getElementById('btn-sound');
    const cheerVideo = document.getElementById('cheer-video');
    // 初始化渲染器
    const renderer = new Renderer(canvas);

    // 初始化計分管理器
    const scoreManager = new ScoreManager(scoreEl, highScoreEl, comboEl);

    // 初始化音效管理器
    const audioManager = new AudioManager();
    const updateSoundBtn = () => {
        if (btnSound) {
            btnSound.innerHTML = audioManager.muted ? '🔇 音效: 關' : '🔊 音效: 開';
            if (audioManager.muted) {
                btnSound.classList.remove('active');
            } else {
                btnSound.classList.add('active');
            }
        }
    };
    updateSoundBtn();

    // 當前遊戲模式
    let currentMode = 'classic';

    // 影片播放邏輯： 1~3秒 'normal' 循環，3~8秒 'cheer' 播放
    let cheerState = 'normal';
    if (cheerVideo) {
        cheerVideo.currentTime = 1;
        cheerVideo.play().catch((e) => console.warn('Video autoplay blocked:', e));

        cheerVideo.addEventListener('timeupdate', () => {
            if (cheerState === 'normal') {
                if (cheerVideo.currentTime >= 2.5) {
                    cheerVideo.currentTime = 1;
                }
            } else if (cheerState === 'cheer') {
                if (cheerVideo.currentTime >= 8 || cheerVideo.currentTime < 3) {
                    // 如果播到 8s，或是因為某些原因時間跳掉
                    cheerState = 'normal';
                    cheerVideo.currentTime = 1;
                    cheerVideo.classList.remove('cheer-active');
                }
            }
        });
    }

    const triggerCheerAnimation = () => {
        if (!cheerVideo) return;

        if (cheerState === 'normal') {
            cheerState = 'cheer';
            cheerVideo.currentTime = 3;
            cheerVideo.classList.add('cheer-active');
        }
    };

    // 初始化遊戲控制器
    const game = new Game({
        onScoreUpdate: (points, reset) => {
            scoreManager.updateScore(points, reset);
        },
        onComboUpdate: (combo) => {
            scoreManager.updateCombo(combo);
            if (combo > 0) {
                audioManager.playMatch(combo);
                triggerCheerAnimation(); // 每次產生連鎖/消除時跳起
            }
        },
        onTimerUpdate: (seconds) => {
            if (timerEl) timerEl.textContent = seconds;
        },
        onGameOver: () => {
            audioManager.playGameOver();
            if (finalScoreEl) finalScoreEl.textContent = scoreManager.getScore();
            if (gameOverOverlay) gameOverOverlay.style.display = 'flex';
        },
        onStateChange: (state) => {
            if (state === GameState.SWAPPING) {
                audioManager.playSwap();
            } else if (state === GameState.FALLING && game.fallAnim && game.fallAnim.moves.length > 0) {
                audioManager.playFall();
            }
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

    // 音效開關按鈕
    btnSound?.addEventListener('click', () => {
        audioManager.toggleMute();
        updateSoundBtn();
        audioManager.init(); // 確保使用者互動後立即解鎖 AudioContext
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
