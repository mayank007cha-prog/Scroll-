"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string };

/**
 * "Contents" list for a case study: highlights the section in view and
 * glides to a section on click. Sticky sidebar on desktop, a scrollable
 * row of chips on small screens (CSS only).
 */
export function CaseToc({ items }: { items: Item[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const sections = items
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    let frame = 0;
    // Current section = the last one whose top has passed a third of the
    // screen (or the last one when scrolled to the bottom).
    const update = () => {
      frame = 0;
      const line = window.innerHeight / 3;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = sections[0]?.id;
      for (const el of sections) if (el.getBoundingClientRect().top <= line) current = el.id;
      if (atBottom) current = sections[sections.length - 1]?.id;
      if (current) setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav className="cs-toc" aria-label="Contents">
      <p className="cs-toc__title">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M7 5h10M7 10h10M7 15h10" />
          <path d="M3 5h.01M3 10h.01M3 15h.01" strokeWidth="2.2" />
        </svg>
        Contents
      </p>
      <ol className="cs-toc__list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => go(e, item.id)}
              className={item.id === active ? "is-active" : undefined}
              aria-current={item.id === active ? "true" : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
