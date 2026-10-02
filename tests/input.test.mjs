import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, frameClock, loadModule } from './helpers.mjs';

const { InputHandler } = await loadModule('../js/input.js');

function touch(canvas, type, x, y) {
    const event = new Event(type, { cancelable: true });
    event.touches = [{ clientX: x, clientY: y }];
    event.changedTouches = event.touches;
    canvas.dispatchEvent(event);
}

for (const selected of [null, { row: 0, col: 2 }, { row: 0, col: 1 }]) {
    test(`滑動依手勢起終點交換，先前選取 ${JSON.stringify(selected)} 不影響結果`, async t => {
        const tick = frameClock(t);
        const game = new Game();
        t.after(() => game.destroy());
        game.selectedGem = selected;
        game.state = selected ? 'selected' : 'idle';
        const canvas = new EventTarget();
        const input = new InputHandler(canvas, {
            screenToBoard: (x, y) => ({ row: Math.floor(y / 40), col: Math.floor(x / 40) }),
        }, p => game.handleClick(p.row, p.col), (from, to) => game.handleSwipe(from.row, from.col, to.row, to.col));
        t.after(() => input.destroy());
        touch(canvas, 'touchstart', 100, 20);
        touch(canvas, 'touchend', 100, 60);
        // 交換必須在手勢結束時立即開始，不排程模擬點擊。
        assert.equal(game.state, 'swapping');
        assert.deepEqual(game.swapAnim, { r1: 0, c1: 2, r2: 1, c2: 2, progress: 0 });
        for (let i = 0; i < 50 && game.animating; i++) await tick();
        assert.equal(game.state, 'idle');
    });
}

test('滑動拒絕越界、不相鄰、動畫中及遊戲結束時的操作', t => {
    const game = new Game();
    t.after(() => game.destroy());
    const before = structuredClone(game.board.grid);
    for (const cells of [[0, 0, -1, 0], [-1, 0, 0, 0], [0, 0, 2, 0], [0, 6, 0, 7]]) {
        game.handleSwipe(...cells);
    }
    game.animating = true;
    game.handleSwipe(0, 0, 0, 1);
    game.animating = false;
    game._gameOver();
    game.handleSwipe(0, 0, 0, 1);
    assert.deepEqual(game.board.grid, before);
    assert.equal(game.swapAnim, null);
    assert.equal(game.state, 'gameOver');
});

test('短距離觸控維持點選及取消選取行為', t => {
    const game = new Game();
    t.after(() => game.destroy());
    const canvas = new EventTarget();
    const input = new InputHandler(canvas, { screenToBoard: () => ({ row: 2, col: 2 }) },
        p => game.handleClick(p.row, p.col), (from, to) => game.handleSwipe(from.row, from.col, to.row, to.col));
    t.after(() => input.destroy());
    for (let i = 0; i < 2; i++) {
        touch(canvas, 'touchstart', 80, 80);
        touch(canvas, 'touchend', 82, 81);
        assert.deepEqual(game.selectedGem, i === 0 ? { row: 2, col: 2 } : null);
    }
});
