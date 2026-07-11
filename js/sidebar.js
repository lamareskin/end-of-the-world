// SidebarInteraction — vertical bubble sidebar for all 6 questions + Next bubble
//
// questionConfigs[i]:
//   type: 'cursor-slider' | 'icons' | 'slider'
//
//   cursor-slider (Q1):
//     icons[]         — [{icon, illustration, text}]
//     titleConfigs    — [{pink, rest}]
//     defaultTitle    — {pink, rest}
//     onEnter(img, i, item)
//     onLeave(img)
//
//   icons (Q3, Q4, Q5):
//     same as cursor-slider but uses click/hover directly
//     onExpand(), onCollapse()
//
//   slider (Q2, Q6):
//     sliderRef, stages, maxFrame, answerIcon

class SidebarInteraction {
  constructor({ questionConfigs, illustrationImg, titleEl, onSelect, onAdvance }) {
    this.questionConfigs  = questionConfigs;
    this.illustrationImg  = illustrationImg;
    this.titleEl          = titleEl;
    this.onSelect         = onSelect;   // fn(questionIndex, answerIndex)
    this.onAdvance        = onAdvance;

    this._totalQ          = 6;
    this._answers         = new Array(this._totalQ).fill(null);
    this._bubbles         = [];
    this._container       = null;
    this._activeQ         = -1;
    this._sliderState     = null;
    this._pendingSelection = null; // { qIndex, answerIndex, iconSrc }

    // Next bubble state
    this._nextBubble      = null;
    this._nextLabel       = null;
    this._nextEnabled     = false;

    // Diamond shape state
    this._bubbleSvgs      = [];
    this._bubblePolys     = [];
    this._bubbleShapeObs  = [];

    // Inline-next state (Next appears inside the next question's bubble)
    this._inlineNextBubble       = null;
    this._inlineNextHandler      = null;
    this._inlineNextEnterHandler = null;
    this._inlineNextLeaveHandler = null;
    this._inlineNextIndex        = null;

    // Custom cursor state
    this._customCursor        = null;
    this._customCursorImg     = null;
    this._customCursorMoveFn  = null;

    this._buildDOM();
  }

  // ─── DOM ───────────────────────────────────────────────────────────────────

  _buildDOM() {
    const c = document.createElement('div');
    c.id = 'answer-sidebar';
    document.body.appendChild(c);
    this._container = c;

    const svgNS = 'http://www.w3.org/2000/svg';

    for (let i = 0; i < this._totalQ; i++) {
      const b = document.createElement('div');
      b.className = 'sb-bubble';
      if (i === 1) b.classList.add('sb-q2-bubble');
      if (i === 2) b.classList.add('sb-q3-bubble'); // Q3 rectangle
      if (i === 4) b.classList.add('sb-q5-bubble'); // Q5 half-circle
      if (i === 5) b.classList.add('sb-q6-bubble');
      const num = document.createElement('span');
      num.className = 'sb-bubble-num';
      num.textContent = i + 1;
      b.appendChild(num);

      // Diamond border SVG — only Q1 (0) and Q4 (3)
      if (i === 0 || i === 3) {
        b.classList.add('sb-bubble-diamond');
        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('sb-bubble-svg');
        const poly = document.createElementNS(svgNS, 'path');
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', '#5e0015');
        poly.setAttribute('stroke-width', '3');
        svg.appendChild(poly);
        b.appendChild(svg);
        this._bubbleSvgs[i] = svg;
        this._bubblePolys[i] = poly;

        const obs = new ResizeObserver(() => this._updateBubbleShape(b, svg, poly));
        obs.observe(b);
        this._bubbleShapeObs[i] = obs;
      }

      // Chamfered rectangle border SVG — Q3 (2)
      if (i === 2) {
        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('sb-bubble-svg');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#5e0015');
        path.setAttribute('stroke-width', '3');
        svg.appendChild(path);
        b.appendChild(svg);
        this._bubbleSvgs[i] = svg;
        this._bubblePolys[i] = path;

        const obs = new ResizeObserver(() => this._updateQ3Shape(b, svg, path));
        obs.observe(b);
        this._bubbleShapeObs[i] = obs;
      }

      c.appendChild(b);
      this._bubbles.push(b);
    }

    // Next bubble — always at bottom
    const next = document.createElement('div');
    next.className = 'sb-bubble sb-next sb-next-disabled';
    const label = document.createElement('span');
    label.className = 'sb-next-label';
    next.appendChild(label);
    c.appendChild(next);
    this._nextBubble = next;
    this._nextLabel  = label;

    next.addEventListener('click', () => {
      if (!next.classList.contains('sb-next-enabled')) return;
      this._fireNext();
    });
  }

  // ─── Diamond shape ─────────────────────────────────────────────────────────

  _updateBubbleShape(bubble, svg, poly) {
    if (!bubble.classList.contains('sb-active')) return;
    const rect = bubble.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (W < 1 || H < 1) return;
    const tipH = Math.min(W / 2, H / 2);
    const r = 4; // corner rounding radius in px

    // Six vertices of the stretched rhombus
    const pts = [
      [W/2, 0],   // top
      [W, tipH],  // right-top
      [W, H-tipH],// right-bottom
      [W/2, H],   // bottom
      [0, H-tipH],// left-bottom
      [0, tipH],  // left-top
    ];

    // Build a path with small quadratic bezier rounds at each corner
    const n = pts.length;
    const corners = pts.map((v, i) => {
      const prev = pts[(i + n - 1) % n];
      const next = pts[(i + 1) % n];
      const dx1 = v[0] - prev[0], dy1 = v[1] - prev[1];
      const len1 = Math.hypot(dx1, dy1) || 1;
      const dx2 = next[0] - v[0],  dy2 = next[1] - v[1];
      const len2 = Math.hypot(dx2, dy2) || 1;
      return {
        sx: v[0] - (dx1/len1)*r, sy: v[1] - (dy1/len1)*r,
        ex: v[0] + (dx2/len2)*r, ey: v[1] + (dy2/len2)*r,
        vx: v[0], vy: v[1],
      };
    });

    let p = `M ${corners[0].sx} ${corners[0].sy}`;
    for (let i = 0; i < n; i++) {
      const cur = corners[i];
      const nxt = corners[(i + 1) % n];
      p += ` Q ${cur.vx} ${cur.vy} ${cur.ex} ${cur.ey} L ${nxt.sx} ${nxt.sy}`;
    }
    p += ' Z';

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    poly.setAttribute('d', p);

    // clip-path mirrors the shape (approximate with straight polygon for clip)
    bubble.style.clipPath =
      `polygon(50% 0%, 100% ${tipH}px, 100% calc(100% - ${tipH}px), 50% 100%, 0% calc(100% - ${tipH}px), 0% ${tipH}px)`;
  }

  _updateQ3Shape(bubble, svg, path) {
    if (!bubble.classList.contains('sb-active')) return;
    const rect = bubble.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (W < 1 || H < 1) return;

    const c = W * 0.15; // size of the corner cut

    // 8-point chamfered rectangle
    const pts = [
      [c,   0  ],   // top-left cut start
      [W-c, 0  ],   // top-right cut start
      [W,   c  ],   // top-right cut end
      [W,   H-c],   // bottom-right cut start
      [W-c, H  ],   // bottom-right cut end
      [c,   H  ],   // bottom-left cut start
      [0,   H-c],   // bottom-left cut end
      [0,   c  ],   // top-left cut end
    ];

    const d = `M ${pts.map(p => p.join(' ')).join(' L ')} Z`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    path.setAttribute('d', d);

    bubble.style.clipPath = `polygon(${pts.map(p => `${p[0]}px ${p[1]}px`).join(', ')})`;
  }

  _reinjectSvg(bubble, i) {
    const svg = this._bubbleSvgs[i];
    if (svg && !bubble.contains(svg)) bubble.appendChild(svg);
  }

  // ─── Next bubble ───────────────────────────────────────────────────────────

