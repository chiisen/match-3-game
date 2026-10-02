import { readFile } from 'node:fs/promises';

export async function loadModule(path) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

export function frameClock(t) {
    const frames = [];
    t.mock.method(globalThis, 'requestAnimationFrame', fn => { frames.push(fn); return frames.length; });
    return async () => {
        const batch = frames.splice(0);
        for (const fn of batch) fn(performance.now() + 10000);
        for (let i = 0; i < 8; i++) await Promise.resolve();
    };
}

// Node 沒有瀏覽器的動畫排程；測試以受控影格推進真正的遊戲流程。
globalThis.requestAnimationFrame ??= () => {};

export const { Game, GameState, Board } = await loadModule('../js/game.js');
