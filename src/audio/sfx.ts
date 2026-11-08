// Synthesized sound effects (plan 3.1: Web Audio, sounds made in code, no files to license).
// Graph: every voice -> sfx bus -> master gain -> limiter -> speakers (audio-design skill).

import type { Cue } from './cues';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  muted: boolean;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  // Phones only allow audio after a tap, so the context starts on the first user gesture.
  unlock(): void {
    if (this.ctx || typeof AudioContext === 'undefined') {
      void this.ctx?.resume();
      return;
    }
    this.ctx = new AudioContext();
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 12;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.8;
    this.bus.connect(this.master).connect(limiter).connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  play(cue: Cue, delay = 0): void {
    if (this.muted || !this.ctx || !this.bus) return;
    const t = this.ctx.currentTime + delay;
    const vary = 1 + (Math.random() - 0.5) * 0.08; // small pitch variation so repeats do not drone
    switch (cue) {
      case 'dice': for (let k = 0; k < 6; k++) this.noise(t + k * 0.05 + Math.random() * 0.02, 0.04, 1800 * vary, 0.35); break;
      case 'hop': this.tone(t, 0.05, 520 * vary, 760 * vary, 'triangle', 0.18); break;
      case 'buy': this.noise(t, 0.03, 3000, 0.25); this.tone(t + 0.03, 0.14, 1047, 1047, 'sine', 0.3); this.tone(t + 0.12, 0.22, 1568, 1568, 'sine', 0.3); break;
      case 'rent': this.tone(t, 0.08, 1320 * vary, 1320 * vary, 'triangle', 0.25); this.tone(t + 0.08, 0.14, 1760 * vary, 1760 * vary, 'triangle', 0.22); break;
      case 'coin': this.tone(t, 0.1, 1568 * vary, 2093 * vary, 'sine', 0.2); break;
      case 'card': this.sweep(t, 0.22, 600, 4000, 0.22); break;
      case 'bell': for (const [f, g] of [[880, 0.3], [2214, 0.12], [3307, 0.07]] as const) this.tone(t, 1.1, f, f, 'sine', g, true); break;
      case 'horn': for (const f of [311, 392]) this.tone(t, 0.45, f, f, 'sawtooth', 0.09, false, 1400); this.tone(t + 0.5, 0.3, 311, 311, 'sawtooth', 0.09, false, 1400); break;
      case 'build': this.tone(t, 0.09, 180 * vary, 120 * vary, 'square', 0.18, false, 900); this.noise(t, 0.03, 1200, 0.2); break;
      case 'fall': [523, 440, 349, 262].forEach((f, k) => this.tone(t + k * 0.14, 0.18, f, f * 0.97, 'triangle', 0.25)); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, k) => this.tone(t + k * 0.12, k === 3 ? 0.5 : 0.16, f, f, 'triangle', 0.28)); break;
    }
  }

  private envelope(t: number, dur: number, peak: number, ring = false): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (ring ? 1 : 0.95));
    g.connect(this.bus!);
    return g;
  }

  private tone(t: number, dur: number, f0: number, f1: number, type: OscillatorType, peak: number, ring = false, lowpass = 0): void {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.envelope(t, dur, peak, ring);
    if (lowpass) {
      const lp = this.ctx!.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      o.connect(lp).connect(g);
    } else o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBuffer(dur: number): AudioBuffer {
    const len = Math.ceil(this.ctx!.sampleRate * dur);
    const buf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noise(t: number, dur: number, freq: number, peak: number): void {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const bp = this.ctx!.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1.2;
    src.connect(bp).connect(this.envelope(t, dur, peak));
    src.start(t);
  }

  private sweep(t: number, dur: number, f0: number, f1: number, peak: number): void {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const bp = this.ctx!.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    src.connect(bp).connect(this.envelope(t, dur, peak));
    src.start(t);
  }
}
