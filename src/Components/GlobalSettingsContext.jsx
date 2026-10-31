import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_GLOBAL_SETTINGS, GLOBAL_SETTINGS_DRAFT_KEY, loadPublishedGlobalSettings, normalizeGlobalSettings } from "../lib/globalSettings";

const GlobalSettingsContext = createContext({ settings: DEFAULT_GLOBAL_SETTINGS, configured: false });

function readDraftPreview() {
  try {
    const value = sessionStorage.getItem(GLOBAL_SETTINGS_DRAFT_KEY);
    return value ? normalizeGlobalSettings(JSON.parse(value)) : null;
  } catch { return null; }
}

export function GlobalSettingsProvider({ children }) {
  const isPreview = new URLSearchParams(window.location.search).has("globalSettingsPreview");
  const [value, setValue] = useState(() => {
    const preview = isPreview ? readDraftPreview() : null;
    return preview ? { settings: preview, configured: true } : { settings: DEFAULT_GLOBAL_SETTINGS, configured: false };
  });

  useEffect(() => {
    const preview = isPreview ? readDraftPreview() : null;
    if (preview) {
      return undefined;
    }
    let active = true;
    loadPublishedGlobalSettings().then((result) => { if (active) setValue(result); });
    return () => { active = false; };
  }, [isPreview]);

  return <GlobalSettingsContext.Provider value={value}>{children}</GlobalSettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGlobalSettings() {
  return useContext(GlobalSettingsContext);
}
