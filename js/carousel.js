class Carousel {
  constructor(containerEl, options, onSelect) {
    this.container = containerEl;
    this.wrapper = containerEl.parentElement;
    this.options = options;
    this.onSelect = onSelect;
    this.selectedIndex = 0;

    this.ITEM_HEIGHT = 80;
    this.DRAG_THRESHOLD = 24;
    this.dragStartY = null;
    this._firedThisGesture = false;
    this._cooling = false;
    this._coolTimer = null;

    this._createHighlight();
    this._render();
    this._bindEvents();
  }

  _createHighlight() {
    const existing = this.wrapper.querySelector('.carousel-highlight');
    if (existing) existing.remove();

    this.highlight = document.createElement('div');
    this.highlight.className = 'carousel-highlight';

    this.highlightText = document.createElement('span');
    this.highlightText.className = 'carousel-highlight-text';
    this.highlight.appendChild(this.highlightText);

    this.wrapper.insertBefore(this.highlight, this.container);
    this._updateHighlight();
  }

  _updateHighlight() {
    this.highlightText.textContent = this.options[this.selectedIndex].text;
  }

  _render() {
    this.container.innerHTML = '';

    this.track = document.createElement('div');
    this.track.className = 'carousel-track';
    this.container.appendChild(this.track);

    this.items = this.options.map((opt, i) => {
      const item = document.createElement('div');
      item.className = 'carousel-item' + (i === this.selectedIndex ? ' active' : '');
      item.dataset.index = i;

      const dot = document.createElement('div');
      dot.className = 'carousel-dot';

      item.appendChild(dot);
      this.track.appendChild(item);

      item.addEventListener('click', () => this.select(i));
      return item;
    });

    this._updateTrack(false);
  }

  _updateTrack(animate = true) {
    const CURVE = 8; // px of rightward offset per distance²
    const transition = animate
      ? 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease'
      : 'none';

    this.items.forEach((item, i) => {
      const d = i - this.selectedIndex;
      const x = d * d * CURVE;
      const y = d * this.ITEM_HEIGHT;
      const opacity = Math.max(0, 1 - Math.abs(d) * 0.28);

      item.style.transition = transition;
      item.style.transform = `translate(${x}px, ${y}px)`;
      item.style.opacity = opacity;
      item.classList.toggle('active', i === this.selectedIndex);
    });
  }

  select(index, silent = false) {
    if (index < 0 || index >= this.options.length) return;
    if (this._cooling && !silent) return;

    this.selectedIndex = index;
    this._updateTrack(true);
    this._updateHighlight();
    if (!silent && this.onSelect) this.onSelect(index);

    this._cooling = true;
    clearTimeout(this._coolTimer);
    this._coolTimer = setTimeout(() => { this._cooling = false; }, 420);
  }

  update(options, selectedIndex = 0) {
    this.options = options;
    this.selectedIndex = selectedIndex;
    this._updateHighlight();
    this._render();
  }

  _bindEvents() {
    // Mouse drag — listen on window so drag works anywhere on screen
    window.addEventListener('mousedown', (e) => {
      this.dragStartY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.dragStartY === null) return;
      const delta = e.clientY - this.dragStartY;
      if (Math.abs(delta) > this.DRAG_THRESHOLD) {
        this.select(this.selectedIndex + (delta < 0 ? 1 : -1));
        this.dragStartY = e.clientY; // roll: next step measures from here
      }
    });

    window.addEventListener('mouseup', () => {
      this.dragStartY = null;
    });

    // Touch — same rolling threshold approach
    this.wrapper.addEventListener('touchstart', (e) => {
      this.dragStartY = e.touches[0].clientY;
    }, { passive: true });

    this.wrapper.addEventListener('touchmove', (e) => {
      if (this.dragStartY === null) return;
      const delta = e.touches[0].clientY - this.dragStartY;
      if (Math.abs(delta) > this.DRAG_THRESHOLD) {
        this.select(this.selectedIndex + (delta < 0 ? 1 : -1));
        this.dragStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.wrapper.addEventListener('touchend', () => {
      this.dragStartY = null;
    }, { passive: true });

    // Scroll wheel — listen on window so it works anywhere on screen
    let isScrolling = false;

    window.addEventListener('wheel', (e) => {
      e.preventDefault();

      if (isScrolling) return;
      if (Math.abs(e.deltaY) <= 20) return;

      const dir = e.deltaY > 0 ? 1 : -1;
      isScrolling = true;
      this.select(this.selectedIndex + dir);

      setTimeout(() => { isScrolling = false; }, 800);
    }, { passive: false, capture: true });
  }
}
