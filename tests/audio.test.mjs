import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';

const { AudioManager } = await loadModule('../js/audio.js');
globalThis.window = {};
globalThis.localStorage = { getItem: () => null, setItem() {} };

test('設定讀取被拒絕時使用預設值，仍可操作音樂及音效', t => {
    t.mock.method(globalThis.localStorage, 'getItem', () => { throw new Error('storage denied'); });
    const audio = new AudioManager();
    assert.equal(audio.bgmMuted, false);
    assert.equal(audio.sfxMuted, false);
    assert.equal(audio.toggleBGM(), true);
    assert.equal(audio.toggleSFX(), true);
});

test('localStorage 屬性存取本身拋錯時仍可初始化及切換', t => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    t.after(() => Object.defineProperty(globalThis, 'localStorage', original));
    const audio = new AudioManager();
    assert.equal(audio.toggleBGM(), true);
    assert.equal(audio.toggleSFX(), true);
    assert.equal(audio.toggleBGM(), false);
    assert.equal(audio.toggleSFX(), false);
});

test('儲存寫入失敗時保留當次切換狀態並更新背景音樂生命週期', t => {
    t.mock.method(globalThis.localStorage, 'setItem', () => { throw new Error('quota exceeded'); });
    const audio = new AudioManager();
    let stopped = false;
    audio.audioContext = { state: 'running', currentTime: 0 };
    audio.bgmNode = { stop() { stopped = true; } };
    audio.bgmGain = { gain: { linearRampToValueAtTime() {} } };
    const timers = [];
    t.mock.method(globalThis, 'setTimeout', fn => { timers.push(fn); return timers.length; });
    assert.equal(audio.toggleBGM(), true);
    assert.equal(audio.bgmNode, null);
    timers.forEach(fn => fn());
    assert.equal(stopped, true);
    assert.equal(audio.toggleSFX(), true);
    assert.equal(audio.sfxMuted, true);
    assert.equal(audio.toggleSFX(), false);
});

test('儲存可用時載入既有設定並持久化兩種切換', t => {
    const settings = new Map([['match3_bgm_muted', 'true'], ['match3_sfx_muted', 'true']]);
    t.mock.method(globalThis.localStorage, 'getItem', key => settings.get(key) ?? null);
    t.mock.method(globalThis.localStorage, 'setItem', (key, value) => settings.set(key, String(value)));
    const audio = new AudioManager();
    assert.equal(audio.bgmMuted, true);
    assert.equal(audio.sfxMuted, true);
    audio.toggleBGM();
    audio.toggleSFX();
    assert.equal(settings.get('match3_bgm_muted'), 'false');
    assert.equal(settings.get('match3_sfx_muted'), 'false');
});
