// Through the story (the hero, scene 1, then each card beside the valve) the scroll is taken
// over: one gesture glides to the next slide in 3 s. Past the last card, from the top
// of .sheet down, the page scrolls natively again.
// ponytail: wheel/keys/touch only; dragging the scrollbar still scrolls freely.

const story = document.querySelector('.story');
const sheet = document.querySelector('.sheet');
const wide = matchMedia('(min-width: 901px)');                    // narrow: no pinned story
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const DUR = 3000;

if (story && sheet) {

const top = el => el.getBoundingClientRect().top + scrollY;
// the hero, each card centred on screen (the first one is scene 1, the heart zoomed)
// (where valve.js lights it), the page after
function stops() {
  const slots = [...story.querySelectorAll('.slot')]
    .map(s => top(s) + s.offsetHeight / 2 - innerHeight / 2);
  return [0, ...slots, top(sheet)];
}

let busy = false;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
function glide(to) {
  const from = scrollY, t0 = performance.now();
  busy = true;
  (function step(now) {
    const t = Math.min(1, (now - t0) / DUR);
    scrollTo({ top: from + (to - from) * ease(t), behavior: 'instant' });
    if (t < 1) requestAnimationFrame(step); else busy = false;
  })(t0);
}

// is this gesture ours? Below the story (or on a narrow / reduced-motion screen) it isn't
function inStory(dir) {
  if (!wide.matches || reduced.matches) return false;
  const end = top(sheet);
  return dir > 0 ? scrollY < end - 2 : scrollY <= end + 2;
}

function go(dir) {
  if (busy) return;
  const s = stops(), y = scrollY;
  const next = dir > 0 ? s.find(v => v > y + 2) : s.findLast(v => v < y - 2);
  if (next !== undefined) glide(next);
}

// a trackpad keeps firing for a second after the flick, so only the start of a
// stream of wheel events counts as a gesture; the rest are just swallowed
let lastWheel = 0;
addEventListener('wheel', e => {
  if (e.ctrlKey || !e.deltaY) return;                              // pinch-zoom, sideways
  const fresh = e.timeStamp - lastWheel > 200;
  lastWheel = e.timeStamp;
  const dir = Math.sign(e.deltaY);
  if (!inStory(dir)) return;
  e.preventDefault();
  if (fresh) go(dir);
}, { passive: false });

const KEYS = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
addEventListener('keydown', e => {
  const dir = e.key === ' ' && e.shiftKey ? -1 : KEYS[e.key];
  if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest('input, textarea, select, button, [contenteditable]')) return;
  if (!inStory(dir)) return;
  e.preventDefault();
  go(dir);
});

let y0 = null;
addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', e => {
  if (y0 === null) { if (busy) e.preventDefault(); return; }
  const dy = y0 - e.touches[0].clientY, dir = dy < 0 ? -1 : 1;
  if (!inStory(dir)) return;
  e.preventDefault();
  if (Math.abs(dy) > 30) { go(dir); y0 = null; }                   // one swipe, one slide
}, { passive: false });

}
