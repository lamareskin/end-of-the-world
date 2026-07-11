class ShareViewer {
  constructor({ comicReveal }) {
    this.comicReveal  = comicReveal;
    this.screenEl     = document.getElementById('screen-comic-reveal');
    this.comicFrameEl = document.getElementById('share-comic-frame');
    this.navEl        = document.getElementById('share-nav');
    this.btnShare     = document.getElementById('btn-share');
    this._open        = false;
    this._selected    = new Set(); // 0 = result, 1 = comic

    this.navEl.addEventListener('click', e => {
      const dot = e.target.closest('.share-dot');
      if (!dot) return;
      const idx = +dot.dataset.idx;
      const cls = idx === 0 ? 'share-result' : 'share-answers';
      if (this._selected.has(idx)) {
        this._selected.delete(idx);
        dot.classList.remove('selected');
        document.body.classList.remove(cls);
      } else {
        this._selected.add(idx);
        dot.classList.add('selected');
        document.body.classList.add(cls);
      }
      this.btnShare.disabled = this._selected.size === 0;
      this._updateSaveLabel();
    });

    this.btnShare.addEventListener('click', () => {
      if (this._open) {
        this._save();
      } else {
        this.open();
      }
    });

    // Close when clicking the dark background (outside both cards)
    document.addEventListener('click', e => {
      if (!this._open) return;
      if (e.target.closest('#btn-share, #btn-restart, #share-nav')) return;
      // Both cards are scaled 0.47 from top-center; result occupies 0–47vh,
      // comic occupies 48–95vh. Close only if click is clearly outside both.
      const bw = window.innerWidth, bh = window.innerHeight;
      const scale = 0.47;
      const cardW = bw * scale;
      const mx = (bw - cardW) / 2;
      const inX = e.clientX >= mx && e.clientX <= bw - mx;
      const inResult = inX && e.clientY >= 0 && e.clientY <= bh * scale;
      const inComic  = inX && e.clientY >= bh * 0.48 && e.clientY <= bh * 0.95;
      if (!inResult && !inComic) this.close();
    });
  }

  open() {
    if (this._open) return;
    this._open = true;
    this._selected.clear();

    this._populateComicFrame();

    // Camera-shutter flash
    const flash = document.createElement('div');
    flash.className = 'share-flash';
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flash.classList.add('share-flash--fade');
        flash.addEventListener('transitionend', () => flash.remove(), { once: true });
      });
    });

    document.body.classList.add('share-mode');
    this.screenEl.classList.add('share-active');
    this.btnShare.textContent = 'Save';
    this.btnShare.disabled = true;

    this._onResize = () => {
      if (!this._open) return;
      this._clearOverlays();
      this._injectOverlays();
    };
    window.addEventListener('resize', this._onResize);
  }

  close() {
    if (!this._open) return;
    this._open = false;
    this._selected.clear();
    document.body.classList.remove('share-mode', 'share-result', 'share-answers');
    this.screenEl.classList.remove('share-active');
    this.navEl.querySelectorAll('.share-dot').forEach(d => d.classList.remove('selected'));
    this.btnShare.textContent = 'Share';
    this.btnShare.disabled = false;
    this.comicFrameEl.innerHTML = '';
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
  }

  _updateSaveLabel() {
    const hasResult  = this._selected.has(0);
    const hasAnswers = this._selected.has(1);
    if (hasResult && hasAnswers) this.btnShare.textContent = 'Save both';
    else if (hasResult)          this.btnShare.textContent = 'Save results';
    else if (hasAnswers)         this.btnShare.textContent = 'Save answers';
    else                         this.btnShare.textContent = 'Save';
  }

  _clearOverlays() {
    this.comicFrameEl
      .querySelectorAll('.share-keyword-tag, .share-speech-bubble, .share-caption-bar')
      .forEach(el => el.remove());
  }

  _save() {
    if (!this._selected.size) return;

    const targets = [];
    if (this._selected.has(0)) targets.push({ el: this.screenEl,     name: 'pagmar-result' });
    if (this._selected.has(1)) targets.push({ el: this.comicFrameEl, name: 'pagmar-comic'  });

    // Strip body share-state classes during capture so CSS transforms don't interfere,
    // then restore them. Capture sequentially so DOM state is stable per capture.
    const stateClasses = ['share-result', 'share-answers'];
    const active = stateClasses.filter(c => document.body.classList.contains(c));

    const captureNext = (i) => {
      if (i >= targets.length) {
        // Restore state classes
        active.forEach(c => document.body.classList.add(c));
        return;
      }
      const { el, name } = targets[i];
      // Remove state classes so elements sit in their neutral share-mode positions
      active.forEach(c => document.body.classList.remove(c));

      // Wait one frame for layout to settle after class removal
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const isResultScreen = el === this.screenEl;
        domtoimage.toPng(el, {
          width:  window.innerWidth,
          height: window.innerHeight,
          style:  { transform: 'none', borderRadius: '0' },
          imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=',
          filter: isResultScreen ? (node) => {
            if (!node.classList) return true;
            // Skip comic panel images — they sit behind the result overlay and cause errors
            return !node.classList.contains('comic-panel') &&
                   !node.classList.contains('comic-panel-box') &&
                   !node.classList.contains('comic-bubble') &&
                   !node.classList.contains('comic-bubble-shapes');
          } : undefined,
        }).then(dataUrl => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `${name}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          captureNext(i + 1);
        }).catch(err => {
          console.error('Save failed:', err);
          captureNext(i + 1);
        });
      }));
    };

    captureNext(0);
  }

  _populateComicFrame() {
    const snapshot = this.comicReveal.comicSceneSnapshot;
    if (!snapshot) return;
    // Always rebuild from scratch — a previous session's leftover children
    // (badge, overlays, an old snapshot) used to make this bail out early
    // via a children.length check, silently skipping the actual snapshot
    // append while _injectOverlays() still ran independently off the
    // resize listener — the "overlays show, comic art doesn't" bug.
    this.comicFrameEl.innerHTML = '';

    snapshot.style.transform = 'scale(1)';
    snapshot.style.transition = 'none';
    this.comicFrameEl.appendChild(snapshot);

    this._addBrandBadge();
    this._stackShareEmotions();
    this._injectOverlays();
  }

  // Same logo + "The day the world ends" watermark as the result card's
  // static one in index.html, but built here since #share-comic-frame gets
  // wiped (innerHTML = '') on close() and rebuilt fresh each time it opens.
  _addBrandBadge() {
    const badge = document.createElement('div');
    badge.className = 'share-brand-badge share-brand-badge-answers';
    // Paths inlined (not <img src> / CSS mask) so the stroke can be colored
    // directly via currentColor — see .share-brand-logo svg path in styles.css.
    badge.innerHTML = `
      <div class="share-brand-logo">
        <svg viewBox="0 0 68.6 69" xmlns="http://www.w3.org/2000/svg">
          <path d="M67.85,31.02c0,9.61-1.37,21.67-11.11,28.7-9.75,7.03-17.03,8.53-25.7,8.53C12.76,68.25.75,50.84.75,32.56.75,22.38,6.3,14.96,13.52,9.24,19.26,4.7,25.7.75,33.79.75c18.28,0,34.06,11.99,34.06,30.27Z"/>
          <path d="M11.5,59.7c4.07,3.72,8.05,6.65,14.43,8.03,3.51.76,9.24.89,8.37-.19-.69-.85-1.37-3.52-1.87-4.49-1.06-2.06-2.12-4.11-3.18-6.17-.38-.73-.75-1.62-.33-2.32.24-.41.69-.63,1.04-.95.96-.86,1.1-2.41.55-3.58-.55-1.17-1.66-2-2.85-2.51-1.23-.53-2.59-.78-3.94-.7-.58.03-1.17.13-1.69.38-2.47,1.2-2.46,5.23-4.97,6.34-.86.38-1.87.32-2.75.68-1.14.47-1.9,1.61-2.2,2.8-.31,1.19-.62,2.68-.62,2.68Z"/>
          <path d="M59.65,11.05c1.93,1.8.75,3.77.15,6.05-.47,1.78-.39,3.7.23,5.43.86,2.4,2.72,4.47,2.97,7.01.13,1.31-.2,2.66.04,3.96.11.57.25,3.17.1,3.8-.47,2.03-.62,4.14-.46,6.21.12,1.46.66,3.2,2.09,3.51.24.05.67-.05.71.2s-.34,1.09-.63,1.66c-.77,1.54-1.72,2.96-2.04,2.17s-1.01-1.5-1.86-1.59c-.86-.09-1.65.43-2.35.94-.53.39-1.06.8-1.42,1.34-.38.58-.54,1.28-.9,1.87-3.04,5.08-5.93-2.34-7.28-4.18-.96-1.31-2.28-2.3-3.58-3.26-1.14-.85-2.33-1.72-3.73-1.98-.79-.15-1.6-.09-2.39-.24-1.26-.23-2.69-1.25-3.69-2.92s-1.22-8.29,3.1-8.29c.73-.11,1.48-.08,2.2-.23s1.46-.56,1.73-1.24c.14-.35.15-.74.1-1.11-.34-2.83-2.51-3.37-4.97-3.57-1.37-.11-2.59-.18-3.85-.77-1.74-.82-3.3-1.96-4.85-3.08-.9-.65-1.88-1.43-2-2.54-.12-1.05.58-2,1.04-2.96,1.41-2.93.8-6.39,1.81-9.45.31-.94.43-2.13,1.14-2.85,1.09-1.09,3.02-1.25,4.46-1.27,2.15-.02,5.87,1.55,7.92,1.68s4.86-1.8,6.5-1.2c3.3,1.22,8.18,5.49,9.67,6.88Z"/>
          <path d="M9.54,15.13c.58.56.91,1.32,1.15,2.09.66,2.06.97,4.47,2.7,5.78.98.75,2.26.98,3.33,1.59s1.97,1.94,1.41,3.04c-.15.29-.37.52-.58.77-1.14,1.39-1.54,3.39-.95,5.09.46,1.32,1.46,2.48,1.56,3.87.09,1.3-.66,2.56-1.71,3.35s-2.33,1.17-3.62,1.41c-1.08.2-2.17.31-3.27.33-.55,0-1.13,0-1.64.22-1.04.44-1.47,1.65-1.91,2.69s-1.22,2.18-2.35,2.15c-.25,0-.5-1.52-.57-1.71-1.57-4.85-2.08-9.67-2.09-14.77,0-3.29,1.13-9.26,4.32-13.24.89-1.11,1.46-2.61,2.83-2.99,0,0,.79-.23,1.37.33Z"/>
        </svg>
      </div>
      <span class="share-brand-text">The day<br>the world ends</span>
    `;
    this.comicFrameEl.appendChild(badge);
  }

  _injectOverlays() {
    this._addShareBubble();

    const q2Idx = State.getAnswer(1);
    if (q2Idx !== null && q2Idx !== undefined) {
      const ansText = QUESTIONS[1].answers[q2Idx].text;
      const caption = q2Idx === 3
        ? "some random day when I'm too old to care..."
        : `some random day ${ansText.toLowerCase()}...`;

      const bar = document.createElement('div');
      bar.className = 'share-caption-bar';
      bar.textContent = caption;
      this.comicFrameEl.appendChild(bar);
    }

    this._addShareKeywords();
  }

  _stackShareEmotions() {
    const q3Raw  = State.getAnswer(2);
    const q3List = Array.isArray(q3Raw) ? q3Raw : (q3Raw !== null ? [q3Raw] : []);
    if (!q3List.length) return;

    const charEl = this.comicFrameEl.querySelector('#comic-character');
    if (!charEl) return;

    const { Q3_LEGS, Q3_FACE } = this.comicReveal;
    q3List.forEach(idx => {
      [Q3_LEGS[idx], Q3_FACE[idx]].forEach(id => {
        if (!id) return;
        const el = charEl.querySelector('#' + id);
        if (el) el.style.display = '';
      });
    });
  }

  _addShareBubble() {
    const f     = this.comicFrameEl;
    const boxEl = f.querySelector('#comic-panel-box-q4');
    if (!boxEl) return;

    const wrap = document.createElement('div');
    wrap.className = 'share-speech-bubble';

    const img = document.createElement('img');
    img.src = 'speechbubble-25.svg';
    img.className = 'share-speech-bubble-img';

    const text = document.createElement('p');
    text.className = 'share-speech-bubble-text';
    text.innerHTML = 'The world will end, and<br>the time for repentance<br>has passed';

    wrap.appendChild(img);
    wrap.appendChild(text);
    f.appendChild(wrap);

    // Measure after layout so getBoundingClientRect is reliable
    requestAnimationFrame(() => {
      const r           = boxEl.getBoundingClientRect();
      const bubbleWidth = r.width * 0.37;
      const bubbleLeft  = r.left - bubbleWidth * 0.35;
      const bubbleTop   = r.top  + r.height * 0.08;
      wrap.style.left  = bubbleLeft + 'px';
      wrap.style.top   = bubbleTop  + 'px';
      wrap.style.width = bubbleWidth + 'px';
    });
  }

  _addShareKeywords() {
    const f = this.comicFrameEl;
    const PAD = 14;

    const makeTag = (text) => {
      const el = document.createElement('div');
      el.className = 'share-keyword-tag';
      el.textContent = text;
      return el;
    };

    const place = (el, left, top) => {
      el.style.left = left + 'px';
      el.style.top  = top  + 'px';
      f.appendChild(el);
    };

    const makeLabel = (text) => {
      const el = document.createElement('div');
      el.className = 'share-keyword-tag share-keyword-tag--label';
      el.textContent = text;
      return el;
    };

    // Force a full layout flush so all getBoundingClientRect calls below
    // return correctly-computed positions (panels have CSS transforms that
    // only resolve after the browser has processed the cloned scene's styles).
    void f.offsetHeight;

    // Compute sgTop directly from viewport dims — more reliable than
    // getBoundingClientRect on Q1/Q5 whose tops use the same formula.
    const comicPv = 24;
    const ph      = window.innerWidth * 0.02;
    const row     = (window.innerHeight - 2 * comicPv) / 12;
    const sgTop   = comicPv + 1.2 * row;

    // Q1 — answer tag inside panel, label sits above the panel border.
    const q1Idx = State.getAnswer(0);
    if (q1Idx !== null) {
      const label = makeLabel('The one to blame:');
      const tag   = makeTag(QUESTIONS[0].answers[q1Idx].text);
      f.appendChild(label);
      f.appendChild(tag);
      void f.offsetHeight;
      tag.style.left   = (ph + PAD) + 'px';
      tag.style.top    = (sgTop - tag.offsetHeight) + 'px';
      label.style.left = (ph + PAD) + 'px';
      label.style.top  = (sgTop - tag.offsetHeight - label.offsetHeight) + 'px';
    }

    // Q3 — stacked to the left of the footbox, vertically centred on it.
    const q3Raw  = State.getAnswer(2);
    const q3List = Array.isArray(q3Raw) ? q3Raw : (q3Raw !== null ? [q3Raw] : []);
    const fboxEl = f.querySelector('.comic-footbox');
    const q3Tags = q3List
      .map(idx => QUESTIONS[2].answers[idx])
      .filter(Boolean)
      .map(ans => makeTag(ans.text));
    if (q3Tags.length && fboxEl) {
      const r   = fboxEl.getBoundingClientRect();
      const GAP = 10;
      // Append first so offsetHeight/Width are available
      q3Tags.forEach(tag => { tag.style.left = '0'; tag.style.top = '0'; f.appendChild(tag); });
      void f.offsetHeight; // flush so offsetHeight/Width are correct
      const heights     = q3Tags.map(t => t.offsetHeight);
      const totalHeight = heights.reduce((a, b) => a + b, 0) + GAP * (q3Tags.length - 1);
      let top = r.top + r.height / 2 - totalHeight / 2;
      q3Tags.forEach((tag, i) => {
        tag.style.top  = top + 'px';
        tag.style.left = (r.left - tag.offsetWidth * 0.9) + 'px';
        top += heights[i] + GAP;
      });
    }

    // Q4 — answer tag inside the pink box, label stacked directly above it.
    const q4Idx = State.getAnswer(3);
    const boxEl = f.querySelector('#comic-panel-box-q4');
    if (q4Idx !== null && boxEl) {
      const r     = boxEl.getBoundingClientRect();
      const label = makeLabel('The messenger:');
      const tag   = makeTag(QUESTIONS[3].answers[q4Idx].text);
      f.appendChild(label);
      f.appendChild(tag);
      void f.offsetHeight;
      const answerTop = r.top + PAD;
      tag.style.left   = (r.left + PAD) + 'px';
      tag.style.top    = answerTop + 'px';
      label.style.left = (r.left + PAD) + 'px';
      label.style.top  = (answerTop - label.offsetHeight) + 'px';
    }

    // Q5 — bottom-left corner, label stacked directly above the answer tag.
    // Use getBoundingClientRect (after flush) for the panel's true bottom edge
    // since the panel's top is set by JS inline style which may not transfer to clone.
    const q5Idx = State.getAnswer(4);
    const q5El  = f.querySelector('#comic-panel-q5');
    if (q5Idx !== null && q5El) {
      const label = makeLabel('The last Goodbye:');
      const tag   = makeTag(QUESTIONS[4].answers[q5Idx].text);
      f.appendChild(label);
      f.appendChild(tag);
      void f.offsetHeight;
      const r        = q5El.getBoundingClientRect();
      const answerTop = r.bottom - PAD - tag.offsetHeight;
      tag.style.left   = (ph + PAD) + 'px';
      tag.style.top    = answerTop + 'px';
      label.style.left = (ph + PAD) + 'px';
      label.style.top  = (answerTop - label.offsetHeight) + 'px';
    }
  }
}
