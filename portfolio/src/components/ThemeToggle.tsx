"use client";

/**
 * Sun/moon button that switches light and dark mode. The theme itself lives
 * on <html data-theme>, set before paint by the script in layout.tsx, so this
 * renders the same markup on server and client and CSS picks the icon.
 */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.classList.add("theme-switching");
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage blocked: the choice just won't persist.
    }
    window.setTimeout(() => root.classList.remove("theme-switching"), 400);
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="Switch light or dark mode">
      <svg className="theme-toggle__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
      </svg>
      <svg className="theme-toggle__moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.6A8.5 8.5 0 0 1 9.4 4a8.5 8.5 0 1 0 10.6 10.6Z" />
      </svg>
    </button>
  );
}
