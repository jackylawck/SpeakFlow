import { applyTranslations, toggleLang, t } from "./shared/i18n.js";
import { splitSentences } from "./shared/segmenter.js";
import { calculateSentenceDurationMs, calculateTotalDurationMs } from "./shared/pacing.js";
import { initScriptStorage } from "./shared/storage.js";
import { PrompterEngine, showToast } from "./shared/prompter-core.js";

const els = {
  editorView: document.getElementById("editor-view"),
  prompterView: document.getElementById("prompter-view"),
  scriptInput: document.getElementById("script-input"),
  statsBadge: document.getElementById("stats-badge"),
  storageStatus: document.getElementById("storage-status"),
  saveLocalBtn: document.getElementById("save-local-btn"),
  clearStorageBtn: document.getElementById("clear-storage-btn"),
  langBtn: document.getElementById("lang-btn"),
  modeSelect: document.getElementById("mode-select"),
  pacingMode: document.getElementById("pacing-mode"),
  speedInput: document.getElementById("speed-input"),
  speedLabel: document.getElementById("speed-label"),
  fontSizeInput: document.getElementById("fontsize-input"),
  lineHeightInput: document.getElementById("lineheight-input"),
  fsVal: document.getElementById("fs-val"),
  lhVal: document.getElementById("lh-val"),
  startBtn: document.getElementById("start-btn"),
  stageViewport: document.getElementById("stage-viewport"),
  scrollTrack: document.getElementById("scroll-track"),
  eyeline: document.getElementById("eyeline"),
  micBarWrap: document.getElementById("mic-bar-wrap"),
  micStatusText: document.getElementById("mic-status-text"),
  micLevelFill: document.getElementById("mic-level-fill"),
  backBtn: document.getElementById("back-btn"),
  prevBtn: document.getElementById("prev-btn"),
  toggleBtn: document.getElementById("toggle-btn"),
  nextBtn: document.getElementById("next-btn"),
  micBtn: document.getElementById("mic-btn"),
  contrastBtn: document.getElementById("contrast-btn"),
  eyelineBtn: document.getElementById("eyeline-btn"),
  mirrorXBtn: document.getElementById("mirror-x-btn"),
  mirrorYBtn: document.getElementById("mirror-y-btn"),
  restartBtn: document.getElementById("restart-btn"),
  progressLabel: document.getElementById("progress-label"),
  micModal: document.getElementById("mic-modal"),
  micCancelBtn: document.getElementById("mic-cancel-btn"),
  micConfirmBtn: document.getElementById("mic-confirm-btn"),
  toastContainer: document.getElementById("toast-container")
};

const engine = new PrompterEngine({ els });

function updateStats() {
  const sentences = splitSentences(els.scriptInput.value);
  const durations = sentences.map((s) =>
    calculateSentenceDurationMs(s, els.pacingMode.value, els.speedInput.value)
  );
  const totalSec = Math.round(calculateTotalDurationMs(durations) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const timeStr = mins > 0 ? t("timeMinSec", mins, secs) : t("timeSec", secs);
  els.statsBadge.textContent = t("statsFmt", sentences.length, timeStr);
}

const storage = initScriptStorage({
  textareaEl: els.scriptInput,
  statusEl: els.storageStatus,
  t,
  onUpdate: updateStats
});

els.saveLocalBtn.addEventListener("click", () => {
  storage.saveLocal();
  showToast(els.toastContainer, t("toastSavedLocal"));
});

els.clearStorageBtn.addEventListener("click", () => {
  storage.clearAll();
  showToast(els.toastContainer, t("toastCleared"));
});

els.pacingMode.addEventListener("change", () => {
  if (els.pacingMode.value === "dynamic") {
    els.speedLabel.setAttribute("data-i18n", "labelSpeedCpm");
    els.speedLabel.textContent = t("labelSpeedCpm");
    els.speedInput.value = 210;
    els.speedInput.min = 60;
    els.speedInput.max = 500;
    els.speedInput.step = 10;
  } else {
    els.speedLabel.setAttribute("data-i18n", "labelSpeedFixed");
    els.speedLabel.textContent = t("labelSpeedFixed");
    els.speedInput.value = 3.5;
    els.speedInput.min = 0.5;
    els.speedInput.max = 60;
    els.speedInput.step = 0.5;
  }
  updateStats();
});

els.speedInput.addEventListener("input", updateStats);
els.fontSizeInput.addEventListener("input", () => {
  els.fsVal.textContent = `${els.fontSizeInput.value}px`;
  document.documentElement.style.setProperty("--font-size", `${els.fontSizeInput.value}px`);
});
els.lineHeightInput.addEventListener("input", () => {
  els.lhVal.textContent = els.lineHeightInput.value;
  document.documentElement.style.setProperty("--line-height", els.lineHeightInput.value);
});

els.langBtn.addEventListener("click", () => {
  toggleLang();
  updateStats();
  if (engine.state.view === "prompter") {
    els.toggleBtn.textContent = engine.state.isPlaying ? t("ctrlPause") : t("ctrlResume");
  }
});

els.stageViewport.addEventListener("click", () => {
  if (engine.state.view === "prompter" && engine.state.mode === "popup") {
    engine.goToChunk(engine.state.currentIndex + 1);
  }
});

els.startBtn.addEventListener("click", async () => {
  const rawText = els.scriptInput.value.trim();
  if (!rawText) {
    showToast(els.toastContainer, t("toastEmptyScript"), true);
    return;
  }

  engine.state.view = "prompter";
  engine.enableUnloadGuard();
  els.editorView.classList.add("hidden");
  els.prompterView.classList.remove("hidden");

  await engine.acquireWakeLock();
  engine.mountScript(rawText, {
    mode: els.modeSelect.value,
    pacingMode: els.pacingMode.value,
    speedValue: els.speedInput.value,
    preservePosition: false
  });
  engine.startPlayback();
});

els.micBtn.addEventListener("click", () => {
  if (engine.state.micEnabled) {
    engine.vad.stop();
    engine.state.micEnabled = false;
    engine.state.isSpeaking = true;
    els.micBtn.classList.remove("active-state");
    els.micBarWrap.classList.add("hidden");
    engine.syncSchedule();
    return;
  }
  els.micModal.classList.remove("hidden");
  els.micConfirmBtn.focus();
});

els.micCancelBtn.addEventListener("click", () => {
  els.micModal.classList.add("hidden");
  els.micBtn.focus();
});

els.micConfirmBtn.addEventListener("click", async () => {
  els.micModal.classList.add("hidden");
  els.micBtn.focus();
  const wasPlaying = engine.state.isPlaying;
  engine.stopPlayback();

  try {
    await engine.vad.start();
    engine.state.micEnabled = true;
    engine.state.isSpeaking = true;
    els.micBtn.classList.add("active-state");
    els.micBarWrap.classList.remove("hidden");
    els.micStatusText.textContent = t("micListening");
    if (wasPlaying) engine.startPlayback();
  } catch (err) {
    if (wasPlaying) engine.startPlayback();
    if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
      showToast(els.toastContainer, t("errMicDenied"), true);
    } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
      showToast(els.toastContainer, t("errMicNotFound"), true);
    } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
      showToast(els.toastContainer, t("errMicBusy"), true);
    } else {
      showToast(els.toastContainer, t("errMicGeneric"), true);
    }
  }
});

