/**
 * Scene preview nav bar -- 8-minute presentation structure (revised 2026-05-18).
 * Self-contained: drop <script src="_nav.js" defer></script> before </body>.
 * Detects current scene from filename and renders Prev / Index / Next floating pill.
 * Keyboard: <- prev, -> next, Esc index.
 *
 * 18 numbered slots across 9 sections. Gap at 16 only (shares scene-07-tech-stack.html
 * until a dedicated backend-code scene is built). All other slots are now built.
 * Old three-act scenes moved to old/ subdirectory.
 */
(function () {
  const SCENES = [
    { num:  1, file: "scene-01-hook-tech.html",         label: "Hook + Brand" },
    { num:  2, file: "scene-02-team-intro.html",        label: "Team Intro" },
    { num:  3, file: "scene-03-problem.html",           label: "Problem" },
    { num:  4, file: "scene-04-target-market.html",     label: "Target Market" },
    { num:  5, file: "scene-05-marketing-mix.html",     label: "Marketing Mix" },
    { num:  6, file: "scene-06-system-diagram.html",    label: "System Diagram" },
    { num:  7, file: "scene-07-tech-stack.html",        label: "Tech Stack" },
    { num:  8, file: "scene-08-dev-process.html",       label: "Dev Process" },
    { num:  9, file: "scene-09-login-demo.html",        label: "Login Demo" },
    { num: 10, file: "scene-10-data-entry-gpms.html",   label: "Data Entry" },
    { num: 11, file: "scene-11-qi-dashboard-tech.html", label: "QI Dashboard" },
    { num: 12, file: "scene-12-qi-reports.html",        label: "QI Reports" },
    { num: 13, file: "scene-13-benchmarking.html",      label: "Benchmarking" },
    { num: 14, file: "scene-14-voice-link.html",        label: "Voice Screening" },
    { num: 15, file: "scene-15-frontend-code.html",     label: "Frontend Code" },
    // 16: shares scene-07-tech-stack.html until dedicated backend-code scene built
    { num: 17, file: "scene-17-api-data-flow.html",     label: "API Data Flow" },
    { num: 18, file: "scene-18-outro.html",             label: "Conclusion" },
  ];

  const here = location.pathname.split("/").pop();
  const idx = SCENES.findIndex((s) => s.file === here);
  if (idx === -1) return; // not a known scene; bail silently

  const prev = idx > 0 ? SCENES[idx - 1] : null;
  const next = idx < SCENES.length - 1 ? SCENES[idx + 1] : null;
  const cur  = SCENES[idx];
  const num  = String(cur.num).padStart(2, "0");
  const total = "18"; // 18 numbered slots; gap at 16 (shares scene-07-tech-stack.html)

  // Inject styles
  const style = document.createElement("style");
  style.textContent = `
    .__nav-bar {
      position: fixed; top: 18px; right: 18px;
      z-index: 9999;
      display: inline-flex; align-items: stretch;
      background: rgba(251, 248, 242, 0.92);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid #E2DCCC;
      border-radius: 999px;
      box-shadow: 0 8px 22px rgba(60,55,40,0.12), 0 2px 6px rgba(60,55,40,0.06);
      font-family: "Geist Mono", ui-monospace, "SF Mono", Consolas, monospace;
      font-size: 12px; font-weight: 500;
      color: #3D4743;
      letter-spacing: 0.06em;
      user-select: none;
      transition: opacity 0.18s ease;
      opacity: 0.55;
    }
    .__nav-bar:hover { opacity: 1; }
    .__nav-bar a, .__nav-bar span.__cur {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 14px;
      color: #3D4743;
      text-decoration: none;
      border-right: 1px solid #ECE7DC;
      transition: background 0.14s ease, color 0.14s ease;
    }
    .__nav-bar a:last-child { border-right: none; }
    .__nav-bar a:hover { background: #EEF1EC; color: #4B6A55; }
    .__nav-bar a.__disabled {
      opacity: 0.35; pointer-events: none;
    }
    .__nav-bar .__cur {
      color: #4B6A55; font-weight: 600;
      background: rgba(159,180,160,0.10);
    }
    .__nav-bar .__chev { font-family: ui-monospace, monospace; font-weight: 700; }
    .__nav-bar .__home { font-size: 13px; line-height: 1; }
    @media (max-width: 600px) {
      .__nav-bar { font-size: 11px; }
      .__nav-bar a, .__nav-bar span.__cur { padding: 8px 10px; }
    }
  `;
  document.head.appendChild(style);

  // Build the bar
  const bar = document.createElement("nav");
  bar.className = "__nav-bar";
  bar.setAttribute("aria-label", "Scene navigation");

  const prevHref = prev ? prev.file : "#";
  const nextHref = next ? next.file : "#";
  const prevTitle = prev ? `Previous: Scene ${String(prev.num).padStart(2,"0")} ${prev.label}` : "No previous scene";
  const nextTitle = next ? `Next: Scene ${String(next.num).padStart(2,"0")} ${next.label}` : "No next scene";

  bar.innerHTML = `
    <a href="${prevHref}" class="${prev ? "" : "__disabled"}" title="${prevTitle}" aria-label="${prevTitle}">
      <span class="__chev">◀</span><span>Prev</span>
    </a>
    <a href="index.html" class="__home" title="All scenes (Esc)" aria-label="All scenes">
      <span>${num} / ${total}</span>
      <span style="opacity:0.5;">·</span>
      <span style="font-weight:600;color:#4B6A55;">${cur.label}</span>
    </a>
    <a href="${nextHref}" class="${next ? "" : "__disabled"}" title="${nextTitle}" aria-label="${nextTitle}">
      <span>Next</span><span class="__chev">▶</span>
    </a>
  `;

  if (document.body) document.body.appendChild(bar);
  else document.addEventListener("DOMContentLoaded", () => document.body.appendChild(bar));

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft" && prev) location.href = prev.file;
    else if (e.key === "ArrowRight" && next) location.href = next.file;
    else if (e.key === "Escape") location.href = "index.html";
  });
})();
