export type ThemeId = "simple" | "natural" | "pop";

export type ThemeColors = {
  id: ThemeId;
  name: string;

  primary: string;
  primaryLight: string;
  primaryBorder: string;
  accent: string;

  bg: string;
  surface: string;
  surfaceBorder: string;
  divider: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  tabActive: string;
  tabInactive: string;
  headerBg: string;
  headerText: string;

  switchTrack: string;

  // status colors (shared across themes)
  success: string;
  warning: string;
  danger: string;

  // share card
  cardBg: string;
  cardText: string;
  cardTextSub: string;
  cardAccent: string;
  cardDot: string;
  cardLine: string;
  cardHomeDot: string;
  cardFooter: string;
};

/* ─── Simple (current blue/slate) ─── */

export const simpleTheme: ThemeColors = {
  id: "simple",
  name: "simple",

  primary: "#3b82f6",
  primaryLight: "#eff6ff",
  primaryBorder: "#bfdbfe",
  accent: "#2563eb",

  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceBorder: "#e2e8f0",
  divider: "#f1f5f9",

  text: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  textOnPrimary: "#ffffff",

  tabActive: "#2563eb",
  tabInactive: "#94a3b8",
  headerBg: "#ffffff",
  headerText: "#1e293b",

  switchTrack: "#93c5fd",

  success: "#16a34a",
  warning: "#d97706",
  danger: "#ef4444",

  cardBg: "#0f172a",
  cardText: "#ffffff",
  cardTextSub: "rgba(255,255,255,0.5)",
  cardAccent: "#3b82f6",
  cardDot: "#3b82f6",
  cardLine: "rgba(255,255,255,0.1)",
  cardHomeDot: "#475569",
  cardFooter: "rgba(255,255,255,0.4)",
};

/* ─── Natural (dusty warm tones) ─── */

export const naturalTheme: ThemeColors = {
  id: "natural",
  name: "natural",

  primary: "#C07A6E",
  primaryLight: "#FBF0ED",
  primaryBorder: "#E8C4BD",
  accent: "#B39DBC",

  bg: "#FAF7F5",
  surface: "#ffffff",
  surfaceBorder: "#EDE6E1",
  divider: "#F5F0EC",

  text: "#3D3232",
  textSecondary: "#7A6B6B",
  textMuted: "#A89E9E",
  textOnPrimary: "#ffffff",

  tabActive: "#C07A6E",
  tabInactive: "#A89E9E",
  headerBg: "#FAF7F5",
  headerText: "#3D3232",

  switchTrack: "#E0B1A8",

  success: "#6B9E78",
  warning: "#C4944D",
  danger: "#C96060",

  cardBg: "#3D3232",
  cardText: "#ffffff",
  cardTextSub: "rgba(255,255,255,0.5)",
  cardAccent: "#C07A6E",
  cardDot: "#C07A6E",
  cardLine: "rgba(255,255,255,0.12)",
  cardHomeDot: "#7A6B6B",
  cardFooter: "rgba(255,255,255,0.4)",
};

/* ─── Pop (coral + mint) ─── */

export const popTheme: ThemeColors = {
  id: "pop",
  name: "pop",

  primary: "#FF7B7B",
  primaryLight: "#FFF0EE",
  primaryBorder: "#FFBCB0",
  accent: "#5CC5B5",

  bg: "#FFFBF7",
  surface: "#ffffff",
  surfaceBorder: "#F0E8E2",
  divider: "#FBF4EF",

  text: "#2D2D3A",
  textSecondary: "#6B6B7B",
  textMuted: "#A0A0B0",
  textOnPrimary: "#ffffff",

  tabActive: "#FF7B7B",
  tabInactive: "#A0A0B0",
  headerBg: "#FFFBF7",
  headerText: "#2D2D3A",

  switchTrack: "#FFB3A7",

  success: "#5CC5B5",
  warning: "#F0AD4E",
  danger: "#FF6B6B",

  cardBg: "#2D2D3A",
  cardText: "#ffffff",
  cardTextSub: "rgba(255,255,255,0.5)",
  cardAccent: "#FF7B7B",
  cardDot: "#FF7B7B",
  cardLine: "rgba(255,255,255,0.12)",
  cardHomeDot: "#6B6B7B",
  cardFooter: "rgba(255,255,255,0.4)",
};

export const THEMES: Record<ThemeId, ThemeColors> = {
  simple: simpleTheme,
  natural: naturalTheme,
  pop: popTheme,
};

export const THEME_LIST: ThemeColors[] = [simpleTheme, naturalTheme, popTheme];