els.toggleBtn.addEventListener("click", () => (engine.state.isPlaying ? engine.stopPlayback() : engine.startPlayback()));
els.prevBtn.addEventListener("click", () => engine.goToChunk(engine.state.currentIndex - 1));
els.nextBtn.addEventListener("click", () => engine.goToChunk(engine.state.currentIndex + 1));

els.contrastBtn.addEventListener("click", () => {
  document.body.classList.toggle("high-contrast");
  els.contrastBtn.classList.toggle("active-state");
});
els.eyelineBtn.addEventListener("click", () => {
  els.eyeline.classList.toggle("hidden");
  els.eyelineBtn.classList.toggle("active-state");
});
els.mirrorXBtn.addEventListener("click", () => {
  els.stageViewport.classList.toggle("mirror-x");
  els.mirrorXBtn.classList.toggle("active-state");
});
els.mirrorYBtn.addEventListener("click", () => {
  els.stageViewport.classList.toggle("mirror-y");
  els.mirrorYBtn.classList.toggle("active-state");
});

els.restartBtn.addEventListener("click", () => {
  if (engine.state.mode === "popup") {
    engine.goToChunk(0);
    engine.startPlayback();
  } else {
    engine.scrollEngine.reset();
    engine.startPlayback();
  }
});

els.backBtn.addEventListener("click", () => {
  engine.disableUnloadGuard();
  engine.stopPlayback();
  if (engine.state.micEnabled) {
    engine.vad.stop();
    engine.state.micEnabled = false;
    els.micBtn.classList.remove("active-state");
    els.micBarWrap.classList.add("hidden");
  }
  engine.releaseWakeLock();
  engine.state.view = "editor";
  els.prompterView.classList.add("hidden");
  els.editorView.classList.remove("hidden");
});

document.addEventListener("keydown", (e) => {
  if (!els.micModal.classList.contains("hidden")) {
    if (e.key === "Escape") {
      e.preventDefault();
      els.micModal.classList.add("hidden");
      els.micBtn.focus();
    }
    return;
  }

  if (engine.state.view !== "prompter") return;

  if (e.code === "Space") {
    e.preventDefault();
    engine.state.isPlaying ? engine.stopPlayback() : engine.startPlayback();
  } else if (e.code === "ArrowDown" || e.code === "ArrowRight" || e.code === "PageDown") {
    e.preventDefault();
    if (engine.state.mode === "popup") engine.goToChunk(engine.state.currentIndex + 1);
  } else if (e.code === "ArrowUp" || e.code === "ArrowLeft" || e.code === "PageUp") {
    e.preventDefault();
    if (engine.state.mode === "popup") engine.goToChunk(engine.state.currentIndex - 1);
  } else if (e.key === "f" || e.key === "F") {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
});

applyTranslations();
updateStats();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
