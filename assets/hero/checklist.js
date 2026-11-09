// Plays the checklist when it scrolls into view: the steps appear one by one, then the
// validated ones are ticked one by one while the bar fills, then the current step pulses.
const section = document.getElementById('checklist');

if (section && !matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const items = [...section.querySelectorAll('.checklist li')];
  const bar = section.querySelector('.progress:not(.progress--small) span');
  const total = items.length;
  const STEP = 300;   // ms between two steps appearing
  const TICK = 420;   // ms between two ticks

  section.classList.add('anim');
  bar.style.setProperty('--w', '0%');

  function play() {
    section.classList.add('in');
    items.forEach((li, i) => setTimeout(() => li.classList.add('shown'), i * STEP));

    const done = items.filter(li => li.classList.contains('done'));
    const start = items.length * STEP + 400;
    done.forEach((li, i) => setTimeout(() => {
      li.classList.add('checked');
      bar.style.setProperty('--w', ((i + 1) / total * 100) + '%');
    }, start + i * TICK));

    const end = start + done.length * TICK;
    items.filter(li => li.classList.contains('current'))
      .forEach(li => setTimeout(() => li.classList.add('pulse'), end));
  }

  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); play(); }
  }, { threshold: 0.4 });
  io.observe(section);
}