  _fireNext() {
    if (!this._nextEnabled) return;
    const pending = this._pendingSelection;
    this._pendingSelection = null;
    this._activeQ = -1;
    try {
      this._teardownCustomCursor();
      if (pending) {
        const cfg = this.questionConfigs[pending.qIndex];
        if (pending.onCommit)      pending.onCommit();
        if (cfg && cfg.onLeave)    cfg.onLeave(this.illustrationImg);
        if (cfg && cfg.onCollapse) cfg.onCollapse();
        this.markAnswered(pending.qIndex, pending.iconSrc, pending.iconSrcs);
      }
      this._applyFlex(-1);
      this._disableNext();
    } catch (err) {
      console.error('sidebar next-button commit failed, advancing anyway:', err);
    }
    setTimeout(() => { if (this.onAdvance) this.onAdvance(); }, 450);
  }

  _clearInlineNext() {
    if (!this._inlineNextBubble) return;
    const b = this._inlineNextBubble;
    b.removeEventListener('click', this._inlineNextHandler);
    if (this._inlineNextEnterHandler) b.removeEventListener('mouseenter', this._inlineNextEnterHandler);
    if (this._inlineNextLeaveHandler) b.removeEventListener('mouseleave', this._inlineNextLeaveHandler);
    this._setCustomCursorState('normal');
    if (b.classList.contains('sb-next-inline')) {
      b.classList.remove('sb-next-inline');
      b.innerHTML = '';
      const i = this._inlineNextIndex;
      this._reinjectSvg(b, i);
      const num = document.createElement('span');
      num.className = 'sb-bubble-num';
      num.textContent = i + 1;
      b.appendChild(num);
      // _enableNext() sets an explicit flexGrow (0.9/1.2) to turn this
      // bubble into the inline Next prompt — undo it here too, or it's
      // left oversized relative to its siblings until the next _applyFlex
      // call happens to run (which the forward/Next path always triggers,
      // masking this, but Previous's collapseActive() doesn't).
      b.style.flexGrow = '';
    }
    this._inlineNextBubble       = null;
    this._inlineNextHandler      = null;
    this._inlineNextEnterHandler = null;
    this._inlineNextLeaveHandler = null;
    this._inlineNextIndex        = null;
  }

  _enableNext(label) {
    this._nextEnabled = true;
    const nextQ = this._activeQ + 1;

    if (this._activeQ >= 0 && nextQ < this._totalQ) {
      // Q5: measure the wheel's height BEFORE anything below touches the
      // Next bubble's flexGrow — getBoundingClientRect() forces a layout
      // flush, so measuring afterward was capturing the wheel's ALREADY-
      // shrunk size (Next's flexGrow had already stolen its share) and
      // then pinning it there permanently, making it look tiny forever.
      let pinnedWheelHeight = 0;
      if (this._activeQ === 4) {
        pinnedWheelHeight = this._bubbles[4].getBoundingClientRect().height;
      }

      // Transform the next question's bubble into the Next button
      this._clearInlineNext();
      const b = this._bubbles[nextQ];
      b.classList.add('sb-next-inline');
      b.style.flexGrow = this._activeQ === 4 ? '0.55' : '0.9';
      b.innerHTML = '';
      this._reinjectSvg(b, nextQ);
      const span = document.createElement('span');
      span.className = 'sb-next-inline-label';
      span.textContent = label;
      b.appendChild(span);
      this._inlineNextBubble  = b;
      this._inlineNextIndex   = nextQ;
      this._inlineNextHandler = () => this._fireNext();
      b.addEventListener('click', this._inlineNextHandler);
      this._inlineNextEnterHandler = () => this._setCustomCursorState('click');
      this._inlineNextLeaveHandler = () => this._setCustomCursorState('normal');
      b.addEventListener('mouseenter', this._inlineNextEnterHandler);
      b.addEventListener('mouseleave', this._inlineNextLeaveHandler);

      if (this._activeQ === 4) {
        // Pin the semicircle to its pre-shrink pixel height so it never shifts
        const b4 = this._bubbles[4];
        if (pinnedWheelHeight > 0) {
          b4.style.transition = 'none';
          b4.style.flexGrow   = '0';
          b4.style.flexShrink = '0';
          b4.style.flexBasis  = pinnedWheelHeight + 'px';
          b4.getBoundingClientRect(); // force reflow
          b4.style.transition = '';
        }
        // shrink answered bubbles to give Next button more room
        this._bubbles.forEach((ob, oi) => {
          if (oi !== 4 && oi !== nextQ && ob.classList.contains('sb-answered')) {
            ob.style.flexGrow = '0.3';
          }
        });
      } else {
        // compress remaining unanswered bubbles to give next button more room
        this._bubbles.forEach((ob, oi) => {
          if (oi !== this._activeQ && oi !== nextQ && !ob.classList.contains('sb-answered')) {
            ob.style.flexGrow = '0.3';
          }
        });
      }
    } else {
      // Q6 (last question) — use the separate bottom bubble
      this._nextLabel.textContent = label;
      this._nextBubble.classList.remove('sb-next-disabled');
      this._nextBubble.classList.add('sb-next-enabled');
      this._nextBubble.style.flexGrow = '0';
      this._nextBubble.style.flexBasis = '140px';
      this._nextBubble.style.flexShrink = '0';
      this._nextBubble.style.opacity = '1';
    }
  }

  _disableNext() {
    this._nextEnabled = false;
    this._clearInlineNext();
    this._nextBubble.classList.remove('sb-next-enabled');
    this._nextBubble.classList.add('sb-next-disabled');
    this._nextBubble.style.flexGrow = '0';
    this._nextBubble.style.flexBasis = '0px';
    this._nextBubble.style.flexShrink = '0';
    this._nextBubble.style.opacity = '0';
    // restore all non-active bubbles to normal size
    this._applyFlex(this._activeQ);
  }

  // ─── Flex sizing ───────────────────────────────────────────────────────────

  _applyFlex(activeQ) {
    this._bubbles.forEach((b, i) => {
      b.style.flexShrink = '';
      b.style.flexBasis  = '';
      if (activeQ < 0) {
        b.style.flexGrow = '1';
      } else if (i === activeQ) {
        b.style.flexGrow = i === 4 ? '1.6' : (i === 1 ? '3.5' : '5');
      } else if (b.classList.contains('sb-answered')) {
        b.style.flexGrow = '0.5';
      } else {
        b.style.flexGrow = '0.5';
      }
    });
  }

  // ─── Width animation ───────────────────────────────────────────────────────

  show() {
    this._container.style.transition = 'none';
    this._container.style.width = '28px';
    this._container.style.display = 'flex';
  }

  hide() { this._container.style.display = 'none'; }

  initProgress(totalSteps) {
    this._progressStep  = 0;
    this._progressTotal = totalSteps;
    if (this._progressDot) this._progressDot.remove();
    const dot = document.createElement('div');
    dot.className = 'sb-progress-indicator';
    this._container.appendChild(dot);
    this._progressDot = dot;
  }

  advanceProgress() {
    if (!this._progressDot || this._progressStep >= this._progressTotal) return;
    this._progressStep++;
    const frac = this._progressStep / this._progressTotal;
    const ch   = this._container.getBoundingClientRect().height;
    const dotH = 36;
    const pad  = 12;
    this._progressDot.style.top = (pad + frac * (ch - dotH - pad * 2)) + 'px';
  }

  dismissProgress() {
    if (this._progressDot) this._progressDot.style.opacity = '0';
    this._container.style.transition = 'width 0.45s cubic-bezier(0.4, 0, 0.6, 1)';
    this._container.style.width = '0px';
    setTimeout(() => { this._container.style.display = 'none'; }, 480);
  }

  squeezeForArt(qIndex) {
    this._container.offsetHeight;
    this._container.style.transition = 'width 0.45s cubic-bezier(0.4, 0, 0.6, 1)';
    this._container.style.width = '28px';
    this._bubbles.forEach((b, i) => b.classList.toggle('sb-art-active', i === qIndex));
    this._nextBubble.style.display = 'none';
    this._container.classList.add('sb-art-squeezed');
    this._bubbles.forEach(b => {
      const wrap = b.querySelector('.sb-answered-wrap');
      if (wrap) wrap.style.opacity = '0';
    });
  }

