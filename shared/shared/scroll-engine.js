/**
 * [Integration-Tested Module] 依賴瀏覽器 DOM / Touch / Wheel 事件與 rAF。
 * 負責 GPU translate3d 滾動與單指觸控位置微調。
 */
export class SmoothScrollEngine {
  constructor({ viewportEl, trackEl, onComplete }) {
    this.viewportEl = viewportEl;
    this.trackEl = trackEl;
    this.onComplete = onComplete;

    this.translateY = 0;
    this.totalDurationSec = 10;
    this.rafId = null;
    this.lastFrameTime = 0;
    this.running = false;
    this.canAdvanceFn = () => true;

    this._touchStartY = 0;
    this._bindGestures();
  }

  configure(totalDurationMs, canAdvanceFn) {
    this.totalDurationSec = Math.max(5, totalDurationMs / 1000);
    this.canAdvanceFn = canAdvanceFn;
    this.reset();
  }

  reset() {
    this.translateY = 0;
    this.trackEl.style.transition = "none";
    this.trackEl.style.transform = "translate3d(0, 0, 0)";
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = 0;
    this.rafId = requestAnimationFrame((ts) => this._tick(ts));
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _tick(timestamp) {
    if (!this.running) return;
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    if (this.canAdvanceFn()) {
      const maxScroll = Math.max(100, this.trackEl.scrollHeight - this.viewportEl.clientHeight * 0.5);
      const pxPerSec = maxScroll / this.totalDurationSec;
      this.translateY += pxPerSec * dt;

      if (this.translateY >= maxScroll) {
        this.translateY = maxScroll;
        this.trackEl.style.transform = `translate3d(0, -${this.translateY}px, 0)`;
        this.stop();
        this.onComplete?.();
        return;
      }
      this.trackEl.style.transform = `translate3d(0, -${this.translateY}px, 0)`;
    }

    this.rafId = requestAnimationFrame((ts) => this._tick(ts));
  }

  _bindGestures() {
    this.viewportEl.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          this._touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    this.viewportEl.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length !== 1 || !this.viewportEl.dataset.scrollMode) return;
        e.preventDefault();
        const deltaY = this._touchStartY - e.touches[0].clientY;
        this._touchStartY = e.touches[0].clientY;
        this.translateY = Math.max(0, this.translateY + deltaY);
        this.trackEl.style.transform = `translate3d(0, -${this.translateY}px, 0)`;
      },
      { passive: false }
    );

    this.viewportEl.addEventListener(
      "wheel",
      (e) => {
        if (!this.viewportEl.dataset.scrollMode) return;
        this.translateY = Math.max(0, this.translateY + e.deltaY * 0.6);
        this.trackEl.style.transform = `translate3d(0, -${this.translateY}px, 0)`;
      },
      { passive: true }
    );
  }
}
