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

    targets.forEach(({ el, name }) => {
      domtoimage.toPng(el, {
        width:  window.innerWidth,
        height: window.innerHeight,
        style:  { transform: 'none', borderRadius: '0' },
      }).then(dataUrl => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${name}.png`;
        a.click();
      }).catch(err => console.error('Save failed:', err));
    });
  }

  _populateComicFrame() {
    const snapshot = this.comicReveal.comicSceneSnapshot;
    if (!snapshot || this.comicFrameEl.children.length) return;

    snapshot.style.transform = 'scale(1)';
    snapshot.style.transition = 'none';
    this.comicFrameEl.appendChild(snapshot);

    this._stackShareEmotions();
    this._injectOverlays();
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
      const bubbleWidth = r.width * 0.44;
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

    const q1Idx = State.getAnswer(0);
    const q1El  = f.querySelector('#comic-panel-q1');
    if (q1Idx !== null && q1El) {
      const r = q1El.getBoundingClientRect();
      const tag = makeTag(QUESTIONS[0].answers[q1Idx].text);
      if (q1Idx === 0) {
        const comicPv = 24;
        const ph      = window.innerWidth * 0.02;
        const row     = (window.innerHeight - 2 * comicPv) / 12;
        const sgTop   = comicPv + 1.2 * row;
        f.appendChild(tag);
        tag.style.left = (ph + PAD) + 'px';
        tag.style.top  = (sgTop + PAD) + 'px';
      } else {
        place(tag, r.left + PAD, r.top + PAD);
      }
    }

    const q3Raw  = State.getAnswer(2);
    const q3List = Array.isArray(q3Raw) ? q3Raw : (q3Raw !== null ? [q3Raw] : []);
    const fboxEl = f.querySelector('.comic-footbox');
    const q3Tags = q3List
      .map(idx => QUESTIONS[2].answers[idx])
      .filter(Boolean)
      .map(ans => makeTag(ans.text));
    if (q3Tags.length && fboxEl) {
      const r = fboxEl.getBoundingClientRect();
      const GAP = 10;
      q3Tags.forEach(tag => place(tag, 0, 0));
      requestAnimationFrame(() => {
        const heights = q3Tags.map(t => t.offsetHeight);
        const totalHeight = heights.reduce((a, b) => a + b, 0) + GAP * (q3Tags.length - 1);
        let top = r.top + r.height / 2 - totalHeight / 2;
        q3Tags.forEach((tag, i) => {
          tag.style.top  = top + 'px';
          tag.style.left = (r.left - tag.offsetWidth * 0.9) + 'px';
          top += heights[i] + GAP;
        });
      });
    }

    const q4Idx = State.getAnswer(3);
    const boxEl = f.querySelector('#comic-panel-box-q4');
    if (q4Idx !== null && boxEl) {
      const r = boxEl.getBoundingClientRect();
      place(makeTag(QUESTIONS[3].answers[q4Idx].text), r.left + PAD, r.top + PAD);
    }

    const q5Idx = State.getAnswer(4);
    const q5El  = f.querySelector('#comic-panel-q5');
    if (q5Idx !== null && q5El) {
      const r = q5El.getBoundingClientRect();
      const tag = makeTag(QUESTIONS[4].answers[q5Idx].text);
      place(tag, r.left + PAD, 0);
      requestAnimationFrame(() => {
        tag.style.top = (r.bottom - PAD - tag.offsetHeight) + 'px';
      });
    }
  }
}