  expandFromArt() {
    this._container.style.transition = 'width 0.55s cubic-bezier(0.2, 0, 0.1, 1)';
    this._container.style.width = 'calc(100vw / 12)';
    this._container.classList.remove('sb-art-squeezed');
    this._bubbles.forEach(b => {
      b.classList.remove('sb-art-active');
      const wrap = b.querySelector('.sb-answered-wrap');
      if (wrap) wrap.style.opacity = '1';
    });
    this._nextBubble.style.display = '';
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  expand(questionIndex) {
    this._activeQ = questionIndex;
    this._applyFlex(questionIndex);
    this._disableNext();
    this._container.classList.add('sb-has-active');

    const bubble = this._bubbles[questionIndex];
    // Clear any answered state so the bubble starts fresh
    bubble.classList.remove('sb-answered');
    bubble.innerHTML = '';
    this._reinjectSvg(bubble, questionIndex);
    const num = document.createElement('span');
    num.className = 'sb-bubble-num';
    num.textContent = questionIndex + 1;
    bubble.appendChild(num);
    bubble.classList.add('sb-active');

    const cfg = this.questionConfigs[questionIndex];
    if (bubble.classList.contains('sb-q5-bubble')) bubble.classList.add('sb-q5-active');
    if (cfg && cfg.onExpand) cfg.onExpand();

    // Set default title immediately so it's ready when the question text fades in
    if (this.titleEl && cfg && cfg.defaultTitle) {
      const t = cfg.defaultTitle;
      this.titleEl.innerHTML = `${t.prefix || ''}<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
    }

    this._setupCustomCursor();

    setTimeout(() => {
      if (this._activeQ !== questionIndex) return;
      if (!cfg) return;
      if (cfg.type === 'click-icons')   this._renderClickIcons(bubble, cfg, questionIndex);
      if (cfg.type === 'icons')         this._renderIcons(bubble, cfg, questionIndex);
      if (cfg.type === 'multi-select')  this._renderMultiSelect(bubble, cfg, questionIndex);
      if (cfg.type === 'slider')        this._renderSlider(bubble, cfg, questionIndex);
      if (cfg.type === 'wheel')         this._renderWheel(bubble, cfg, questionIndex);
    }, 200);
  }

  markAnswered(questionIndex, iconSrc, iconSrcs) {
    this._answers[questionIndex] = iconSrc;
    if (this._wheelCleanup) { this._wheelCleanup(); this._wheelCleanup = null; }
    const b = this._bubbles[questionIndex];
    b.style.flexGrow   = '';
    b.style.flexShrink = '';
    b.style.flexBasis  = '';
    b.classList.remove('sb-active', 'sb-multi-select', 'sb-q5-active');
    b.classList.add('sb-answered');
    b.style.clipPath = '';
    b.innerHTML = '';
    this._reinjectSvg(b, questionIndex);
    if (iconSrc) {
      const icons = (iconSrcs && iconSrcs.length > 1) ? iconSrcs : [iconSrc];
      const count = icons.length;
      const wrap = document.createElement('div');
      wrap.className = 'sb-answered-wrap';
      if (count > 1) {
        wrap.classList.add(`sb-answered-multi-${count}`);
        icons.forEach(src => {
          const img = document.createElement('img');
          img.src = src;
          img.className = 'sb-answered-icon sb-answered-icon-multi';
          img.draggable = false;
          wrap.appendChild(img);
        });
      } else {
        const img = document.createElement('img');
        img.src = iconSrc;
        img.className = 'sb-answered-icon';
        img.draggable = false;
        wrap.appendChild(img);
      }
      b.appendChild(wrap);

      // Double-stroke ring for all answered bubbles
      const ring = document.createElement('div');
      ring.className = 'sb-q1-ring sb-q1-ring-visible';
      b.appendChild(ring);

      const observer = new ResizeObserver(([entry]) => {
        const h = entry.contentRect.height;
        const vPad = Math.max(4, Math.min(18, h * 0.12));
        wrap.style.padding = `${vPad}px 8%`;
      });
      observer.observe(b);
    }
  }

  updateDots(currentQ) {
    this._bubbles.forEach((b, i) => {
      b.classList.toggle('sb-current', i === currentQ && this._activeQ !== i);
    });
  }

  // Called after the last question is answered — keeps sidebar visible while
  // icons fly to screen center (vacuum effect), then shrinks and pinks the bar.
  playExitAnimation(onComplete, onReady) {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;

    // Collect all answer icons currently shown in the sidebar
    const iconEls = [];
    this._bubbles.forEach(b => {
      b.querySelectorAll('.sb-answered-icon').forEach(img => iconEls.push(img));
    });

    if (!iconEls.length) { setTimeout(() => onComplete && onComplete(), 50); return; }

    // Snapshot positions before DOM changes
    const snapshots = iconEls.map(img => ({ el: img, rect: img.getBoundingClientRect() }));

    // Create fixed-position clones floating over each icon
    this._exitAnimClones = snapshots.map(({ el, rect }) => {
      const clone = el.cloneNode(true);
      Object.assign(clone.style, {
        position:      'fixed',
        left:          rect.left + 'px',
        top:           rect.top  + 'px',
        width:         rect.width  + 'px',
        height:        rect.height + 'px',
        margin:        '0',
        zIndex:        '9999',
        pointerEvents: 'none',
        transition:    'none',
        willChange:    'transform, opacity',
      });
      document.body.appendChild(clone);
      el.style.opacity = '0'; // hide original under the clone
      return clone;
    });

    const VIBRATE_MS = 1100; // how long the slow shake lasts
    const FLY_MS     = 420;  // fly from bubble to center, arriving still visible
    const ORBIT_MS   = 480;  // inward spiral swirl + shrink + fade once at center
    const SUCK_MS    = FLY_MS + ORBIT_MS; // combined — later phases key off this total

    // Phase 1 — slow vibration in place, amplitude builds over time
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._exitAnimClones.forEach((clone, i) => {
        // Each icon gets its own random-ish shake pattern so they don't move in unison
        const s = (i % 2 === 0 ? 1 : -1);
        clone.animate([
          { transform: 'translate(0px, 0px)',              offset: 0    },
          { transform: `translate(${s*1}px, 0px)`,        offset: 0.08 },
          { transform: 'translate(0px, 0px)',              offset: 0.16 },
          { transform: `translate(${s*-1.5}px, 1px)`,     offset: 0.25 },
          { transform: 'translate(0px, 0px)',              offset: 0.33 },
          { transform: `translate(${s*2}px, -1px)`,       offset: 0.42 },
          { transform: 'translate(0px, 0px)',              offset: 0.50 },
          { transform: `translate(${s*-2.5}px, 1.5px)`,  offset: 0.60 },
          { transform: 'translate(0px, 0px)',              offset: 0.68 },
          { transform: `translate(${s*3}px, -2px)`,       offset: 0.78 },
          { transform: 'translate(0px, 0px)',              offset: 0.86 },
          { transform: `translate(${s*-3.5}px, 2px)`,    offset: 0.94 },
          { transform: 'translate(0px, 0px)',              offset: 1    },
        ], {
          duration: VIBRATE_MS,
          easing:   'linear',
          fill:     'none',
        });
      });
    }));

    const PAUSE_MS = 450; // empty open bar pause before shrinking

    // Phase 2 — icons shoot to center (2a), then swirl inward in a shrinking
    // spiral orbit before fading out (2b), instead of just vanishing the
    // instant they arrive.
    const ORBIT_RADIUS = 26;  // px, spiral starts at this radius around center
    const ORBIT_STEPS  = 6;   // keyframe resolution for the spiral curve
    const ORBIT_TURNS  = 1;   // full revolutions during the swirl

    // Builds a keyframe array spiraling inward around (dx,dy) — radius,
    // scale and opacity all ease toward 0 by the final step so the icon
    // visibly swirls itself away rather than just shrinking in place.
    const buildOrbitKeyframes = (dx, dy, dir, startScale) => {
      const kfs = [];
      for (let s = 0; s <= ORBIT_STEPS; s++) {
        const t       = s / ORBIT_STEPS;
        const angle   = dir * t * 360 * ORBIT_TURNS * (Math.PI / 180);
        const radius  = ORBIT_RADIUS * (1 - t);
        const scale   = startScale * (1 - t);
        const opacity = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
        const x = dx + radius * Math.cos(angle);
        const y = dy + radius * Math.sin(angle);
        kfs.push({ transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity, offset: t });
      }
      return kfs;
    };

    // Dark blurred glow at the center — grows in as icons start arriving,
    // shrinks away once they've all finished swirling out.
    const glow = document.createElement('div');
    glow.className = 'sb-exit-glow';
    document.body.appendChild(glow);
    this._exitAnimGlow = glow;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      glow.classList.add('sb-exit-glow-visible');
    }));

    this._exitAnimTimer2 = setTimeout(() => {
      this._exitAnimClones.forEach((clone, i) => {
        const { rect } = snapshots[i];
        const dx  = cx - (rect.left + rect.width  / 2);
        const dy  = cy - (rect.top  + rect.height / 2);
        const dir = (i % 2 === 0 ? 1 : -1); // alternate spin direction per icon

        // 2a: fly from the bubble to the center, still fully visible on arrival.
        const flyAnim = clone.animate([
          { transform: 'translate(0,0) scale(1)',                           opacity: 1, offset: 0    },
          { transform: `translate(${dx*0.05}px,${dy*0.05}px) scale(1.15)`, opacity: 1, offset: 0.15 },
          { transform: `translate(${dx}px,${dy}px) scale(0.85)`,           opacity: 1, offset: 1    },
        ], {
          duration: FLY_MS,
          delay:    i * 22,
          easing:   'cubic-bezier(0.55, 0, 1, 1)',
          fill:     'forwards',
        });

        // 2b: once it lands, spiral inward around that same center point,
        // shrinking and fading, before it's fully gone.
        flyAnim.onfinish = () => {
          clone.animate(buildOrbitKeyframes(dx, dy, dir, 0.85), {
            duration: ORBIT_MS,
            easing:   'ease-in',
            fill:     'forwards',
          });
        };
      });
    }, VIBRATE_MS);

    // Glow shrinks away right as the last icon finishes swirling out.
    this._exitAnimTimerGlow = setTimeout(() => {
      glow.classList.remove('sb-exit-glow-visible');
    }, VIBRATE_MS + SUCK_MS);

    const SHRINK_MS  = 650;  // horizontal width squeeze duration
    const STRETCH_MS = 1000; // vertical stretch duration

    // Phase 3a — rings vanish instantly, container squeezes horizontally
    this._exitAnimTimer3 = setTimeout(() => {
      this._container.classList.add('sb-merging');
      // Clear inline transition override so CSS sb-exiting transition takes effect
      this._container.style.transition = '';
      this._bubbles.forEach(b => { b.style.transition = ''; });
      this._container.getBoundingClientRect(); // force reflow before animating
      this._container.style.width = '28px';
    }, VIBRATE_MS + SUCK_MS + PAUSE_MS);

    // Phase 3b — top bubble stretches to fill full height, others collapse away
    this._exitAnimTimer4 = setTimeout(() => {
      if (onReady) onReady();
      const EASE = 'cubic-bezier(0.4, 0, 0.6, 1)';
      const transition = `flex-grow ${STRETCH_MS}ms ${EASE}, flex-basis ${STRETCH_MS}ms ${EASE}, min-height ${STRETCH_MS}ms ${EASE}`;

      this._nextBubble.style.transition  = transition;
      this._nextBubble.style.flexGrow    = '0';
      this._nextBubble.style.flexBasis   = '0px';

      this._bubbles.forEach((b, i) => {
        b.style.transition = transition;
        b.style.minHeight  = '0';
        if (i === 0) {
          b.style.flexGrow  = '100';
          b.style.flexBasis = '0';
        } else {
          b.style.flexGrow    = '0';
          b.style.flexBasis   = '0px';
          b.style.borderWidth = '0';
        }
      });
    }, VIBRATE_MS + SUCK_MS + PAUSE_MS + SHRINK_MS);

    // Clean up after everything
    this._exitAnimTimer = setTimeout(() => {
      this._cleanupExitAnim();
      if (onComplete) onComplete();
    }, VIBRATE_MS + SUCK_MS + PAUSE_MS + SHRINK_MS + STRETCH_MS + 200);
  }

  _cleanupExitAnim() {
    clearTimeout(this._exitAnimTimer);
    clearTimeout(this._exitAnimTimer2);
    clearTimeout(this._exitAnimTimer3);
    clearTimeout(this._exitAnimTimer4);
    clearTimeout(this._exitAnimTimerGlow);
    this._exitAnimTimer     = null;
    this._exitAnimTimer2    = null;
    this._exitAnimTimer3    = null;
    this._exitAnimTimer4    = null;
    this._exitAnimTimerGlow = null;
    if (this._exitAnimClones) {
      this._exitAnimClones.forEach(el => el.remove());
      this._exitAnimClones = null;
    }
    if (this._exitAnimGlow) {
      this._exitAnimGlow.remove();
      this._exitAnimGlow = null;
    }
    // Restore originals' opacity in case animation was cancelled mid-flight
    this._bubbles.forEach(b => {
      b.style.transition = '';
      // borderColor intentionally kept — pill stays pink until reset()
    });
    this._container.classList.remove('sb-exiting');
    // sb-merging is intentionally kept — the single pink pill persists until reset()
  }

  reset() {
    this._cleanupExitAnim();
    this._container.classList.remove('sb-merging');
    this._container.style.display = 'none';
    this._container.style.width = '';
    this._container.style.transition = '';
    if (this._progressDot) { this._progressDot.remove(); this._progressDot = null; }
    this._progressStep  = 0;
    this._progressTotal = 0;
    this._cleanupSlider();
    if (this._wheelCleanup) { this._wheelCleanup(); this._wheelCleanup = null; }
    this._teardownCustomCursor();
    this._answers.fill(null);
    this._activeQ = -1;
    this._pendingSelection = null;
    this._bubbles.forEach((b, i) => {
      b.className = 'sb-bubble';
      if (i === 1) b.classList.add('sb-q2-bubble');
      if (i === 2) b.classList.add('sb-q3-bubble');
      if (i === 4) b.classList.add('sb-q5-bubble'); // no sb-q5-active on reset
      if (i === 5) b.classList.add('sb-q6-bubble');
      if (i === 0 || i === 3) b.classList.add('sb-bubble-diamond');
      b.innerHTML = '';
      this._reinjectSvg(b, i);
      b.style.clipPath    = '';
      b.style.flexGrow    = '';
      b.style.flexBasis   = '';
      b.style.minHeight   = '';
      b.style.borderWidth = '';
      b.style.borderColor = '';
      b.style.transition  = '';
    });
    this._disableNext();
  }

  // Resets just the currently-active bubble back to its plain numbered
  // placeholder, tearing down any type-specific interaction state (wheel,
  // slider, custom cursor) bound to it — same per-bubble cleanup as reset(),
  // but scoped to one bubble instead of wiping the whole sidebar. Used by
  // the Previous button so the question being left behind doesn't keep
  // whatever mid-interaction UI (chips, wheel rotation, etc.) it had.
  collapseActive() {
    if (this._activeQ < 0) return;
    const i = this._activeQ;
    this._cleanupSlider();
    if (this._wheelCleanup) { this._wheelCleanup(); this._wheelCleanup = null; }
    this._teardownCustomCursor();
    this._clearInlineNext();
    const b = this._bubbles[i];
    if (b) {
      b.className = 'sb-bubble';
      if (i === 1) b.classList.add('sb-q2-bubble');
      if (i === 2) b.classList.add('sb-q3-bubble');
      if (i === 4) b.classList.add('sb-q5-bubble');
      if (i === 5) b.classList.add('sb-q6-bubble');
      if (i === 0 || i === 3) b.classList.add('sb-bubble-diamond');
      b.innerHTML = '';
      this._reinjectSvg(b, i);
      const num = document.createElement('span');
      num.className = 'sb-bubble-num';
      num.textContent = i + 1;
      b.appendChild(num);
      b.style.clipPath    = '';
      b.style.flexBasis   = '';
      b.style.minHeight   = '';
      b.style.borderWidth = '';
      b.style.borderColor = '';
      b.style.transition  = '';
    }
    this._pendingSelection = null;
    this._activeQ = -1;
    // Re-run the authoritative sizing pass over every bubble, not just the
    // one we just collapsed — _enableNext()/_clearInlineNext() can leave
    // other bubbles (e.g. whichever one was hijacked into the inline
    // "Next" prompt) with stale flexGrow values of their own, which only
    // ever got corrected by the _applyFlex() call inside expand() on the
    // forward path. Previous never went through expand() for the bubble
    // being left, so nothing normalized the rest of the row.
    this._applyFlex(-1);
  }

  // ─── Custom cursor (Q1) ────────────────────────────────────────────────────

  _setupCustomCursor() {
    this._teardownCustomCursor();
    const el = document.createElement('div');
    el.className = 'sb-custom-cursor';
    el.style.opacity = '0';
    const img = document.createElement('img');
    img.src = 'normal.svg';
    img.draggable = false;
    el.appendChild(img);
    document.body.appendChild(el);
    this._customCursor    = el;
    this._customCursorImg = img;

    document.body.classList.add('sb-cursor-none');

    const navSelector = '.btn-next, .btn-prev, .globe-hitarea, .globe-container, #btn-home, .logo-btn, .sb-next';
    this._customCursorMoveFn = (e) => {
      el.style.left = e.clientX + 'px';
      el.style.top  = e.clientY + 'px';
      const overNav = e.target.closest(navSelector);
      el.style.opacity = overNav ? '0' : (el.classList.contains('sb-cursor-scroll') ? '0.5' : '1');
    };
    document.addEventListener('mousemove', this._customCursorMoveFn);
  }

  _setCustomCursorHoverTargets(slots) {
    slots.forEach(slot => {
      slot.addEventListener('mouseenter', () => {
        if (this._customCursor) {
          this._customCursorImg.src = 'hover.svg';
          this._customCursor.classList.add('sb-cursor-hover');
        }
      });
      slot.addEventListener('mouseleave', () => {
        if (this._customCursor) {
          this._customCursorImg.src = 'normal.svg';
          this._customCursor.classList.remove('sb-cursor-hover');
        }
      });
    });
  }

  _setCustomCursorState(state) {
    if (!this._customCursor) return;
    if (state === 'grab') {
      this._customCursorImg.src = 'grab.svg';
      this._customCursor.classList.remove('sb-cursor-hover', 'sb-cursor-scroll', 'sb-cursor-click');
      this._customCursor.classList.add('sb-cursor-grab');
    } else if (state === 'hover') {
      this._customCursorImg.src = 'hover.svg';
      this._customCursor.classList.remove('sb-cursor-grab', 'sb-cursor-scroll', 'sb-cursor-click');
      this._customCursor.classList.add('sb-cursor-hover');
    } else if (state === 'scroll') {
      this._customCursorImg.src = 'scroll.svg';
      this._customCursor.classList.remove('sb-cursor-hover', 'sb-cursor-grab', 'sb-cursor-click');
      this._customCursor.classList.add('sb-cursor-scroll');
    } else if (state === 'click') {
      this._customCursorImg.src = 'hover.svg';
      this._customCursor.classList.remove('sb-cursor-hover', 'sb-cursor-grab', 'sb-cursor-scroll');
      this._customCursor.classList.add('sb-cursor-click');
    } else {
      this._customCursorImg.src = 'normal.svg';
      this._customCursor.classList.remove('sb-cursor-hover', 'sb-cursor-grab', 'sb-cursor-scroll', 'sb-cursor-click');
    }
  }

  _teardownCustomCursor() {
    if (this._customCursor) {
      this._customCursor.remove();
      this._customCursor    = null;
      this._customCursorImg = null;
    }
    if (this._customCursorMoveFn) {
      document.removeEventListener('mousemove', this._customCursorMoveFn);
      this._customCursorMoveFn = null;
    }
    document.body.classList.remove('sb-cursor-none');
  }

  // ─── Click-icons renderer (Q1) — click to preview, Next to confirm ────────

  _renderClickIcons(bubble, cfg, qIndex) {
    bubble.innerHTML = '';
    this._reinjectSvg(bubble, qIndex);
    const list = document.createElement('div');
    list.className = 'sb-q1-list';
    const slots = [];

    // Selection ring — absolutely positioned inside the bubble
    const ring = document.createElement('div');
    ring.className = 'sb-q1-ring';
    bubble.appendChild(ring);

    let _ringPlaced = false;
    let _selectedSlotQ1 = null;

    const _moveRingToSlot = (slotEl) => {
      const bubbleRect = bubble.getBoundingClientRect();
      const slotRect   = slotEl.getBoundingClientRect();

      const slotCenterY = slotRect.top  + slotRect.height / 2 - bubbleRect.top;
      const slotCenterX = slotRect.left + slotRect.width  / 2 - bubbleRect.left;

      const gap = 6;
      const maxW = bubbleRect.width  - gap * 2;
      const maxH = slotRect.height   - gap * 2;
      const diameter = Math.min(maxH, maxW);
      const rw = Math.min(diameter, maxW);
      const rh = Math.min(diameter, maxH);

      if (!_ringPlaced) {
        // First click: snap into position with no transition, then fade in
        ring.style.transition = 'opacity 0.25s ease';
        ring.style.width  = rw + 'px';
        ring.style.height = rh + 'px';
        ring.style.left   = slotCenterX + 'px';
        ring.style.top    = slotCenterY + 'px';
        ring.style.transform = 'translate(-50%, -50%)';
        // Force a reflow so the position is committed before opacity transition starts
        ring.getBoundingClientRect();
        ring.classList.add('sb-q1-ring-visible');
        // Restore full transition after fade-in completes
        setTimeout(() => { ring.style.transition = ''; }, 300);
        _ringPlaced = true;
      } else {
        ring.style.width  = rw + 'px';
        ring.style.height = rh + 'px';
        ring.style.left   = slotCenterX + 'px';
        ring.style.top    = slotCenterY + 'px';
        ring.style.transform = 'translate(-50%, -50%)';
        ring.classList.add('sb-q1-ring-visible');
      }
    };

    const _q1RingResizeObs = new ResizeObserver(() => {
      if (_selectedSlotQ1) _moveRingToSlot(_selectedSlotQ1);
    });
    _q1RingResizeObs.observe(bubble);

    cfg.icons.forEach((item, i) => {
      const slot = document.createElement('div');
      slot.className = 'sb-q1-slot sb-q1-clickable';
      slots.push(slot);

      const img = document.createElement('img');
      img.src = item.icon;
      img.className = 'sb-q1-icon';
      img.draggable = false;
      slot.appendChild(img);

      slot.addEventListener('mouseenter', () => {
        if (cfg.onHover) cfg.onHover(i, this._pendingSelection ? this._pendingSelection.answerIndex : -1);
        if (this.titleEl && !this._pendingSelection) this.titleEl.textContent = item.text;
      });

      slot.addEventListener('mouseleave', () => {
        if (cfg.onHoverEnd) cfg.onHoverEnd(this._pendingSelection ? this._pendingSelection.answerIndex : -1);
        if (!this.titleEl) return;
        const sel = this._pendingSelection;
        if (sel && sel.qIndex === qIndex && cfg.titleConfigs && cfg.titleConfigs[sel.answerIndex]) {
          const t = cfg.titleConfigs[sel.answerIndex];
          this.titleEl.innerHTML = `${t.prefix || ''}<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
        } else if (cfg.defaultTitle) {
          const t = cfg.defaultTitle;
          this.titleEl.innerHTML = `${t.prefix || ''}<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
        }
      });

      slot.addEventListener('click', () => {
        _selectedSlotQ1 = slot;
        _moveRingToSlot(slot);

        if (cfg.onEnter) cfg.onEnter(this.illustrationImg, i, item);

        if (this.titleEl && cfg.titleConfigs && cfg.titleConfigs[i]) {
          const t = cfg.titleConfigs[i];
          this.titleEl.innerHTML = `<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
        }

        this._pendingSelection = { qIndex, answerIndex: i, iconSrc: item.icon };
        if (this.onSelect) this.onSelect(qIndex, i);
        this._enableNext(qIndex === this._totalQ - 1 ? 'Continue' : 'Next');
      });

