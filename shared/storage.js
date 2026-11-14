const SESSION_KEY = "tp_session_script";
const LOCAL_KEY = "tp_local_draft_script";

function safeGet(storage, key) {
  try { return storage.getItem(key); } catch { return null; }
}
function safeSet(storage, key, val) {
  try { storage.setItem(key, val); } catch {}
}
function safeRemove(storage, key) {
  try { storage.removeItem(key); } catch {}
}

export function initScriptStorage({ textareaEl, statusEl, t, onUpdate }) {
  const sessionDraft = safeGet(sessionStorage, SESSION_KEY);
  const localDraft = safeGet(localStorage, LOCAL_KEY);

  if (sessionDraft !== null) {
    textareaEl.value = sessionDraft;
    if (localDraft !== null) {
      statusEl.setAttribute("data-i18n", "storageLocalSaved");
      statusEl.textContent = t("storageLocalSaved");
    }
  } else if (localDraft !== null) {
    textareaEl.value = localDraft;
    safeSet(sessionStorage, SESSION_KEY, localDraft);
    statusEl.setAttribute("data-i18n", "storageLocalRestored");
    statusEl.textContent = t("storageLocalRestored");
  }

  let debounceTimer = null;
  textareaEl.addEventListener("input", () => {
    onUpdate?.();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      safeSet(sessionStorage, SESSION_KEY, textareaEl.value);
    }, 300);
  });

  return {
    saveSessionNow(val) {
      clearTimeout(debounceTimer);
      safeSet(sessionStorage, SESSION_KEY, val);
    },
    saveLocal() {
      clearTimeout(debounceTimer);
      const val = textareaEl.value;
      safeSet(sessionStorage, SESSION_KEY, val);
      safeSet(localStorage, LOCAL_KEY, val);
      statusEl.setAttribute("data-i18n", "storageLocalSaved");
      statusEl.textContent = t("storageLocalSaved");
    },
    clearAll() {
      clearTimeout(debounceTimer);
      safeRemove(sessionStorage, SESSION_KEY);
      safeRemove(localStorage, LOCAL_KEY);
      textareaEl.value = "";
      statusEl.setAttribute("data-i18n", "storageSessionHint");
      statusEl.textContent = t("storageSessionHint");
      onUpdate?.();
    }
  };
}
