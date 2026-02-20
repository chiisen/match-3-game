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

        this._calcDimensions();
    }

    /** 計算尺寸：同時考慮寬度與高度，取較小值 */
    _calcDimensions() {
        const sidePad = 20; // 左右 padding
        const maxByWidth = Math.min(window.innerWidth - sidePad * 2, 480);

        // 估算 UI 其他元素佔用的垂直空間（標題+計分板+按鈕+gap）
        // 手機直向：約佔 180px；橫向下由 CSS flex 處理，此處取保守值
        const uiHeight = window.innerHeight < 600 ? 140 : 180;
        const availH = window.innerHeight - uiHeight;
        const maxByHeight = Math.max(availH, 200); // 最小保留 200px

        const maxSize = Math.min(maxByWidth, maxByHeight);
        this.cellSize = Math.floor(maxSize / this.boardSize);
        this.padding = 4;
        this.gemSize = this.cellSize - this.padding * 2;

        const canvasSize = this.cellSize * this.boardSize;
        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;
        // CSS 讓 canvas 跟容器等寬，但保留 aspect-ratio
        this.canvas.style.width = canvasSize + 'px';
        this.canvas.style.height = canvasSize + 'px';
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
        const colors = GEM_COLORS[type];
        if (!colors) return;

        ctx.save();

        // 外發光
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 12;

        // 根據類型繪製不同形狀
        switch (type) {
            case 1: this._drawCircleGem(ctx, x, y, radius, colors); break;
            case 2: this._drawDiamondGem(ctx, x, y, radius, colors); break;
            case 3: this._drawSquareGem(ctx, x, y, radius, colors); break;
            case 4: this._drawTriangleGem(ctx, x, y, radius, colors); break;
            case 5: this._drawStarGem(ctx, x, y, radius, colors); break;
            case 6: this._drawHexGem(ctx, x, y, radius, colors); break;
        }

        ctx.restore();
    }

    /** 圓形寶石 */
    _drawCircleGem(ctx, x, y, r, colors) {
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        grad.addColorStop(0, colors.light);
        grad.addColorStop(0.7, colors.main);
        grad.addColorStop(1, colors.dark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // 光澤
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.15, y - r * 0.25, r * 0.3, r * 0.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    /** 菱形寶石 */
    _drawDiamondGem(ctx, x, y, r, colors) {
        const grad = ctx.createLinearGradient(x - r, y, x + r, y);
        grad.addColorStop(0, colors.dark);
        grad.addColorStop(0.4, colors.light);
        grad.addColorStop(1, colors.main);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.9);
        ctx.lineTo(x + r * 0.7, y);
        ctx.lineTo(x, y + r * 0.9);
        ctx.lineTo(x - r * 0.7, y);
        ctx.closePath();
        ctx.fill();

        // 光澤
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.75);
        ctx.lineTo(x + r * 0.2, y - r * 0.15);
        ctx.lineTo(x - r * 0.2, y - r * 0.15);
        ctx.closePath();
        ctx.fill();
    }

    /** 方形寶石 (圓角) */
    _drawSquareGem(ctx, x, y, r, colors) {
        const size = r * 0.75;
        const radius = r * 0.15;
        const grad = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
        grad.addColorStop(0, colors.light);
        grad.addColorStop(0.5, colors.main);
        grad.addColorStop(1, colors.dark);
        ctx.fillStyle = grad;
        this._roundRect(ctx, x - size, y - size, size * 2, size * 2, radius);
        ctx.fill();

        // 光澤
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this._roundRect(ctx, x - size + 3, y - size + 3, size * 0.8, size * 0.5, radius * 0.5);
        ctx.fill();
    }

    /** 三角形寶石 */
    _drawTriangleGem(ctx, x, y, r, colors) {
        const grad = ctx.createLinearGradient(x, y - r, x, y + r);
        grad.addColorStop(0, colors.light);
        grad.addColorStop(1, colors.dark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.85);
        ctx.lineTo(x + r * 0.8, y + r * 0.65);
        ctx.lineTo(x - r * 0.8, y + r * 0.65);
        ctx.closePath();
        ctx.fill();

        // 光澤
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.55);
        ctx.lineTo(x + r * 0.2, y - r * 0.1);
        ctx.lineTo(x - r * 0.2, y - r * 0.1);
        ctx.closePath();
        ctx.fill();
    }

    /** 星形寶石 */
    _drawStarGem(ctx, x, y, r, colors) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, colors.light);
        grad.addColorStop(0.6, colors.main);
        grad.addColorStop(1, colors.dark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        const spikes = 5;
        const outerR = r * 0.85;
        const innerR = r * 0.4;
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const rad = i % 2 === 0 ? outerR : innerR;
            const px = x + Math.cos(angle) * rad;
            const py = y + Math.sin(angle) * rad;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 中心光點
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    /** 六邊形寶石 */
    _drawHexGem(ctx, x, y, r, colors) {
        const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
        grad.addColorStop(0, colors.light);
        grad.addColorStop(0.6, colors.main);
        grad.addColorStop(1, colors.dark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const px = x + Math.cos(angle) * r * 0.8;
            const py = y + Math.sin(angle) * r * 0.8;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 光澤
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.1, y - r * 0.2, r * 0.25, r * 0.18, -0.3, 0, Math.PI * 2);
        ctx.fill();
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