      list.appendChild(slot);
    });

    bubble.appendChild(list);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      list.classList.add('sb-q1-list-show');
      this._setCustomCursorHoverTargets(slots);
    }));
  }

  // ─── Multi-select renderer (Q3) ───────────────────────────────────────────

  _renderMultiSelect(bubble, cfg, qIndex) {
    bubble.innerHTML = '';
    this._reinjectSvg(bubble, qIndex);
    bubble.classList.add('sb-multi-select');
    bubble.addEventListener('mouseenter', () => this._customCursor && this._customCursor.classList.add('sb-cursor-straight'));
    bubble.addEventListener('mouseleave', () => this._customCursor && this._customCursor.classList.remove('sb-cursor-straight'));
    const hint = document.createElement('div');
    hint.className = 'sb-multiselect-hint';
    hint.innerHTML = 'select<br>up to 3';
    hint.setAttribute('aria-hidden', 'true');
    bubble.appendChild(hint);

    const list = document.createElement('div');
    list.className = 'sb-chip-list';

    const selected = []; // ordered array of selected word indices
    const chips    = [];

    const buildTitle = () => {
      if (!this.titleEl) return;
      if (selected.length === 0) {
        const t = cfg.defaultTitle;
        this.titleEl.innerHTML = `${t.prefix || ''}<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
        return;
      }
      const labels = selected.map(i => cfg.words[i].label);
      let pink;
      if (labels.length === 1)      pink = labels[0];
      else if (labels.length === 2) pink = `${labels[0]} and ${labels[1]}`;
      else                          pink = `${labels[0]}, ${labels[1]} and ${labels[2]}`;
      const rest = labels.length === 1 ? ' will be your reaction' : ' will be your reactions';
      this.titleEl.innerHTML = `<span class="q1-pink-word">${pink}</span>${rest}`;
    };

    const rebadge = () => {
      chips.forEach((chip, ci) => {
        const si = selected.indexOf(ci);
        let badge = chip.querySelector('.sb-chip-badge');
        if (si !== -1) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'sb-chip-badge';
            chip.appendChild(badge);
          }
          badge.textContent = si + 1;
        } else {
          badge && badge.remove();
        }
      });
    };

    cfg.words.forEach((item, i) => {
      const chip = document.createElement('div');
      chip.className = 'sb-chip';
      chip.textContent = item.label;
      chips.push(chip);

      chip.addEventListener('mouseenter', () => { if (cfg.onWordHover) cfg.onWordHover(i); });
      chip.addEventListener('mouseleave', () => { if (cfg.onWordLeave) cfg.onWordLeave(); });

      chip.addEventListener('click', () => {
        const selIdx = selected.indexOf(i);
        if (selIdx !== -1) {
          selected.splice(selIdx, 1);
          chip.classList.remove('sb-chip-selected');
        } else {
          if (selected.length >= 3) return;
          selected.push(i);
          chip.classList.add('sb-chip-selected');
        }

        rebadge();
        buildTitle();

        // show hint after first selection and shift chips down
        hint.classList.toggle('sb-hint-visible', selected.length > 0);
        list.classList.toggle('sb-chip-list-selected', selected.length > 0);

        // dim unselected chips when limit reached
        const atLimit = selected.length >= 3;
        chips.forEach((c, ci) => {
          if (!c.classList.contains('sb-chip-selected')) {
            c.style.opacity = atLimit ? '0.3' : '';
            c.style.pointerEvents = atLimit ? 'none' : '';
          }
        });

        if (selected.length === 0) {
          if (cfg.onAllDeselected) cfg.onAllDeselected();
        } else {
          if (cfg.onWordClick) cfg.onWordClick(i, [...selected], chips);
        }

        if (selected.length > 0) {
          this._pendingSelection = {
            qIndex,
            answerIndex: selected[0],
            iconSrc: cfg.words[selected[0]].icon,
            iconSrcs: selected.map(i => cfg.words[i].icon),
            selectedIndices: [...selected],
          };
          this._enableNext('Next');
          if (this.onSelect) this.onSelect(qIndex, [...selected]);
        } else {
          if (cfg.onAllDeselected) cfg.onAllDeselected();
          this._pendingSelection = null;
          this._disableNext();
        }
      });

      list.appendChild(chip);
    });

    bubble.appendChild(list);
    this._q3Chips = chips;
    requestAnimationFrame(() => requestAnimationFrame(() => list.classList.add('sb-chip-list-show')));
  }

  // ─── Icons renderer (Q4, Q5) ──────────────────────────────────────────────

  _renderIcons(bubble, cfg, qIndex) {
    bubble.innerHTML = '';
    this._reinjectSvg(bubble, qIndex);
    bubble.classList.add('sb-icons-bubble');
    const list = document.createElement('div');
    list.className = 'sb-q1-list';

    // ring element — same as Q1
    const ring = document.createElement('div');
    ring.className = 'sb-q1-ring';
    bubble.appendChild(ring);
    let _ringPlaced = false;

    let _selectedSlot = null;

    const moveRing = (slotEl) => {
      const bubbleRect = bubble.getBoundingClientRect();
      const slotRect   = slotEl.getBoundingClientRect();
      const centerY = slotRect.top + slotRect.height / 2 - bubbleRect.top;
      ring.style.width     = '120px';
      ring.style.height    = '120px';
      ring.style.left      = '50%';
      ring.style.top       = centerY + 'px';
      ring.style.transform = 'translate(-50%, -50%)';
      ring.classList.add('sb-q1-ring-visible');
    };

    // Reposition ring whenever the bubble resizes (e.g. Next button shifting layout)
    const _ringResizeObs = new ResizeObserver(() => {
      if (_selectedSlot) moveRing(_selectedSlot);
    });
    _ringResizeObs.observe(bubble);

    const slots = [];
    let selectedIndex = -1;

    cfg.icons.forEach((item, i) => {
      const slot = document.createElement('div');
      slot.className = 'sb-q1-slot sb-q1-clickable';

      const img = document.createElement('img');
      img.src = item.icon;
      img.className = 'sb-q1-icon';
      img.draggable = false;
      slot.appendChild(img);

      slot.addEventListener('mouseenter', () => {
        this._setCustomCursorState('hover');
        if (cfg.onHover) cfg.onHover(i, selectedIndex);
      });
      slot.addEventListener('mouseleave', () => {
        this._setCustomCursorState('normal');
        if (cfg.onHoverEnd) cfg.onHoverEnd(selectedIndex);
      });

      slot.addEventListener('click', () => {
        selectedIndex = i;
        _selectedSlot = slot;
        if (!_ringPlaced) {
          ring.style.transition = 'opacity 0.3s ease';
          moveRing(slot);
          setTimeout(() => { ring.style.transition = ''; }, 300);
          _ringPlaced = true;
        } else {
          moveRing(slot);
        }

        if (cfg.onEnter) cfg.onEnter(this.illustrationImg, i, item);
        this._pendingSelection = { qIndex, answerIndex: i, iconSrc: item.icon };
        if (this.onSelect) this.onSelect(qIndex, i);
        this._enableNext(qIndex === this._totalQ - 1 ? 'Continue' : 'Next');
      });

      slots.push(slot);
      list.appendChild(slot);
    });

    bubble.appendChild(list);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      list.classList.add('sb-q1-list-show');
      this._setCustomCursorHoverTargets(slots);
    }));
  }

  // ─── Slider renderer (Q2, Q6) ─────────────────────────────────────────────

  _renderSlider(bubble, cfg, qIndex) {
    bubble.innerHTML = '';
    this._reinjectSvg(bubble, qIndex);
    const wrap = document.createElement('div');
    wrap.className = 'sb-q2-wrap';

    const line = document.createElement('div');
    line.className = 'sb-q2-line';
    wrap.appendChild(line);

    const dots = [];
    const dotFrames = cfg.dotFrames || cfg.stages.slice(1);
    for (let i = 0; i < dotFrames.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'sb-q2-dot';
      const pct = 12 + (dotFrames[i] / cfg.maxFrame) * 76;
      dot.style.setProperty('--dp', `${pct}%`);
      wrap.appendChild(dot);
      dots.push(dot);
    }
    this._sliderDots = dots;

    const knob = document.createElement('div');
    knob.className = 'sb-q2-knob';
    knob.style.setProperty('--ky', '0%');
    wrap.appendChild(knob);
    bubble.appendChild(wrap);

    const isClockKnob = (cfg.knobIcon || 'clock.svg') === 'clock.svg';
    const clockWrap = document.createElement('div');
    clockWrap.style.cssText = isClockKnob
      ? 'width:70%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;pointer-events:none;flex-shrink:0;'
      : 'position:absolute;width:180%;aspect-ratio:1;left:-90%;top:50%;transform:translateY(-50%);cursor:grab;';
    knob.appendChild(clockWrap);

    let clockBig = null, clockSmall = null, clockLong = null;
    const cx = 89.065, cy = 89.505;
    let clockAngle = 0, prevMoveY = null;

    const knobIcon = cfg.knobIcon || 'clock.svg';
    if (isClockKnob) {
      const sourceSvg = document.getElementById('clock-svg');
      if (sourceSvg) {
        const clone = sourceSvg.cloneNode(true);
        clone.removeAttribute('id');
        clone.style.width = '100%';
        clone.style.height = '100%';
        clockWrap.appendChild(clone);
        clockBig   = clone.querySelector('#big');
        clockSmall = clone.querySelector('#small');
        clockLong  = clone.querySelector('#long');
      }
    } else {
      const img = document.createElement('img');
      img.src = knobIcon;
      img.draggable = false;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;transform:rotate(90deg);';
      clockWrap.appendChild(img);
    }

    const { sliderRef, stages, maxFrame, answerIcon } = cfg;
    const stageFrames = cfg.stageFrames || null;
    let isDragging = false, startY = 0, startVisual = 0, visualFrame = 0;

    const applyClockRotation = () => {
      if (clockBig)   clockBig.setAttribute('transform',   `rotate(${clockAngle * 0.3}, ${cx}, ${cy})`);
      if (clockSmall) clockSmall.setAttribute('transform', `rotate(${clockAngle * 0.6}, ${cx}, ${cy})`);
      if (clockLong)  clockLong.setAttribute('transform',  `rotate(${clockAngle},       ${cx}, ${cy})`);
    };

    const nearestStageIdx = (vf) => {
      const nearest = stages.reduce((b, s) => Math.abs(s - vf) < Math.abs(b - vf) ? s : b);
      return stages.indexOf(nearest);
    };

    const animFrameFor = (si) => stageFrames ? stageFrames[si] : stages[si];

    const interpAnimFrame = (vf) => {
      if (!stageFrames) return vf;
      for (let i = 0; i < stages.length - 1; i++) {
        if (vf <= stages[i + 1]) {
          const t = stages[i + 1] === stages[i] ? 1 : (vf - stages[i]) / (stages[i + 1] - stages[i]);
          return stageFrames[i] + t * (stageFrames[i + 1] - stageFrames[i]);
        }
      }
      return stageFrames[stageFrames.length - 1];
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const rect    = wrap.getBoundingClientRect();
      const usableH = rect.height * 0.76;
      const dy      = e.clientY - startY;
      const vf      = Math.max(0, Math.min(maxFrame, startVisual + (dy / usableH) * maxFrame));
      visualFrame   = vf;

      if (prevMoveY !== null) {
        clockAngle += (e.clientY - prevMoveY) * 1.5;
        applyClockRotation();
      }
      prevMoveY = e.clientY;

      knob.style.setProperty('--ky', `${(vf / maxFrame) * 76}%`);

      if (sliderRef) {
        const near = nearestStageIdx(vf);
        sliderRef.setFrame(interpAnimFrame(vf));
        sliderRef.updateTitle(near);
        this._setSliderSelection(near, qIndex, answerIcon, sliderRef);
      }
    };

    const onUp = () => {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      this._sliderState = null;
      const isOverKnob = knob.matches(':hover');
      this._setCustomCursorState(isOverKnob ? 'hover' : 'normal');

      if (!sliderRef) return;
      const si      = nearestStageIdx(visualFrame);
      const snapped = stages[si];
      const animF   = animFrameFor(si);
      visualFrame   = snapped;

      this._setSliderSelection(si, qIndex, answerIcon, sliderRef);

      sliderRef.snapTo(animF, () => {
        knob.style.setProperty('--ky', `${(snapped / maxFrame) * 76}%`);
        sliderRef.updateTitle(si);
        if (this._sliderDots) {
          this._sliderDots.forEach((d, i) => d.classList.toggle('sb-q2-dot-active', si > 0 && i === si - 1));
        }
      });
    };

    knob.addEventListener('mouseenter', () => { if (!isDragging) this._setCustomCursorState('hover'); });
    knob.addEventListener('mouseleave', () => { if (!isDragging) this._setCustomCursorState('normal'); });

    const startDrag = (e) => {
      if (e.button !== 0) return;
      isDragging = true; startY = e.clientY; prevMoveY = null;
      startVisual = visualFrame;
      if (this._sliderDots) this._sliderDots.forEach(d => d.classList.remove('sb-q2-dot-active'));
      this._sliderState = { move: onMove, up: onUp };
      this._setCustomCursorState('grab');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
      e.preventDefault();
    };

    knob.addEventListener('mousedown', startDrag);
    if (!isClockKnob) clockWrap.addEventListener('mousedown', startDrag);
  }

  // Sets the pending selection + Next-button state for a slider stage index.
  // Kept in one place so the drag (onMove) and release (onUp) always agree and
  // the button is never left visually enabled while internally disabled.
  _setSliderSelection(stageIndex, qIndex, answerIcon, sliderRef) {
    const cfg = this.questionConfigs[qIndex];
    if (stageIndex > 0) {
      const cfg = this.questionConfigs[qIndex];
      const iconSrc = (cfg && cfg.answerIcons && cfg.answerIcons[stageIndex - 1]) || answerIcon || 'clock.svg';
      this._pendingSelection = {
        qIndex,
        answerIndex: stageIndex - 1,
        iconSrc,
        onCommit: () => sliderRef.selectAnswer(stageIndex - 1),
      };
      this._enableNext(qIndex === this._totalQ - 1 ? 'Continue' : 'Next');
      if (this.titleEl && cfg && cfg.titleConfigs && cfg.titleConfigs[stageIndex - 1]) {
        const t = cfg.titleConfigs[stageIndex - 1];
        this.titleEl.innerHTML = `${t.prefix || ''}<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
      }
    } else {
      this._pendingSelection = null;
      this._disableNext();
      if (this.titleEl && cfg && cfg.defaultTitle) {
        const t = cfg.defaultTitle;
        this.titleEl.innerHTML = `${t.prefix || ''}<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
      }
    }
  }

  _cleanupSlider() {
    if (this._sliderState) {
      document.removeEventListener('mousemove', this._sliderState.move);
      document.removeEventListener('mouseup',   this._sliderState.up);
      this._sliderState = null;
    }
  }

  _renderWheel(bubble, cfg, qIndex) {
    bubble.innerHTML = '';
    this._reinjectSvg(bubble, qIndex);
    const icons  = cfg.icons;
    const total  = icons.length;
    let current  = cfg._wheelIndex || 0;

    const wrap = document.createElement('div');
    wrap.className = 'sb-wheel-wrap';
    bubble.appendChild(wrap);

    // SVG overlay: divider lines + selection triangle
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    wrap.appendChild(svg);

    const drawOverlay = (W, H) => {
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = '';
      const color = '#ff77ff';
      const step    = 32;
      const f       = 0.90;
      const xOff    = W * 0.30;
      const iconPct = 0.38; // must mirror .sb-wheel-slot width
      const fy = H / 2;
      // Icons trace a circle: tx = (f*W*0.5 + xOff) - f*W*cos(angle). The focal point is
      // that circle's actual center — naturally just past the rim, not an arbitrary distance.
      const fx = W / 2 + f * W * 0.5 + xOff;

      // Center + radius of the icon slot at offset d — mirrors applyPositions() exactly,
      // so the divider math and the icon math never disagree about where icons actually sit.
      const slotGeom = (d) => {
        const angleRad = d * step * Math.PI / 180;
        const tx    = f * W * (0.5 - Math.cos(angleRad)) + xOff;
        const ty    = f * (H / 2) * Math.sin(angleRad);
        const scale = Math.max(0.3, Math.cos(angleRad * 0.7));
        return {
          cx: W / 2 + tx,
          cy: H / 2 + ty,
          r:  (W * iconPct / 2) * scale,
        };
      };

      // Boundary point between two adjacent slots: the midpoint of the two closest
      // edge points on their circles, so the divider clears both icons' actual bounds.
      const boundaryBetween = (dA, dB) => {
        const A = slotGeom(dA), B = slotGeom(dB);
        const vx = B.cx - A.cx, vy = B.cy - A.cy;
        const dist = Math.hypot(vx, vy) || 1;
        const ux = vx / dist, uy = vy / dist;
        const edgeAx = A.cx + ux * A.r, edgeAy = A.cy + uy * A.r;
        const edgeBx = B.cx - ux * B.r, edgeBy = B.cy - uy * B.r;
        return { x: (edgeAx + edgeBx) / 2, y: (edgeAy + edgeBy) / 2 };
      };

      // Only the boundaries between two actually-visible icons — the outermost
      // slots have no visible neighbor beyond them, so the rim alone separates them.
      const boundaries = [
        boundaryBetween(-2, -1),
        boundaryBetween(-1, 0),
        boundaryBetween(0, 1),
        boundaryBetween(1, 2),
      ];

      boundaries.forEach(pt => {
        // Ray from the off-screen focal point, through the boundary point, out to the rim
        const dx = pt.x - fx, dy = pt.y - fy;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const reach = dist + W + H; // guarantees the far end clears the visible rim
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', fx); line.setAttribute('y1', fy);
        line.setAttribute('x2', fx + ux * reach);
        line.setAttribute('y2', fy + uy * reach);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '0.75');
        svg.appendChild(line);
      });

      // Selection triangle at LEFT center pointing right
      const triW = 13, triH = 20;
      const tri = document.createElementNS(svgNS, 'polygon');
      tri.setAttribute('points', `0,${fy - triH / 2} ${triW},${fy} 0,${fy + triH / 2}`);
      tri.setAttribute('fill', color);
      svg.appendChild(tri);
    };

    // Create slots (one per icon)
    const slots = icons.map((item, i) => {
      const slot = document.createElement('div');
      slot.className = 'sb-wheel-slot';
      const img = document.createElement('img');
      img.src = item.icon;
      img.draggable = false;
      img.className = 'sb-wheel-icon';
      if (item.text === 'with loved ones') img.classList.add('sb-wheel-icon-loved');
      slot.appendChild(img);
      wrap.appendChild(slot);
      return slot;
    });

    const getD = (i, cIdx) => {
      let d = i - cIdx;
      if (d >  total / 2) d -= total;
      if (d < -total / 2) d += total;
      return d;
    };

    const applyPositions = (centerIdx, animate, prevCenterIdx = null) => {
      const rect  = bubble.getBoundingClientRect();
      const W     = rect.width  || 120;
      const H     = rect.height || 400;
      const step  = 32; // degrees between icons along the arc
      const f     = 0.90;
      const xOff  = W * 0.30; // rightward offset

      slots.forEach((slot, i) => {
        const d     = getD(i, centerIdx);
        const prevD = prevCenterIdx !== null ? getD(i, prevCenterIdx) : d;

        const wasHidden  = Math.abs(prevD) > 2;
        const nowVisible = Math.abs(d) <= 2;

        const angleDeg = d * step;
        const angleRad = angleDeg * Math.PI / 180;
        const tx       = f * W * (0.5 - Math.cos(angleRad)) + xOff;
        const ty       = f * (H / 2) * Math.sin(angleRad);
        const scale    = Math.max(0.3, Math.cos(angleRad * 0.7));
        const opacity  = Math.max(0,   Math.cos(angleRad * 0.6));
        const visible  = Math.abs(d) <= 2;

        const wasVisible = prevCenterIdx !== null ? Math.abs(prevD) <= 2 : visible;
        // A slot whose d jumped by more than 1 crossed the ±total/2 boundary mid-visible range
        const dJumped    = prevCenterIdx !== null && Math.abs(d - prevD) > 1;

        // Icons leaving visible range: snap hidden instantly — no slide-away animation
        if (!visible) {
          slot.style.transition    = 'none';
          slot.style.opacity       = '0';
          slot.style.pointerEvents = 'none';
          slot.style.transform     = `translateX(${tx}px) translateY(${ty}px) scale(0.3)`;
          slot.style.zIndex        = '0';
          return;
        }

        // Icons entering visible range OR jumping across the wheel: snap off to the right, animate in from right
        if (animate && (!wasVisible || dJumped)) {
          slot.style.transition    = 'none';
          slot.style.opacity       = '0';
          slot.style.transform     = `translateX(${W}px) translateY(${ty}px) scale(0.3)`;
          slot.style.pointerEvents = 'none';
          slot.style.zIndex        = '0';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            slot.style.transition    = 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease';
            slot.style.transform     = `translateX(${tx}px) translateY(${ty}px) scale(${Math.max(0.4, scale)})`;
            slot.style.opacity       = opacity.toFixed(2);
            slot.style.zIndex        = Math.round(scale * 10);
            slot.style.pointerEvents = 'auto';
          }));
          return;
        }

        // Normal visible → visible transition
        slot.style.transition    = animate ? 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease' : 'none';
        slot.style.transform     = `translateX(${tx}px) translateY(${ty}px) scale(${Math.max(0.4, scale)})`;
        slot.style.opacity       = opacity.toFixed(2);
        slot.style.zIndex        = Math.round(scale * 10);
        slot.style.pointerEvents = 'auto';
      });
    };

    const goTo = (idx, animate = true) => {
      const prevCurrent = current;
      current = ((idx % total) + total) % total;
      cfg._wheelIndex = current;
      applyPositions(current, animate, prevCurrent);

      if (cfg.onCentered) cfg.onCentered(current);
      this._pendingSelection = {
        qIndex,
        answerIndex: current,
        iconSrc:     icons[current].icon,
      };
      if (this.onSelect) this.onSelect(qIndex, current);
      this._enableNext(qIndex === this._totalQ - 1 ? 'Continue' : 'Next');
    };

    // Click a slot to bring it to center
    slots.forEach((slot, i) => {
      slot.addEventListener('click', () => goTo(i));
    });

    // Clean up any previous wheel listener before adding a new one
    if (this._wheelCleanup) { this._wheelCleanup(); this._wheelCleanup = null; }

    // Mouse wheel — closure lock, 30px threshold, 750ms cooldown (matches trackpad momentum)
    let wheelLocked = false;
    const onWheel = (e) => {
      e.preventDefault();
      if (wheelLocked) return;
      if (Math.abs(e.deltaY) < 30) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      wheelLocked = true;
      goTo(current + dir);
      setTimeout(() => { wheelLocked = false; }, 750);
    };
    bubble.addEventListener('wheel', onWheel, { passive: false });

    bubble.addEventListener('mouseenter', () => this._setCustomCursorState('scroll'));
    bubble.addEventListener('mouseleave', () => this._setCustomCursorState('normal'));

    // Expand bubble width to H/2.5 so the left arc is more circular (less elongated ellipse)
    // Also re-run applyPositions and overlay so icons/lines spread correctly as bubble grows
    const updateHalfCircleWidth = () => {
      const h = bubble.getBoundingClientRect().height;
      if (h > 0) bubble.style.width = (h / 2) + 'px';
      const rect = bubble.getBoundingClientRect();
      drawOverlay(rect.width || 120, rect.height || 400);
      applyPositions(current, false);
    };
    updateHalfCircleWidth();
    const sizeObserver = new ResizeObserver(updateHalfCircleWidth);
    sizeObserver.observe(bubble);

    this._wheelCleanup = () => {
      sizeObserver.disconnect();
      bubble.style.width = '';
      bubble.removeEventListener('wheel', onWheel);
    };

    // Initial position (no animation)
    applyPositions(current, false);
    // Trigger illustration for initial centered icon
    if (cfg.onCentered) cfg.onCentered(current);

    // Show chips after layout is ready
    requestAnimationFrame(() => applyPositions(current, false));
  }
}
