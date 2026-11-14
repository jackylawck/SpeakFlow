/**
 * [Integration-Tested Module] 依賴瀏覽器 Web Audio API 與 MediaDevices。
 * 封裝麥克風音壓門控（VAD），僅在本地預分配緩衝區計算 RMS 音量，零錄音、零持久化。
 */
export class VoiceActivityDetector {
  constructor({ threshold = 0.022, hangoverMs = 650, emitInitialState = true, onLevel, onStateChange }) {
    this.threshold = threshold;
    this.hangoverMs = hangoverMs;
    this.emitInitialState = emitInitialState;
    this.onLevel = onLevel;
    this.onStateChange = onStateChange;

    this.active = false;
    this.isSpeaking = false;
    this.lastSpokeAt = 0;
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.rafId = null;

    this._fftSize = 512;
    this._data = new Float32Array(this._fftSize);
  }

  async start() {
    if (this.active) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(this.stream);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = this._fftSize;
      source.connect(this.analyser);

      this.active = true;
      this.isSpeaking = true;
      this.lastSpokeAt = performance.now();
      if (this.emitInitialState) {
        this.onStateChange?.(true);
      }
      this._loop();
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  stop() {
    this.active = false;
    this.isSpeaking = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  _loop() {
    if (!this.active || !this.analyser) return;

    this.analyser.getFloatTimeDomainData(this._data);

    let sum = 0;
    for (let i = 0; i < this._data.length; i++) {
      sum += this._data[i] * this._data[i];
    }
    const rms = Math.sqrt(sum / this._data.length);
    const pct = Math.min(100, Math.round((rms / 0.12) * 100));
    this.onLevel?.(pct);

    const now = performance.now();
    if (rms > this.threshold) {
      this.lastSpokeAt = now;
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.onStateChange?.(true);
      }
    } else if (now - this.lastSpokeAt > this.hangoverMs) {
      if (this.isSpeaking) {
        this.isSpeaking = false;
        this.onStateChange?.(false);
      }
    }

    this.rafId = requestAnimationFrame(() => this._loop());
  }
}
