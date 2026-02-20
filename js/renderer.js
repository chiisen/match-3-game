// ==============================================================================
// 模組名稱: renderer.js
// 功能描述: Canvas 渲染引擎 — 繪製棋盤、寶石、動畫與粒子特效
// ==============================================================================

import { BOARD_SIZE, GEM_TYPES } from './game.js';

/** 寶石顏色漸層配置 */
const GEM_COLORS = [
    null, // index 0 = 空
    { main: '#ff4d6a', light: '#ff8fa3', dark: '#c21e3a', glow: 'rgba(255, 77, 106, 0.5)' },  // 1: 紅寶石
    { main: '#00c9ff', light: '#66e0ff', dark: '#0088b3', glow: 'rgba(0, 201, 255, 0.5)' },    // 2: 藍寶石
    { main: '#50e85a', light: '#8aff91', dark: '#2aad33', glow: 'rgba(80, 232, 90, 0.5)' },    // 3: 翡翠
    { main: '#ffcc00', light: '#ffe066', dark: '#cc9e00', glow: 'rgba(255, 204, 0, 0.5)' },    // 4: 金石
    { main: '#cc66ff', light: '#e0a3ff', dark: '#9933cc', glow: 'rgba(204, 102, 255, 0.5)' },  // 5: 紫晶
    { main: '#ff8c1a', light: '#ffb366', dark: '#cc6600', glow: 'rgba(255, 140, 26, 0.5)' },   // 6: 琥珀
];

/** 粒子類別 */
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.size *= 0.97;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Renderer — Canvas 渲染器
 */
