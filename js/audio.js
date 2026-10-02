// ==============================================================================
// 模組名稱: audio.js
// 功能描述: 音效管理器 — 使用 Web Audio API 產生遊戲音效 (穩定解鎖版)
// ==============================================================================

export class AudioManager {
    constructor() {
        this.audioContext = null;

        // 從 localStorage 讀取設定，預設為開啟
        this.bgmMuted = false;
        this.sfxMuted = false;
        try {
            this.bgmMuted = localStorage.getItem('match3_bgm_muted') === 'true';
            this.sfxMuted = localStorage.getItem('match3_sfx_muted') === 'true';
        } catch {
            // 儲存不可用時維持預設設定，不阻止遊戲初始化。
        }

        this.masterVolume = 0.3; // 整體音量
        this.bgmNode = null;
        this.bgmGain = null;
        this.melodyTimeout = null;

        // 預先檢查瀏覽器支援
        this.supported = !!(window.AudioContext || window.webkitAudioContext);
    }

    /** 
     * 初始化或恢復 AudioContext
     * @param {boolean} force 是否嘗試進行「解鎖」動作 (需在使用者互動事件中)
     */
    init(force = false) {
        if (!this.supported) return false;

        try {
            // 只在明確手勢下建立 context
            if (!this.audioContext && force) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (!this.audioContext) return false;

            // 如果是被暫停中且有手勢觸發，嘗試恢復
            if (force && this.audioContext.state === 'suspended') {
                // 不直接在 init 回傳 resume 的 promise，避免同步阻塞
                this.audioContext.resume().catch(() => { });
                return true;
            }

            return this.audioContext.state === 'running' || this.audioContext.state === 'suspended';
        } catch (e) {
            return false;
        }
    }

    /** 開始播放背景音樂 */
    startBGM() {
        if (this.bgmMuted || !this.supported) return;

        // 檢查狀態，若未就緒則跳過（由外部手勢邏輯負責解鎖）
        if (!this.init()) return;

        if (this.bgmNode) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // 使用較輕快的三角波作為基底背景音
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(130.81, this.audioContext.currentTime); // C3

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.05, this.audioContext.currentTime + 2); // 音量放低，當作鋪底

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start();
        this.bgmNode = oscillator;
        this.bgmGain = gainNode;

        this._playMelody();
    }

    _playMelody() {
        if (this.bgmMuted || !this.audioContext || this.audioContext.state !== 'running') return;

        // 快節奏的 8-bit 風格旋律 (C大調: C - F - G - C)
        const notes = [
            // 小節 1 (C Major)
            523.25, 392.00, 329.63, 261.63, 523.25, 392.00, 329.63, 261.63,
            // 小節 2 (F Major)
            698.46, 523.25, 440.00, 349.23, 698.46, 523.25, 440.00, 349.23,
            // 小節 3 (G Major)
            783.99, 587.33, 493.88, 392.00, 783.99, 587.33, 493.88, 392.00,
            // 小節 4 (C Major 結尾向上)
            523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 523.25, 392.00
        ];

        let index = 0;
        // 定義快節奏：每 150ms 播放一個音符 (大約 100 BPM 16分音符)
        const noteDurationMs = 150;

        const playNext = () => {
            if (this.bgmMuted || !this.bgmNode || !this.audioContext || this.audioContext.state !== 'running') return;

            const freq = notes[index];

            // 1. 主旋律 (輕快晶片感)
            const osc = this.audioContext.createOscillator();
            const g = this.audioContext.createGain();

            osc.type = 'square'; // 使用方波讓它更有電玩復古感
            osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);

            // 快速起伏的音量包絡
            g.gain.setValueAtTime(0, this.audioContext.currentTime);
            g.gain.linearRampToValueAtTime(this.masterVolume * 0.08, this.audioContext.currentTime + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.12);

            osc.connect(g);
            g.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.15);

            // 2. 伴奏低音：每逢重拍 (偶數拍) 加上打擊感較強的低音
            if (index % 2 === 0) {
                const bassOsc = this.audioContext.createOscillator();
                const bassGain = this.audioContext.createGain();

                bassOsc.type = 'triangle'; // 低音用三角波避免高頻刺耳
                bassOsc.frequency.setValueAtTime(freq / 4, this.audioContext.currentTime); // 低兩個八度

                bassGain.gain.setValueAtTime(0, this.audioContext.currentTime);
                bassGain.gain.linearRampToValueAtTime(this.masterVolume * 0.1, this.audioContext.currentTime + 0.01);
                bassGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

                bassOsc.connect(bassGain);
                bassGain.connect(this.audioContext.destination);

                bassOsc.start();
                bassOsc.stop(this.audioContext.currentTime + 0.15);
            }

            index = (index + 1) % notes.length;
            this.melodyTimeout = setTimeout(playNext, noteDurationMs);
        };

        playNext();
    }

    stopBGM() {
        if (this.bgmNode && this.audioContext && this.audioContext.state === 'running') {
            try {
                this.bgmGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1);
                const nodeToStop = this.bgmNode;
                setTimeout(() => {
                    try { nodeToStop.stop(); } catch (e) { }
                }, 1000);
            } catch (e) { }
        }
        this.bgmNode = null;
        this.bgmGain = null;
        if (this.melodyTimeout) {
            clearTimeout(this.melodyTimeout);
            this.melodyTimeout = null;
        }
    }

    toggleBGM() {
        this.bgmMuted = !this.bgmMuted;
        try {
            localStorage.setItem('match3_bgm_muted', this.bgmMuted);
        } catch {
            // 設定仍在本次遊戲生效。
        }
        if (this.bgmMuted) {
            this.stopBGM();
        } else {
            this.startBGM();
        }
        return this.bgmMuted;
    }

    toggleSFX() {
        this.sfxMuted = !this.sfxMuted;
        try {
            localStorage.setItem('match3_sfx_muted', this.sfxMuted);
        } catch {
            // 設定仍在本次遊戲生效。
        }
        return this.sfxMuted;
    }

    _playSound(freqs, type = 'sine', duration = 0.1, volume = 0.5) {
        if (this.sfxMuted || !this.init()) return;

        try {
            const osc = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freqs[0], this.audioContext.currentTime);
            if (freqs[1]) {
                osc.frequency.exponentialRampToValueAtTime(freqs[1], this.audioContext.currentTime + duration);
            }

            gainNode.gain.setValueAtTime(this.masterVolume * volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

            osc.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + duration);
        } catch (e) { }
    }

    playSwap() { this._playSound([400, 600], 'sine', 0.1, 0.5); }
    playMatch(combo = 1) {
        const baseFreq = 600 + (combo - 1) * 100;
        this._playSound([baseFreq, baseFreq * 1.5], 'triangle', 0.3, 1.0);
    }
    playFall() { this._playSound([300, 150], 'sine', 0.15, 0.3); }
    playGameOver() { this._playSound([400, 100], 'sawtooth', 0.8, 0.5); }
}

