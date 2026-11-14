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

    // 快取佈局計算結果，避免 Layout Thrashing
    this.maxScroll = 100;
    this.pxPerSec = 0;

    this._touchStartY = 0;
    this._bindGestures();
  }

  configure(totalDurationMs, canAdvanceFn) {
    this.totalDurationSec = Math.max(5, totalDurationMs / 1000);
    this.canAdvanceFn = canAdvanceFn;
    this.reset();
    this.updateBounds();
  }

  updateBounds() {
    // 將 DOM 高度讀取移出 60fps 的渲染迴圈，僅在啟動與配置時計算
    this.maxScroll = Math.max(100, this.trackEl.scrollHeight - this.viewportEl.clientHeight * 0.5);
    this.pxPerSec = this.maxScroll / this.totalDurationSec;
  }

  reset() {
    this.translateY = 0;
    this.trackEl.style.transition = "none";
    this._applyTransform();
  }

  start() {
    if (this.running) return;
    this.updateBounds(); // 確保啟動時根據最新字體/行距取得正確高度
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
      this.translateY += this.pxPerSec * dt;

      if (this.translateY >= this.maxScroll) {
        this.translateY = this.maxScroll;
        this._applyTransform();
        this.stop();
        this.onComplete?.();
        return;
      }
      this._applyTransform();
    }

    this.rafId = requestAnimationFrame((ts) => this._tick(ts));
  }

  _applyTransform() {
    this.trackEl.style.transform = `translate3d(0, -${this.translateY}px, 0)`;
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
        
        // 加入 maxScroll 雙向邊界防護
        this.translateY = Math.max(0, Math.min(this.translateY + deltaY, this.maxScroll));
        this._applyTransform();
      },
      { passive: false }
    );

    this.viewportEl.addEventListener(
      "wheel",
      (e) => {
        if (!this.viewportEl.dataset.scrollMode) return;
        // 加入 maxScroll 雙向邊界防護
        this.translateY = Math.max(0, Math.min(this.translateY + e.deltaY * 0.6, this.maxScroll));
        this._applyTransform();
      },
      { passive: true }
    );
  }
}