export class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {number} boardSize
     */
    constructor(canvas, boardSize = BOARD_SIZE) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.boardSize = boardSize;
        this.particles = [];
        this.hintPhase = 0; // 提示閃爍相位

        // 載入貓咪主題圖片
        this.gemImages = [];
        for (let i = 1; i <= 6; i++) {
            const img = new Image();
            img.src = `assets/images/gem${i}.png`;
            this.gemImages[i] = img;
        }

        this._calcDimensions();
    }

    /** 計算尺寸：透過真正 RWD，CSS 負責外部畫面大小縮放，JS 這裡只負責決定內部畫布的高解析畫質！ */
    _calcDimensions() {
        // 固定為高清內部解析度 840 x 840（可被 6, 7, 8 等多種網格完美整除，且不管螢幕大小，圖案絕對清晰不糊）
        const internalSize = 840;

        this.cellSize = Math.floor(internalSize / this.boardSize);
        this.padding = 0; // 邊距為 0 使圖片長滿網格
        this.gemSize = this.cellSize;

        const canvasSize = internalSize;
        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;

        // 刪除 JS 對元素實際長寬 px 的硬性死板限制！我們已經在 style.css 中
        // 設定了 `#game-canvas { width: 100%; height: 100%; }` // .canvas-wrapper { max-width: 600px; aspect-ratio: 1/1; }
        // 這樣在不同手機/螢幕，無論直向橫向都會自適應剛好的大小
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
    }

    /** 螢幕座標 → 棋盤座標 */
    screenToBoard(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        return { row, col };
    }

    /** 棋盤座標 → 像素中心點 */
    boardToPixel(row, col) {
        return {
            x: col * this.cellSize + this.cellSize / 2,
            y: row * this.cellSize + this.cellSize / 2,
        };
    }

    /** 調整視窗大小 */
    resize() {
        this._calcDimensions();
    }

    /**
     * 主渲染函式
     * @param {import('./game.js').Game} game
     */
    render(game) {
        const ctx = this.ctx;
        const board = game.board;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 繪製棋盤背景
        this._drawBoardBackground(ctx);

        // 繪製寶石
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const type = board.getGem(r, c);
                if (type === 0) continue;

                let drawR = r;
                let drawC = c;
                let scale = 1;
                let alpha = 1;

                // 交換動畫偏移
                if (game.swapAnim) {
                    const sa = game.swapAnim;
                    const t = this._easeInOutCubic(sa.progress);
                    if (r === sa.r1 && c === sa.c1) {
                        drawR = sa.r1 + (sa.r2 - sa.r1) * t;
                        drawC = sa.c1 + (sa.c2 - sa.c1) * t;
                    } else if (r === sa.r2 && c === sa.c2) {
                        drawR = sa.r2 + (sa.r1 - sa.r2) * t;
                        drawC = sa.c2 + (sa.c1 - sa.c2) * t;
                    }
                }

                // 消除動畫縮放
                if (game.removeAnim) {
                    const key = `${r},${c}`;
                    if (game.removeAnim.cells.has(key)) {
                        const t = game.removeAnim.progress;
                        scale = 1 - t;
                        alpha = 1 - t;

                        // 在消除開始時生成粒子
                        if (t < 0.15 && Math.random() < 0.3) {
                            const pos = this.boardToPixel(r, c);
                            const color = GEM_COLORS[type]?.main || '#fff';
                            for (let i = 0; i < 3; i++) {
                                this.particles.push(new Particle(pos.x, pos.y, color));
                            }
                        }

                        if (scale <= 0) continue;
                    }
                }

                // 掉落動畫偏移
                if (game.fallAnim) {
                    const fa = game.fallAnim;
                    const t = this._easeOutBounce(fa.progress);

                    // 現有方塊掉落
                    for (const move of fa.moves) {
                        if (move.toR === r && move.toC === c) {
                            drawR = move.fromR + (move.toR - move.fromR) * t;
                            break;
                        }
                    }

                    // 新方塊從頂部掉入
                    for (const gem of fa.newGems) {
                        if (gem.row === r && gem.col === c) {
                            const startR = -1 - (gem.row);
                            drawR = startR + (gem.row - startR) * t;
                            break;
                        }
                    }
                }

                const pos = this.boardToPixel(drawR, drawC);
                ctx.save();
                ctx.globalAlpha = alpha;
                this._drawGem(ctx, type, pos.x, pos.y, this.gemSize / 2 * scale);
                ctx.restore();
            }
        }

        // 繪製選取框
        if (game.selectedGem) {
            this._drawSelection(ctx, game.selectedGem.row, game.selectedGem.col);
        }

        // 繪製提示
        if (game.hintTarget) {
            this.hintPhase += 0.05;
            const hintAlpha = 0.3 + Math.sin(this.hintPhase) * 0.3;
            this._drawHint(ctx, game.hintTarget.r1, game.hintTarget.c1, hintAlpha);
            this._drawHint(ctx, game.hintTarget.r2, game.hintTarget.c2, hintAlpha);
        }

        // 更新並繪製粒子
        this.particles = this.particles.filter(p => p.life > 0);
        for (const p of this.particles) {
            p.update();
            p.draw(ctx);
        }
    }

    /** 繪製棋盤背景格線 */
    _drawBoardBackground(ctx) {
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const x = c * this.cellSize;
                const y = r * this.cellSize;
                const isEven = (r + c) % 2 === 0;
                ctx.fillStyle = isEven ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)';
                ctx.fillRect(x, y, this.cellSize, this.cellSize);
            }
        }
    }

    /**
     * 繪製寶石
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} type 寶石類型 (1~6)
     * @param {number} x 中心 x
     * @param {number} y 中心 y
     * @param {number} radius 半徑
     */
    _drawGem(ctx, type, x, y, radius) {
        const img = this.gemImages[type];
        if (!img || !img.complete) return;

        const size = radius * 2;

        ctx.save();

        // 外發光與選取特效
        const colors = GEM_COLORS[type];
        if (colors) {
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = 10;
        }

        // 建立圓角遮罩讓圖片變成可愛的拼圖方塊
        ctx.beginPath();
        const r = 12; // 圓角半徑
        const px = x - size / 2;
        const py = y - size / 2;
        ctx.moveTo(px + r, py);
        ctx.lineTo(px + size - r, py);
        ctx.quadraticCurveTo(px + size, py, px + size, py + r);
        ctx.lineTo(px + size, py + size - r);
        ctx.quadraticCurveTo(px + size, py + size, px + size - r, py + size);
        ctx.lineTo(px + r, py + size);
        ctx.quadraticCurveTo(px, py + size, px, py + size - r);
        ctx.lineTo(px, py + r);
        ctx.quadraticCurveTo(px, py, px + r, py);
        ctx.closePath();

        ctx.clip(); // 裁切圖片邊緣，保持圓角效果

        // 微幅放大 5% 消除圖片自帶的透明邊距
        const zoom = 1.05;
        const drawSize = size * zoom;
        const offset = (drawSize - size) / 2;
        ctx.drawImage(img, px - offset, py - offset, drawSize, drawSize);

        ctx.restore();
    }

    /** 繪製圓角矩形 */
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    /** 繪製選取發光邊框 */
    _drawSelection(ctx, row, col) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;
        const t = performance.now() / 500;
        const pulse = 0.6 + Math.sin(t) * 0.4;

        ctx.save();
        ctx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(0, 229, 255, 0.8)';
        ctx.shadowBlur = 15;
        this._roundRect(ctx, x + 2, y + 2, this.cellSize - 4, this.cellSize - 4, 6);
        ctx.stroke();
        ctx.restore();
    }

    /** 繪製提示高亮 */
    _drawHint(ctx, row, col, alpha) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;

        ctx.save();
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.2})`;
        this._roundRect(ctx, x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 6);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
        ctx.shadowBlur = 10;
        this._roundRect(ctx, x + 2, y + 2, this.cellSize - 4, this.cellSize - 4, 6);
        ctx.stroke();
        ctx.restore();
    }

    /** easeInOutCubic 緩動函式 */
    _easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /** easeOutBounce 緩動函式 */
    _easeOutBounce(t) {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    }
}
