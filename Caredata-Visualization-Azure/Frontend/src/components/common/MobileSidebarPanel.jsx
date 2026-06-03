import { useState } from "react";

/**
 * Desktop (lg+): sidebar stays in the left column (unchanged layout).
 * Phone/tablet: sidebar collapses; tap the button to open navigation.
 */
export default function MobileSidebarPanel({
  children,
  menuLabel = "Menu",
  desktopFrom = "lg",
}) {
  const [open, setOpen] = useState(false);
  const mobileOnly = desktopFrom === "xl" ? "xl:hidden" : "lg:hidden";
  const desktopOnly = desktopFrom === "xl" ? "hidden xl:block" : "hidden lg:block";

  return (
    <>
      <div className={`w-full shrink-0 ${mobileOnly}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--bg-white)",
            border: "1px solid var(--line)",
            color: "var(--ink-900)",
          }}
          aria-expanded={open}
        >
          <span>{menuLabel}</span>
          <span aria-hidden className="text-xs opacity-70">
            {open ? "Hide" : "Show"}
          </span>
        </button>
        {open && (
          <div className="mt-2 w-full [&_aside]:!w-full [&_aside]:!max-w-none [&_aside]:!static">
            {children}
          </div>
        )}
      </div>
      <div className={`shrink-0 ${desktopOnly}`}>{children}</div>
    </>
  );
}

/** Shared main row: stack on phone, sidebar + content side-by-side on lg+. */
export const PAGE_MAIN_ROW =
  "flex flex-col lg:flex-row flex-grow pt-24 pb-12 px-4 sm:px-8 mx-auto gap-6 w-full items-start";
