import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, frameClock } from './helpers.mjs';

for (const phase of ['swap', 'reverse', 'remove', 'fall']) {
    test(`重新開始會隔離上一局的 ${phase} 動畫與棋盤變更`, async t => {
        const tick = frameClock(t);
        const game = new Game();
        t.after(() => game.destroy());
        // 固定棋盤：交換 (0,2) 與 (1,2) 後頂列有三連，其他位置無三連。
        game.board.grid = Array.from({ length: 7 }, (_, r) =>
            Array.from({ length: 7 }, (_, c) => (r + c) % 6 + 1));
        game.board.grid[0] = [1, 1, 2, 4, 5, 6, 1];
        game.board.grid[1][2] = 1;
        const move = phase === 'reverse' ? game._trySwap(6, 5, 6, 6) : game._trySwap(0, 2, 1, 2);
        if (phase !== 'swap') await tick();
        if (phase === 'fall') await tick();
        game.startGame('classic');
        const fresh = structuredClone(game.board.grid);
        await tick();
        await move;
        assert.deepEqual(game.board.grid, fresh);
        assert.equal(game.state, 'idle');
        assert.equal(game.animating, false);
        assert.equal(game.swapAnim, null);
        assert.equal(game.removeAnim, null);
        assert.equal(game.fallAnim, null);
    });
}

test('上一局動畫回呼不會清除新局正在播放的動畫', async t => {
    const tick = frameClock(t);
    const game = new Game();
    t.after(() => game.destroy());
    const old = game._trySwap(0, 0, 0, 1);
    game.startGame('timed');
    const current = game._trySwap(0, 0, 0, 1);
    await tick();
    await old;
    // 新局的交換已完成第一段；仍處於回退或消除流程。
    assert.equal(game.animating, true);
    for (let i = 0; i < 50 && game.animating; i++) await tick();
    await current;
    assert.equal(game.state, 'idle');
});

test('重新開始後上一局延遲的代玩不會操作新局', async t => {
    const delays = [];
    t.mock.method(globalThis, 'setTimeout', fn => { delays.push(fn); return delays.length; });
    const game = new Game();
    t.after(() => game.destroy());
    game.isAutoPlaying = true;
    const old = game._triggerAutoMove();
    game.startGame();
    const fresh = structuredClone(game.board.grid);
    game.isAutoPlaying = true;
    delays[0]();
    await old;
    assert.deepEqual(game.board.grid, fresh);
    assert.equal(game.animating, false);
});
