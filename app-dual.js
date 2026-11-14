} else {
    // 註：導播後台的 dir-contrast-btn 預設隨 body.high-contrast 亮燈，
    // 連線後會由 renderDirectorFullState() 依據提詞端實際 visualState 動態同步。
    els.prompterPairBox.classList.add("hidden");
    els.directorPairBox.classList.remove("hidden");
    els.scriptInput.classList.add("hidden");
    els.editorSettingsGrid.classList.add("hidden");
    els.startBtn.classList.add("hidden");
  }
