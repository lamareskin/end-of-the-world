let _dzCounter = 0;

class Q1Interaction {
  constructor({
    overlay, dropZone, iconTray, circleText, illustrationImg, btnNext, onAnswer,
    icons, titleConfigs, defaultTitle,
    activeClass      = 'q1-active',
    accentColor      = '#fed5d6',
    flatBg           = false,
    illustrationSetup = null,
    hoverPreview      = false,
    onDropComplete    = null,
  }) {
    this.overlay          = overlay;
    this.dropZone         = dropZone;
    this.iconTray         = iconTray;
    this.circleText       = circleText;
    this.illustrationImg  = illustrationImg;
    this.btnNext          = btnNext;
    this.onAnswer         = onAnswer;

    this.activeClass       = activeClass;
    this.accentColor       = accentColor;
    this.flatBg            = flatBg;
    this.illustrationSetup = illustrationSetup;
    this.hoverPreview       = hoverPreview;
    this.onDropComplete     = onDropComplete;

    this.cursorEl  = document.getElementById('q1-custom-cursor');
    this.cursorImg = document.getElementById('q1-cursor-img');
    this.bgEl      = document.getElementById('q1-bg');
    this.trayPill  = document.getElementById('q1-tray-pill');
    this.pulseEl   = document.getElementById('q1-pulse');
    this.screenEl  = document.getElementById('screen-question');

    this.trayPill.addEventListener('mouseenter', () => this._slideTrayIn());

    this.icons           = icons;
    this._TITLE_CONFIGS  = titleConfigs;
    this._DEFAULT_TITLE  = defaultTitle;

    this.selectedIndex   = null;
    this._draggingIndex  = null;
    this._floatingEl     = null;
    this._floatingSize   = null;
    this._slotOriginRect = null;
    this._isDragging     = false;
    this._cursorState    = null;
    this._defaultTimer   = null;

    this._dzId           = ++_dzCounter;
    this._dzEl           = null;
    this._pathEl         = null;
    this._dragConstraint = null;

    this.iconEls  = [];
    this.titleEl  = document.getElementById('question-text');

    this._onMouseMove  = this._handleMouseMove.bind(this);
    this._onMouseUp    = this._handleMouseUp.bind(this);
    this._onMouseLeave = () => { this.cursorEl.style.display = 'none'; };
    this._onTrayEnter  = () => { if (!this._isDragging) this._setCursor('hover'); };
    this._onTrayLeave  = () => { if (!this._isDragging) this._setCursor('normal'); };
  }

  /* ── internal drop zone ── */

  _createDropZoneEl() {
    const id = `q1-dzf-tp-${this._dzId}`;
    const el = document.createElement('div');
    el.className = 'q1-dz-floating';
    el.style.background = '#5e0015';
    el.innerHTML = `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;">
      <defs>
        <path id="${id}" d="M 80,36 A 44,44 0 0,1 124,80 A 44,44 0 0,1 80,124 A 44,44 0 0,1 36,80 A 44,44 0 0,1 80,36"/>
      </defs>
      <g class="q1-dzf-spin-g">
        <text class="q1-dz-text"><textPath href="#${id}" textLength="277" lengthAdjust="spacing">Drag here to lock answer&#160;&#160;&#160;&#160;&#160;&#160;</textPath></text>
      </g>
    </svg>`;
    document.body.appendChild(el);
    return el;
  }

