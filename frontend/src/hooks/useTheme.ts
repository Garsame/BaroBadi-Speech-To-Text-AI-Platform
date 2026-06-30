import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Resolve initial theme from any of the current/legacy keys
    const saved =
      localStorage.getItem("baroplatform-theme") ||
      localStorage.getItem("theme") ||
      localStorage.getItem("public-theme") ||
      localStorage.getItem("user-theme") ||
      localStorage.getItem("admin-theme");

    const activeTheme =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    setTheme(activeTheme);
    document.documentElement.dataset.theme = activeTheme;
    document.documentElement.setAttribute("data-theme", activeTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.setAttribute("data-theme", nextTheme);
    
    // Save to the new unified storage key
    localStorage.setItem("baroplatform-theme", nextTheme);

    // Sync legacy storage keys for backward compatibility
    localStorage.setItem("theme", nextTheme);
    localStorage.setItem("public-theme", nextTheme);
    localStorage.setItem("user-theme", nextTheme);
    localStorage.setItem("admin-theme", nextTheme);

    // Dispatch event to sync other loaded components instantly
    window.dispatchEvent(
      new CustomEvent("baroplatform-theme-changed", { detail: nextTheme })
    );
  };

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<Theme>;
      if (customEvent.detail && customEvent.detail !== theme) {
        setTheme(customEvent.detail);
      }
    };
    window.addEventListener("baroplatform-theme-changed", handleThemeChange);
    return () =>
      window.removeEventListener(
        "baroplatform-theme-changed",
        handleThemeChange
      );
  }, [theme]);

  return { theme, setTheme, toggleTheme };
}
