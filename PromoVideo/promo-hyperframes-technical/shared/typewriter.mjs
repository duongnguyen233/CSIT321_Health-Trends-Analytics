/**
 * Typewriter helpers for the CareData Technical Film.
 * Used by scene timeline modules to type/erase text in chunked 2-1-1 rhythm.
 * Rule: typing.mp3 fires once per burst, not once per chunk.
 */

/**
 * Split text into 2-1-1 chunks (two chars, one char, one char, repeat).
 * @param {string} text
 * @returns {string[]}
 */
export function chunkText(text) {
  const chunks = [];
  let i = 0, phase = 0;
  while (i < text.length) {
    const n = phase === 0 ? 2 : 1;
    chunks.push(text.slice(i, Math.min(i + n, text.length)));
    i += n;
    phase = (phase + 1) % 3;
  }
  return chunks;
}

/**
 * Type text into an element using GSAP timeline calls, 2-1-1 chunk rhythm.
 * Returns the total duration in seconds.
 *
 * @param {gsap.core.Timeline} tl - GSAP timeline to schedule calls on
 * @param {HTMLElement}        el - target element (textContent appended)
 * @param {string}             text
 * @param {object}             opts
 * @param {number}  opts.at       - timeline position (seconds)
 * @param {number}  opts.tickMs   - milliseconds per chunk (default 70)
 * @param {HTMLAudioElement} opts.sfx - optional audio element (played once at start)
 * @returns {number} total duration in seconds
 */
export function paste(tl, el, text, { at = 0, tickMs = 70, sfx = null } = {}) {
  const chunks = chunkText(text);

  if (sfx) {
    tl.call(() => {
      try { sfx.currentTime = 0; sfx.play(); } catch (_) {}
    }, null, at);
  }

  chunks.forEach((chunk, i) => {
    tl.call(() => { el.textContent += chunk; }, null, at + i * tickMs / 1000);
  });

  return chunks.length * tickMs / 1000;
}

/**
 * Erase all text from an element character-by-character, scheduled on a GSAP timeline.
 * @param {gsap.core.Timeline} tl
 * @param {HTMLElement}        el
 * @param {object}             opts
 * @param {number} opts.at     - start time in seconds
 * @param {number} opts.tickMs - milliseconds per character (default 12)
 * @returns {number} total duration in seconds
 */
export function erase(tl, el, { at = 0, tickMs = 12 } = {}) {
  const len = el.textContent.length;
  for (let i = 0; i < len; i++) {
    tl.call(() => {
      el.textContent = el.textContent.slice(0, -1);
    }, null, at + i * tickMs / 1000);
  }
  return len * tickMs / 1000;
}
