import { splitSentences } from "./segmenter.js";
import { calculateSentenceDurationMs, calculateTotalDurationMs } from "./pacing.js";
import { VoiceActivityDetector } from "./vad.js";
import { SmoothScrollEngine } from "./scroll-engine.js";
import { t } from "./i18n.js";

export function showToast(containerEl, message, isError = false) {
  const toast = document.createElement("div");
  toast.className = isError ? "toast error" : "toast";
  toast.textContent = message;
  containerEl.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

export function findClosestSentence(targetText, candidateSentences) {
  if (!targetText || !candidateSentences.length) return -1;
  const targetClean = targetText.replace(/\s+/g, "");
  if (!targetClean) return -1;

  const exactIdx = candidateSentences.findIndex((s) => s.replace(/\s+/g, "") === targetClean);
  if (exactIdx >= 0) return exactIdx;

  const targetChars = new Set(targetClean);
  let bestIdx = -1;
  let bestScore = 0.35;

  candidateSentences.forEach((cand, idx) => {
    const candClean = cand.replace(/\s+/g, "");
    if (!candClean) return;
    let overlap = 0;
    for (const ch of candClean) {
      if (targetChars.has(ch)) overlap++;
    }
    const lenRatio = Math.min(targetClean.length, candClean.length) / Math.max(targetClean.length, candClean.length);
    const score = (overlap / Math.max(targetClean.length, candClean.length)) * lenRatio;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  return bestIdx;
}

export class PrompterEngine {
  constructor({ els, onIndexChange, onFullStateChange }) {
    this.els = els;
    this.onIndexChange = onIndexChange;
    this.onFullStateChange = onFullStateChange;

    this.state = {
      view: "editor",
      mode: "popup",
      isPlaying: false,
      currentIndex: 0,
      micEnabled: false,
      isSpeaking: true,
      timerId: null,
      sentenceStartedAt: 0,
      sentenceElapsedMs: 0,
      items: [],
      rawScript: "",
      totalDurationMs: 0,
      wakeLock: null
    };

    this._unloadHandler = null;

    this.scrollEngine = new SmoothScrollEngine({
      viewportEl: els.stageViewport,
      trackEl: els.scrollTrack,
      onComplete: () => this.stopPlayback()
    });

    this.vad = new VoiceActivityDetector({
      emitInitialState: false,
      onLevel: (pct) => {
        els.micLevelFill.style.width = `${pct}%`;
      },
      onStateChange: (speaking) => {
        this.state.isSpeaking = speaking;
        els.micStatusText.textContent = speaking ? t("micSpeaking") : t("micPaused");
        this.syncSchedule();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.state.view === "prompter") {
        this.acquireWakeLock();
      }
    });
  }

  enableUnloadGuard() {
    if (this._unloadHandler) return;
    this._unloadHandler = (e) => {
      e.preventDefault();
      e.returnValue = t("unloadWarning");
    };
    window.addEventListener("beforeunload", this._unloadHandler);
  }

  disableUnloadGuard() {
    if (!this._unloadHandler) return;
    window.removeEventListener("beforeunload", this._unloadHandler);
    this._unloadHandler = null;
  }

  async acquireWakeLock() {
    if (!("wakeLock" in navigator) || this.state.wakeLock) return;
    try {
      const lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => {
        if (this.state.wakeLock === lock) this.state.wakeLock = null;
      });
      this.state.wakeLock = lock;
    } catch {}
  }

  releaseWakeLock() {
    if (this.state.wakeLock) {
      this.state.wakeLock.release().catch(() => {});
      this.state.wakeLock = null;
    }
  }

  getVisualState() {
    return {
      mirrorX: this.els.stageViewport.classList.contains("mirror-x"),
      mirrorY: this.els.stageViewport.classList.contains("mirror-y"),
      highContrast: document.body.classList.contains("high-contrast"),
      eyelineHidden: this.els.eyeline.classList.contains("hidden")
    };
  }

  clearTimer() {
    if (this.state.timerId !== null) {
      clearTimeout(this.state.timerId);
      this.state.timerId = null;
    }
  }

  recordElapsed() {
    if (this.state.mode === "scroll") return;
    if (this.state.sentenceStartedAt > 0) {
      this.state.sentenceElapsedMs += performance.now() - this.state.sentenceStartedAt;
      this.state.sentenceStartedAt = 0;
    }
  }

  syncSchedule() {
    this.clearTimer();
    if (this.state.mode === "scroll") {
      this.state.isPlaying ? this.scrollEngine.start() : this.scrollEngine.stop();
      return;
    }

    this.recordElapsed();

    const canAdvance = this.state.isPlaying && (!this.state.micEnabled || this.state.isSpeaking);
    if (!canAdvance) return;

    const totalMs = this.state.items[this.state.currentIndex]?.durationMs ?? 3000;
    const remainingMs = Math.max(200, totalMs - this.state.sentenceElapsedMs);
    this.state.sentenceStartedAt = performance.now();

    this.state.timerId = setTimeout(() => {
      this.state.timerId = null;
      this.state.sentenceStartedAt = 0;
      this.state.sentenceElapsedMs = 0;

      if (!this.state.isPlaying) return;
      if (this.state.micEnabled && !this.state.isSpeaking) return;

      if (this.state.currentIndex < this.state.items.length - 1) {
        this.state.currentIndex++;
        this.renderChunks();
        this.syncSchedule();
      } else {
        this.stopPlayback();
      }
    }, remainingMs);
  }

  startPlayback() {
    this.state.isPlaying = true;
    this.els.toggleBtn.textContent = t("ctrlPause");
    this.syncSchedule();
    this.onIndexChange?.();
  }

  stopPlayback() {
    this.state.isPlaying = false;
    this.els.toggleBtn.textContent = t("ctrlResume");
    this.recordElapsed();
    this.clearTimer();
    this.scrollEngine.stop();
    this.onIndexChange?.();
  }

  goToChunk(idx) {
    const clamped = Math.max(0, Math.min(idx, this.state.items.length - 1));
    this.state.currentIndex = clamped;
    this.state.sentenceStartedAt = 0;
    this.state.sentenceElapsedMs = 0;
    this.renderChunks();
    this.syncSchedule();
  }

  renderChunks() {
    const nodes = this.els.scrollTrack.querySelectorAll(".chunk");
    let activeNode = null;

    nodes.forEach((node, idx) => {
      node.classList.remove("active", "revealed", "upcoming", "peek");
      if (idx < this.state.currentIndex) {
        node.classList.add("revealed");
      } else if (idx === this.state.currentIndex) {
        node.classList.add("active");
        activeNode = node;
      } else {
        node.classList.add("upcoming");
      }
    });

    if (activeNode) {
      const targetOffset = activeNode.offsetTop - this.els.stageViewport.clientHeight * 0.28;
      const clampedY = Math.max(0, targetOffset);
      this.els.scrollTrack.style.transition = "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)";
      this.els.scrollTrack.style.transform = `translate3d(0, -${clampedY}px, 0)`;
    }

    const secHint = (this.state.items[this.state.currentIndex].durationMs / 1000).toFixed(1);
    this.els.progressLabel.textContent = `${this.state.currentIndex + 1}/${this.state.items.length} (${secHint}s)`;
    this.onIndexChange?.();
  }

  mountScript(rawText, { mode, pacingMode, speedValue, preservePosition = false }) {
    const oldCurrentText = this.state.items[this.state.currentIndex]?.text || "";
    const sentences = splitSentences(rawText);

    this.state.rawScript = rawText;
    this.state.items = sentences.map((text) => ({
      text,
      durationMs: calculateSentenceDurationMs(text, pacingMode, speedValue)
    }));
    this.state.totalDurationMs = calculateTotalDurationMs(this.state.items.map((i) => i.durationMs));
    this.state.mode = mode;

    if (preservePosition && oldCurrentText) {
      const matchedIdx = findClosestSentence(oldCurrentText, sentences);
      if (matchedIdx >= 0) {
        this.state.currentIndex = matchedIdx;
      } else if (this.state.currentIndex >= this.state.items.length) {
        this.state.currentIndex = 0;
      }
    } else {
      this.state.currentIndex = 0;
    }

    this.state.sentenceStartedAt = 0;
    this.state.sentenceElapsedMs = 0;

    if (mode === "popup") {
      delete this.els.stageViewport.dataset.scrollMode;
      this.els.prevBtn.classList.remove("hidden");
      this.els.nextBtn.classList.remove("hidden");

      const fragment = document.createDocumentFragment();
      this.state.items.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "chunk";
        div.textContent = item.text;
        div.addEventListener("click", (e) => {
          e.stopPropagation();
          if (div.classList.contains("revealed") && !div.classList.contains("peek")) {
            div.classList.add("peek");
            setTimeout(() => div.classList.remove("peek"), 2000);
            return;
          }
          this.goToChunk(idx);
        });
        fragment.appendChild(div);
      });
      this.els.scrollTrack.replaceChildren(fragment);
      this.renderChunks();
    } else {
      this.els.stageViewport.dataset.scrollMode = "1";
      this.els.prevBtn.classList.add("hidden");
      this.els.nextBtn.classList.add("hidden");

      const smoothDiv = document.createElement("div");
      smoothDiv.className = "smooth-text";
      smoothDiv.textContent = rawText;
      this.els.scrollTrack.replaceChildren(smoothDiv);

      this.els.progressLabel.textContent = t("toastGpuScroll");
      this.scrollEngine.configure(
        this.state.totalDurationMs,
        () => !this.state.micEnabled || this.state.isSpeaking
      );
    }
  }
}
