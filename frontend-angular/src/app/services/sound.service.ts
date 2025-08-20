// src/app/services/sound.service.ts
import { Injectable } from '@angular/core';

type SoundName = 'send' | 'receive' | 'success' | 'error' | 'notify' | 'hover';

@Injectable({ providedIn: 'root' })
export class SoundService {
    private ctx: AudioContext | null = null;
    private master!: GainNode;
    private _muted = (localStorage.getItem('ux.sound.muted') === '1');
    private _volume = Number(localStorage.getItem('ux.sound.volume') ?? '0.45'); // 0..1

    get muted() { return this._muted; }
    get volume() { return this._volume; }

    setMuted(v: boolean) {
        this._muted = v;
        localStorage.setItem('ux.sound.muted', v ? '1' : '0');
        if (this.master) this.master.gain.value = v ? 0 : this._volume;
    }
    toggleMute() { this.setMuted(!this._muted); }

    setVolume(v: number) {
        this._volume = Math.min(1, Math.max(0, v || 0));
        localStorage.setItem('ux.sound.volume', String(this._volume));
        if (this.master && !this._muted) this.master.gain.value = this._volume;
    }

    /** Autoplay engelini aşmak için kullanıcı etkileşiminde çağırın */
    async unlock() {
        const c = this.ensureCtx();
        // bazı tarayıcılarda .resume() gerekli
        try { if (c.state === 'suspended') await c.resume(); } catch { /* ignore */ }
    }

    play(name: SoundName) {
        if (this._muted) return;
        const ctx = this.ensureCtx();
        const t0 = ctx.currentTime + 0.01;

        const tone = (f: number, dur = 0.08, type: OscillatorType = 'sine', gain = 0.9, when = t0) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(f, when);
            // basit AD envelope
            g.gain.setValueAtTime(0, when);
            g.gain.linearRampToValueAtTime(gain, when + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
            o.connect(g).connect(this.master);
            o.start(when); o.stop(when + dur + 0.02);
        };

        const ping = (from: number, to: number, dur = 0.16, when = t0) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(from, when);
            o.frequency.exponentialRampToValueAtTime(to, when + dur);
            g.gain.setValueAtTime(0, when);
            g.gain.linearRampToValueAtTime(0.9, when + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
            o.connect(g).connect(this.master);
            o.start(when); o.stop(when + dur + 0.02);
        };

        switch (name) {
            case 'send': {
                tone(900, 0.06, 'square', 0.7, t0);
                tone(1300, 0.05, 'square', 0.5, t0 + 0.06);
                break;
            }
            case 'receive': {
                ping(700, 1400, 0.18, t0);
                break;
            }
            case 'success': {
                tone(660, 0.06, 'triangle', 0.6, t0);
                tone(880, 0.06, 'triangle', 0.6, t0 + 0.07);
                tone(990, 0.08, 'triangle', 0.5, t0 + 0.14);
                break;
            }
            case 'error': {
                tone(160, 0.16, 'sawtooth', 0.5, t0);
                tone(120, 0.18, 'sawtooth', 0.4, t0 + 0.02);
                break;
            }
            case 'notify': {
                ping(1100, 1700, 0.14, t0);
                break;
            }
            case 'hover': {
                tone(1200, 0.03, 'square', 0.25, t0);
                break;
            }
        }
    }

    // --- helpers ---
    private ensureCtx(): AudioContext {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
            this.master = this.ctx.createGain();
            this.master.gain.value = this._muted ? 0 : this._volume;
            this.master.connect(this.ctx.destination);
        }
        return this.ctx;
    }
}
