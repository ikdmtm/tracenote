import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { getSetting, setSetting } from "@/core/storage/settingsRepo";
import { THEMES, naturalTheme, type ThemeColors, type ThemeId } from "./colors";

type ThemeState = {
  theme: ThemeColors;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeState>({
  theme: naturalTheme,
  themeId: "natural",
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [themeId, setThemeIdState] = useState<ThemeId>("natural");

  useEffect(() => {
    (async () => {
      const saved = await getSetting(db, "theme");
      if (saved && saved in THEMES) setThemeIdState(saved as ThemeId);
    })();
  }, [db]);

  const setThemeId = useCallback(
    (id: ThemeId) => {
      setThemeIdState(id);
      setSetting(db, "theme", id);
    },
    [db],
  );

  const theme = THEMES[themeId];

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