  _createPathEl() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:fixed;pointer-events:none;z-index:99;display:none;overflow:visible;';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '3 8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke', '#5e0015');
    svg.appendChild(path);
    document.body.appendChild(svg);
    return svg;
  }

  _showDropZone(i) {
    if (!this._dzEl) {
      this._dzEl  = this._createDropZoneEl();
      this._pathEl = this._createPathEl();
    }
    const slotEl    = this.iconEls[i];
    const iconImg   = slotEl.querySelector('.q1-icon');
    const iconRect  = iconImg.getBoundingClientRect();
    const iconCenterX = iconRect.left + iconRect.width  / 2;
    const iconCenterY = iconRect.top  + iconRect.height / 2;

    const dzSize   = Math.max(iconRect.width, iconRect.height);
    const dzRadius = dzSize / 2;
    const gap      = 40; // gap between icon bottom and DZ top edge

    // DZ centered below the icon
    const dzCenterX = iconCenterX;
    const dzCenterY = iconRect.bottom + gap + dzRadius;

    this._dzEl.style.width     = dzSize + 'px';
    this._dzEl.style.height    = dzSize + 'px';
    this._dzEl.style.left      = dzCenterX + 'px';
    this._dzEl.style.top       = dzCenterY + 'px';
    this._dzEl.style.transform = 'translate(-50%, -50%)';
    this._dzEl.style.opacity   = '0.6';
    this._dzEl.style.display   = 'block';

    // D-track: mirrors horizontal version rotated 90° — arc at icon center overflows upward into icon,
    // two vertical lines run down from icon center to DZ center (DZ circle covers the bottom ends)
    if (this._pathEl) {
      const pathEl = this._pathEl.querySelector('path');
      const trackW = dzSize;                    // width of track = icon/DZ size
      const rHalf  = dzRadius;                  // arc radius = half track width
      const trackH = dzCenterY - iconCenterY;   // height: icon center → DZ center

      this._pathEl.setAttribute('viewBox', `0 0 ${trackW} ${trackH}`);
      this._pathEl.style.width  = trackW + 'px';
      this._pathEl.style.height = trackH + 'px';
      this._pathEl.style.left   = (iconCenterX - rHalf) + 'px';
      this._pathEl.style.top    = iconCenterY + 'px';

      if (pathEl) {
        // Lines from DZ center (y=trackH) up to icon center (y=0), then arc sweeps upward
        // (overflow:visible lets arc extend above y=0 into the icon, same as horizontal arc extended right)
        pathEl.setAttribute('d',
          `M 0,${trackH} L 0,0 A ${rHalf},${rHalf} 0 0,1 ${trackW},0 L ${trackW},${trackH}`
        );
      }
      this._pathEl.style.opacity = '0.6';
      this._pathEl.style.display = 'block';
    }

    // Vertical drag constraint: fixed X, clamp Y between icon center and DZ center
    this._dragConstraint = {
      fixedX: iconCenterX,
      fixedY: null,
      minX: null, maxX: null,
      minY: iconCenterY,
      maxY: dzCenterY,
    };

    this.dropZone = this._dzEl;
  }

  _hideDropZone() {
    if (this._dzEl)  this._dzEl.style.display  = 'none';
    if (this._pathEl) this._pathEl.style.display = 'none';
    this.dropZone = null;
  }

  /* ── title ── */

  _updateTitle(i) {
    if (!this.titleEl) return;
    const cfg = (i !== null && i !== undefined)
      ? this._TITLE_CONFIGS[i]
      : this._DEFAULT_TITLE;
    this.titleEl.innerHTML =
      `<span class="q1-pink-word">${cfg.pink}</span>${cfg.rest}`;
  }

  /* ── cursor ── */

  _setCursor(state) {
    if (this._cursorState === state) return;
    this._cursorState = state;
    const map = { normal: 'normal.svg', hover: 'hover.svg', grab: 'grab.svg' };
    this.cursorImg.src = map[state];
    this.cursorEl.classList.toggle('q1-cursor-normal', state === 'normal');
    this.cursorEl.classList.toggle('q1-cursor-hover',  state === 'hover');
    this.cursorEl.classList.toggle('q1-cursor-grab',   state === 'grab');
    if (state !== 'normal') this.cursorImg.style.transform = '';
  }

  _handleMouseMove(e) {
    const overUI = e.target.closest('#btn-home, .logo-btn, .btn-next, .sb-next');
    if (overUI) {
      this.cursorEl.style.display = 'none';
      return;
    }
    this.cursorEl.style.left = e.clientX + 'px';
    this.cursorEl.style.top  = e.clientY + 'px';
    if (this.cursorEl.style.display !== 'block') this.cursorEl.style.display = 'block';

    if (this._floatingEl && this._floatingSize) {
      let x = e.clientX, y = e.clientY;
      if (this._isDragging && this._dragConstraint) {
        const c = this._dragConstraint;
        if (c.fixedX !== null) x = c.fixedX;
        if (c.fixedY !== null) y = c.fixedY;
        if (c.minX !== null) x = Math.max(c.minX, Math.min(c.maxX, x));
        if (c.minY !== null) y = Math.max(c.minY, Math.min(c.maxY, y));
      }
      this._floatingEl.style.left = (x - this._floatingSize.w / 2) + 'px';
      this._floatingEl.style.top  = (y - this._floatingSize.h / 2) + 'px';
    }

    if (this._cursorState === 'normal') {
      const t   = e.clientY / window.innerHeight;
      const rot = 120 - t * 60;
      this.cursorImg.style.transform = `rotate(${rot}deg)`;
    }
  }

  /* ── ghost silhouette ── */

  _showGhost(index) {
    this.iconEls[index].classList.add('q1-slot-dragging');
  }

  _restoreSlot(index) {
    this.iconEls[index].classList.remove('q1-slot-dragging');
  }

  /* ── drag ── */

  _startDrag(index, e) {
    if (this.selectedIndex !== null && this.selectedIndex !== index) {
      this._restoreSlot(this.selectedIndex);
      this._showDefault();
    }

    const slot = this.iconEls[index];
    const img  = slot.querySelector('.q1-icon');
    const rect = img.getBoundingClientRect();

    this._draggingIndex  = index;
    this._slotOriginRect = rect;
    this._isDragging     = true;
    this._updateTitle(index);

    this._showGhost(index);
    if (this._dzEl)  this._dzEl.style.opacity  = '1';
    if (this._pathEl) this._pathEl.style.opacity = '1';
    if (this.hoverPreview) {
      // keep q1-hovering so drop zone stays visible during drag
      this.iconEls.forEach(el => el.classList.remove('q1-slot-hovered'));
      if (this.pulseEl) this.pulseEl.classList.remove('visible');
    }

    const scale = 1.2;
    const w = rect.width  * scale;
    const h = rect.height * scale;

    const labelText = this._TITLE_CONFIGS[index].pink;

    const clone = document.createElement('div');
    clone.style.cssText = `position:fixed;display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:500;left:${e.clientX - w / 2}px;top:${e.clientY - h / 2}px;`;

    const cloneImg = document.createElement('img');
    cloneImg.src = img.src;
    cloneImg.style.cssText = `width:${w}px;height:${h}px;object-fit:contain;display:block;filter:drop-shadow(0px 10px 8px rgba(85,0,23,0.45));`;

    const cloneLabel = document.createElement('span');
    cloneLabel.textContent = labelText;
    cloneLabel.style.cssText = `display:block;margin-top:10px;font-family:'PPNeueMontreal',system-ui,sans-serif;font-size:16px;font-weight:400;color:${this.accentColor};white-space:nowrap;line-height:1;`;

    clone.appendChild(cloneImg);
    if (!this.flatBg) clone.appendChild(cloneLabel);
    document.body.appendChild(clone);
    this._floatingEl   = clone;
    this._floatingSize = { w, h };

    this._setCursor('grab');
    document.body.style.cursor = 'none';
    document.addEventListener('mouseup', this._onMouseUp);
  }

  _handleMouseUp(e) {
    if (!this._isDragging) return;
    document.removeEventListener('mouseup', this._onMouseUp);
    this._isDragging = false;

    if (!this.dropZone) { this._snapBack(); return; }

    let checkX = e.clientX, checkY = e.clientY;
    if (this._dragConstraint) {
      const c = this._dragConstraint;
      if (c.fixedX !== null) checkX = c.fixedX;
      if (c.fixedY !== null) checkY = c.fixedY;
      if (c.minX !== null) checkX = Math.max(c.minX, Math.min(c.maxX, checkX));
      if (c.minY !== null) checkY = Math.max(c.minY, Math.min(c.maxY, checkY));
    }

    const zr = this.dropZone.getBoundingClientRect();
    const inside = checkX >= zr.left && checkX <= zr.right && checkY >= zr.top && checkY <= zr.bottom;
    if (inside) this._completeDrop();
    else        this._snapBack();
  }

  _completeDrop() {
    const index     = this._draggingIndex;
    const floating  = this._floatingEl;
    const floatSize = this._floatingSize;
    const dzEl      = this._dzEl;

    this.selectedIndex   = index;
    this._floatingEl     = null;
    this._floatingSize   = null;
    this._draggingIndex  = null;
    this._dragConstraint = null;

    this._showIllustration(index);
    this.btnNext.classList.remove('btn-next-disabled');
    if (this.onAnswer) this.onAnswer(index);
    document.body.style.cursor = '';
    this._updateTitle(index);
    this._setCursor('normal');
    this._slideTrayOut();

    if (floating && dzEl && dzEl.style.display !== 'none') {
      const dzRect = dzEl.getBoundingClientRect();
      const w = floatSize ? floatSize.w : 80;
      const h = floatSize ? floatSize.h : 80;
      // Fly ghost to DZ center
      floating.style.transition = 'left 0.15s ease, top 0.15s ease';
      floating.style.left = (dzRect.left + dzRect.width  / 2 - w / 2) + 'px';
      floating.style.top  = (dzRect.top  + dzRect.height / 2 - h / 2) + 'px';
      // After ghost arrives, run the drop animation
      setTimeout(() => this._playDropAnimation(dzEl, floating, index), 180);
    } else {
      this._hideDropZone();
      if (floating) floating.remove();
      if (this.onDropComplete) this.onDropComplete(index, null, null);
    }
  }

  _playDropAnimation(dzEl, floating, index) {
    // Clockwise hot-pink fill ring
    const ns = 'http://www.w3.org/2000/svg';
    const fillSvg = document.createElementNS(ns, 'svg');
    fillSvg.setAttribute('viewBox', '0 0 100 100');
    fillSvg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;transform:rotate(-90deg);';
    const fillCircle = document.createElementNS(ns, 'circle');
    fillCircle.setAttribute('cx', '50');
    fillCircle.setAttribute('cy', '50');
    fillCircle.setAttribute('r', '46');
    fillCircle.setAttribute('fill', 'none');
    fillCircle.setAttribute('stroke', '#ff2d78');
    fillCircle.setAttribute('stroke-width', '5');
    const circ = (2 * Math.PI * 46).toFixed(2);
    fillCircle.setAttribute('stroke-dasharray', circ);
    fillCircle.setAttribute('stroke-dashoffset', circ);
    fillSvg.appendChild(fillCircle);
    dzEl.appendChild(fillSvg);

    // Trigger the fill
    requestAnimationFrame(() => {
      fillCircle.style.transition = 'stroke-dashoffset 0.75s linear';
      fillCircle.style.strokeDashoffset = '0';
    });

    // Shake + grow
    dzEl.classList.add('q1-dz-drop-anim');

    // After animation: instant snap everything away
    setTimeout(() => {
      if (floating && floating.parentNode) floating.remove();
      if (dzEl.contains(fillSvg)) dzEl.removeChild(fillSvg);
      dzEl.classList.remove('q1-dz-drop-anim');
      this._hideDropZone();
      if (this.onDropComplete) this.onDropComplete(index, null, null);
    }, 950);
  }

  _slideTrayOut() {
    this.iconTray.classList.add('tray-hidden');
    this.trayPill.classList.add('pill-visible');
  }

  _slideTrayIn() {
    this.iconTray.classList.remove('tray-hidden');
    this.trayPill.classList.remove('pill-visible');
  }

  _snapBack() {
    const index      = this._draggingIndex;
    const floating   = this._floatingEl;
    const originRect = this._slotOriginRect;
    const slot       = this.iconEls[index];

    floating.style.transition = 'left 0.3s cubic-bezier(0.4,0,0.2,1), top 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s, height 0.3s';
    floating.style.left   = originRect.left + 'px';
    floating.style.top    = originRect.top  + 'px';
    floating.style.width  = originRect.width  + 'px';
    floating.style.height = originRect.height + 'px';

    setTimeout(() => {
      this._restoreSlot(index);
      floating.remove();
      this._floatingEl    = null;
      this._draggingIndex = null;
    }, 300);

    this._updateTitle(this.selectedIndex);
    document.body.style.cursor = '';
    this._setCursor('normal');
    this._dragConstraint = null;
    if (this.hoverPreview) {
      this.screenEl.classList.remove('q1-hovering');
      this.iconEls.forEach(el => el.classList.remove('q1-slot-hovered'));
      if (this.pulseEl) this.pulseEl.classList.remove('visible');
      this._hideDropZone();
    }
  }

  /* ── background (Q1 only — skipped when flatBg) ── */

  _RECT_BG() {
    return [
      'linear-gradient(to right,  #450819, transparent 9vw)',
      'linear-gradient(to left,   #450819, transparent 9vw)',
      'linear-gradient(to bottom, #450819, transparent 11vh)',
      'linear-gradient(to top,    #450819, transparent 11vh)',
      '#700a31',
    ].join(', ');
  }

  _applyBg(i) {
    if (this.flatBg) return;
    const bg = this.bgEl;
    bg.innerHTML = '';
    bg.style.background = '#6d1631';
    bg.classList.add('visible');
  }

  /* ── render ── */

  _render() {
    this.iconTray.innerHTML = '';
    this.iconEls = this.icons.map((opt, i) => {
      const slot = document.createElement('div');
      slot.className = 'q1-icon-slot';

      const img = document.createElement('img');
      img.src       = opt.icon;
      img.alt       = opt.text;
      img.className = 'q1-icon';
      img.draggable = false;

      const label = document.createElement('span');
      label.className   = 'q1-icon-label';
      label.textContent = this._TITLE_CONFIGS[i].pink;

      img.addEventListener('mousedown', (e) => { e.preventDefault(); this._startDrag(i, e); });
      label.addEventListener('mousedown', (e) => { e.preventDefault(); this._startDrag(i, e); });

      if (this.hoverPreview) {
        slot.addEventListener('mouseenter', () => this._previewIllustration(i));
        slot.addEventListener('mouseleave', () => this._revertPreview());
      }

      slot.appendChild(img);
      slot.appendChild(label);
      this.iconTray.appendChild(slot);
      return slot;
    });
  }

  _previewIllustration(i) {
    clearTimeout(this._previewEnterTimer);
    clearTimeout(this._previewLeaveTimer);
    this._previewEnterTimer = setTimeout(() => {
      if (this._isDragging) return;
      clearTimeout(this._defaultTimer);
      const opt = this.icons[i];
      const img = this.illustrationImg;
      img.style.display = '';
      img.classList.remove(
        'doom-img', 'loved-img', 'nature-img', 'reckless-img', 'full-bleed',
        'q1-img', 'q1-img-humans', 'q1-img-ai', 'q1-img-god'
      );
      if (this.illustrationSetup) this.illustrationSetup(img, i);
      img.src = opt.illustration;
      this._updateTitle(i);

      if (this.hoverPreview) {
        this.screenEl.classList.add('q1-hovering');
        this.iconEls.forEach((el, idx) => el.classList.toggle('q1-slot-hovered', idx === i));
        this._showDropZone(i);
      }
    }, 120);
  }

  _revertPreview() {
    clearTimeout(this._previewEnterTimer);
    if (this._isDragging) return;
    this._previewLeaveTimer = setTimeout(() => {
      if (this.hoverPreview) {
        this.screenEl.classList.remove('q1-hovering');
        this.iconEls.forEach(el => el.classList.remove('q1-slot-hovered'));
        if (this.pulseEl) this.pulseEl.classList.remove('visible');
        this._hideDropZone();
      }
      if (this.selectedIndex !== null) {
        this._showIllustration(this.selectedIndex);
        this._updateTitle(this.selectedIndex);
      } else {
        this._showDefault();
      }
    }, 120);
  }

  _bindTrayHover()   { this.iconTray.addEventListener('mouseenter', this._onTrayEnter); this.iconTray.addEventListener('mouseleave', this._onTrayLeave); }
  _unbindTrayHover() { this.iconTray.removeEventListener('mouseenter', this._onTrayEnter); this.iconTray.removeEventListener('mouseleave', this._onTrayLeave); }

  /* ── illustration state ── */

  _showDefault() {
    this.illustrationImg.classList.add('fade-out');
    clearTimeout(this._defaultTimer);
    this._defaultTimer = setTimeout(() => {
      this.illustrationImg.src = '';
      this.illustrationImg.style.display = 'none';
      this.illustrationImg.classList.remove('fade-out', 'q1-img', 'q1-img-humans', 'q1-img-ai', 'q1-img-god');
    }, 150);
    if (this.dropZone) this.dropZone.classList.remove('q1-has-drop');
    this.selectedIndex = null;
    this.btnNext.classList.add('btn-next-disabled');
    this._applyBg(null);
    this._updateTitle(null);
    if (this.illustrationSetup) this.illustrationSetup(null, null);
  }

  _showIllustration(i) {
    clearTimeout(this._defaultTimer);
    const opt = this.icons[i];
    this.illustrationImg.style.display = '';
    this.illustrationImg.classList.remove(
      'doom-img', 'loved-img', 'nature-img', 'reckless-img', 'full-bleed',
      'q1-img', 'q1-img-humans', 'q1-img-ai', 'q1-img-god',
      'fade-out'
    );
    if (this.illustrationSetup) this.illustrationSetup(this.illustrationImg, i);
    this.illustrationImg.src = opt.illustration;
    if (this.dropZone) this.dropZone.classList.add('q1-has-drop');
    if (this.circleText) this.circleText.classList.add('hidden');
    this._applyBg(i);
  }

  /* ── public API ── */

  show() {
    this._render();
    this.iconTray.classList.remove('tray-hidden');
    this.trayPill.classList.remove('pill-visible');
    this.overlay.style.display = 'flex';

    if (this.pulseEl && !this.pulseEl._ringInjected) {
      this.pulseEl._ringInjected = true;
      this.pulseEl.style.background = 'transparent';
      this.pulseEl.style.boxShadow  = 'none';
      this.pulseEl.innerHTML = `<svg viewBox="0 0 110 110" style="position:absolute;inset:0;width:100%;height:100%;">
        <circle cx="55" cy="55" r="50" class="q1-pulse-ring"/>
      </svg>`;
    }

    if (this.selectedIndex !== null) {
      this._showGhost(this.selectedIndex);
      this._showIllustration(this.selectedIndex);
      this.btnNext.classList.remove('btn-next-disabled');
      this._updateTitle(this.selectedIndex);
    } else {
      this._showDefault();
      if (this.circleText) this.circleText.classList.remove('hidden');
    }

    this.cursorEl.style.left    = (window.innerWidth  / 2) + 'px';
    this.cursorEl.style.top     = (window.innerHeight / 2) + 'px';
    this.cursorEl.style.display = 'block';
    this._setCursor('normal');

    this.btnNext.textContent = 'Yes';
    this.screenEl.classList.add(this.activeClass);

    document.addEventListener('mousemove',  this._onMouseMove);
    document.addEventListener('mouseleave', this._onMouseLeave);
    this._bindTrayHover();
  }

  hide() {
    this.overlay.style.display = 'none';
    this.btnNext.classList.remove('btn-next-disabled');
    this.cursorEl.style.display = 'none';
    this.btnNext.textContent = 'Next';
    this.bgEl.classList.remove('visible');
    this.screenEl.classList.remove(this.activeClass, 'q1-hovering');
    this.iconEls.forEach(el => el.classList.remove('q1-slot-hovered'));
    if (this.pulseEl) this.pulseEl.classList.remove('visible');
    this._hideDropZone();
    document.removeEventListener('mousemove',  this._onMouseMove);
    document.removeEventListener('mouseleave', this._onMouseLeave);
    this._unbindTrayHover();
    document.removeEventListener('mouseup',    this._onMouseUp);
    if (this._floatingEl) { this._floatingEl.remove(); this._floatingEl = null; }
  }

  reset() {
    this._isDragging     = false;
    this._draggingIndex  = null;
    this._dragConstraint = null;
    if (this._floatingEl) { this._floatingEl.remove(); this._floatingEl = null; }
    this._hideDropZone();
    this.selectedIndex = null;
    this._render();
    this.iconEls.forEach((_, i) => this._restoreSlot(i));
    this._showDefault();
    if (this.circleText) this.circleText.classList.remove('hidden');
    this._setCursor('normal');
    this._slideTrayIn();
  }
}
