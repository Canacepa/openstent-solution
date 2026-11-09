// Vertical navigation for the solution: one dot per card, the current one lit; a click glides
// to that card (centred on screen, where valve.js lights its part).
const nav = document.querySelector('.vnav');
const slots = [...document.querySelectorAll('#solution .slot')];
const section = document.getElementById('solution');

if (nav && slots.length && section) {
  const items = [...nav.querySelectorAll('button')];
  const centre = el => el.getBoundingClientRect().top + el.offsetHeight / 2 - innerHeight / 2 + scrollY;

  items.forEach((b, i) => b.addEventListener('click', () => {
    scrollTo({ top: centre(slots[i]), behavior: 'smooth' });
  }));

  let ticking = false;
  function update() {
    ticking = false;
    const r = section.getBoundingClientRect();
    // shown while the solution holds the middle of the screen
    nav.classList.toggle('on', r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5);
    let best = 0, gap = Infinity;
    slots.forEach((s, i) => {
      const d = Math.abs(centre(s) - scrollY);
      if (d < gap) { gap = d; best = i; }
    });
    items.forEach((b, i) => {
      b.classList.toggle('active', i === best);
      if (i === best) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}
