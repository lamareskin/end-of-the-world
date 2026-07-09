(() => {
  const container = document.getElementById('globe-container');
  const hitarea  = document.getElementById('globe-hitarea');
  const hovers = [1, 2, 3, 4].map(n => document.getElementById(`globe-hover-${n}`));

  const THRESHOLD = 80;
  let lastX = null;
  let lastY = null;
  let lastShown = -1;

  const ORDER = [0, 2, 1, 3];
  let orderIndex = 0;

  // slide offsets per hover (index 3 = hover4, no slide)
  const SLIDES = ['0px, -10px', '10px, 0px', '0px, -10px', null];

  function showRandom() {
    const next = ORDER[orderIndex % ORDER.length];
    orderIndex++;
    hovers.forEach((el, i) => {
      if (i === next) {
        const s = SLIDES[i];
        if (s) {
          el.style.transition = 'none';
          el.style.transform  = `translate(${s})`;
          el.style.opacity    = '1';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.transition = 'transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)';
            el.style.transform  = 'translate(0, 0)';
          }));
        } else {
          el.style.transition = 'none';
          el.style.opacity    = '1';
        }
      } else {
        el.style.transition = 'none';
        el.style.opacity    = '0';
      }
    });
    lastShown = next;
  }

  function reset() {
    hovers.forEach(el => { el.style.opacity = '0'; });
    lastShown = -1;
    lastX = null;
    lastY = null;
  }

  hitarea.addEventListener('mousemove', (e) => {
    if (lastX === null) {
      lastX = e.clientX;
      lastY = e.clientY;
      showRandom();
      return;
    }
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.sqrt(dx * dx + dy * dy) < THRESHOLD) return;
    lastX = e.clientX;
    lastY = e.clientY;
    showRandom();
  });

  hitarea.addEventListener('mouseleave', reset);
})();
