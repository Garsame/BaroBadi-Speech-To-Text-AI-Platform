"use client";

import { MdDarkMode, MdLightMode } from "react-icons/md";
import { useTheme } from "@/hooks/useTheme";

export default function ThemeToggle() {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle color mode"
      title="Toggle color mode"
    >
      <span className="theme-icon theme-icon-dark">
        <MdDarkMode />
      </span>
      <span className="theme-icon theme-icon-light">
        <MdLightMode />
      </span>
    </button>
  );
}
