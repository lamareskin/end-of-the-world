class Q5Interaction {
  constructor({ overlay, box, tray, hintEl, illustrationImg, btnNext, onAnswer }) {
    this.overlay         = overlay;
    this.box             = box;
    this.tray            = tray;
    this.hintEl          = hintEl;
    this.illustrationImg = illustrationImg;
    this.btnNext         = btnNext;
    this.onAnswer        = onAnswer;

    this.titleEl = document.getElementById('question-text');

    this.ICONS = [
      window.ICON_DOOM,
      window.ICON_NATURE,
      window.ICON_RECKLESS,
      window.ICON_LOVED,
      window.ICON_SHOW,
    ];

    this.ANSWERS = [
      {
        name: 'Doomscrolling', type: 'lottie', dataVar: 'DOOM_DATA',
        slotTop: '15vh', slotBottom: '3vh', slotLeft: '3vw', slotRight: '3vw',
      },
      {
        name: 'with Nature', type: 'lottie', dataVar: 'NATURE_DATA',
        slotTop: '-5vh', slotBottom: '-5vh', slotLeft: '-5vw', slotRight: '-5vw',
      },
      {
        name: 'with loved ones', type: 'lottie', dataVar: 'LOVED_DATA',
        slotTop: '-5vh', slotBottom: '-5vh', slotLeft: '-5vw', slotRight: '-5vw',
      },
      {
        name: 'doing something Reckless', type: 'video', src: 'reckless.mp4',
        slotTop: '15vh', slotBottom: '0', slotLeft: '3vw', slotRight: '3vw',
      },
      {
        name: 'preparing for the show', type: 'lottie', dataVar: 'SHOW_DATA',
        slotTop: '15vh', slotBottom: '3vh', slotLeft: '3vw', slotRight: '3vw',
      },
    ];

    this.TITLES = [
      { prefix: '',                              pink: 'How',                        rest: ' will you spend your final day?' },
      { prefix: 'You will spend your final day ', pink: 'doomscrolling',             rest: '?' },
      { prefix: 'You will spend your final day ', pink: 'with Nature',               rest: '?' },
      { prefix: 'You will spend your final day ', pink: 'with loved ones',           rest: '?' },
      { prefix: 'You will spend your final day ', pink: 'doing something Reckless',  rest: '?' },
      { prefix: 'You will spend your final day ', pink: 'preparing for the show',    rest: '?' },
    ];

    this._currentIndex  = -1;
    this._selectedIndex = null;
    this._els           = [];
    this._circleEls     = [];
    this._animCache     = {};
  }

  _render() {
    Object.values(this._animCache).forEach(a => a && a.destroy && a.destroy());
    this._animCache  = {};
    this.box.innerHTML  = '';
    this.tray.innerHTML = '';

    this._els = this.ANSWERS.map((ans, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'q5-slot';
      Object.assign(wrap.style, {
        position:  'absolute',
        top:       ans.slotTop,
        bottom:    ans.slotBottom,
        left:      ans.slotLeft,
        right:     ans.slotRight,
        transform: 'translateX(110vw)',
      });

      if (ans.type === 'video') {
        const video         = document.createElement('video');
        video.src           = ans.src;
        video.loop          = true;
        video.muted         = true;
        video.playsInline   = true;
        video.className     = 'q5-media';
        wrap.appendChild(video);
      } else {
        const container     = document.createElement('div');
        container.className = 'q5-anim-container';
        wrap.appendChild(container);

        const anim = lottie.loadAnimation({
          container,
          renderer:      'svg',
          loop:          true,
          autoplay:      false,
          animationData: window[ans.dataVar],
        });
        this._animCache[i] = anim;
      }

      this.box.appendChild(wrap);
      return wrap;
    });

    this._circleEls = this.ANSWERS.map((ans, i) => {
      const btn     = document.createElement('button');
      btn.className = 'q5-icon-btn';
      btn.type      = 'button';

      const label       = document.createElement('span');
      label.className   = 'q3-circle-label';
      label.textContent = ans.name;

      const iconWrap       = document.createElement('div');
      iconWrap.className   = 'q5-icon-wrap';
      iconWrap.innerHTML   = this.ICONS[i] || '';

      btn.appendChild(label);
      btn.appendChild(iconWrap);
      btn.addEventListener('click', () => this._commitTo(i));
      this.tray.appendChild(btn);
      return btn;
    });
  }

  _updateTitle(index) {
    if (!this.titleEl) return;
    const cfg = index === -1 ? this.TITLES[0] : this.TITLES[index + 1];
    this.titleEl.innerHTML =
      `${cfg.prefix}<span class="q1-pink-word">${cfg.pink}</span>${cfg.rest}`;
  }

  _updateCircles(index) {
    this._circleEls.forEach((btn, i) =>
      btn.classList.toggle('q5-icon-active', i === index)
    );
  }

  _playAnim(i) {
    if (this.ANSWERS[i].type === 'video') {
      const v = this._els[i].querySelector('video');
      if (v) v.play();
    } else {
      const a = this._animCache[i];
      if (a) a.play();
    }
  }

  _stopAnim(i) {
    if (this.ANSWERS[i].type === 'video') {
      const v = this._els[i].querySelector('video');
      if (v) { v.pause(); v.currentTime = 0; }
    } else {
      const a = this._animCache[i];
      if (a) a.stop();
    }
  }

  _commitTo(index) {
    const prev = this._currentIndex;
    const dur  = '0.4s cubic-bezier(0.4,0,0.2,1)';

    if (prev !== -1 && prev !== index) {
      this._els[prev].style.transition = `transform ${dur}`;
      this._els[prev].style.transform  = 'translateX(-110vw)';
      this._stopAnim(prev);
      setTimeout(() => {
        if (this._els[prev]) {
          this._els[prev].style.transition = 'none';
          this._els[prev].style.transform  = 'translateX(110vw)';
        }
      }, 410);
    }

    this._els[index].style.transition = `transform ${dur}`;
    this._els[index].style.transform  = 'translateX(0)';
    this._playAnim(index);

    if (this.hintEl) this.hintEl.style.opacity = '0';

    this._currentIndex  = index;
    this._selectedIndex = index;
    this._updateTitle(index);
    this._updateCircles(index);
    this.btnNext.classList.remove('btn-next-disabled');
    if (this.onAnswer) this.onAnswer(index);
  }

  show() {
    this._render();
    this.overlay.style.display = 'block';

    if (this.illustrationImg) {
      this.illustrationImg.src           = '';
      this.illustrationImg.style.display = 'none';
    }

    const idx          = this._selectedIndex !== null ? this._selectedIndex : -1;
    this._currentIndex = idx;

    if (idx !== -1) {
      this._els[idx].style.transition = 'none';
      this._els[idx].style.transform  = 'translateX(0)';
      this._playAnim(idx);
      if (this.hintEl) this.hintEl.style.opacity = '0';
      this.btnNext.classList.remove('btn-next-disabled');
    } else {
      if (this.hintEl) this.hintEl.style.opacity = '1';
      this.btnNext.classList.add('btn-next-disabled');
    }

    this._updateTitle(idx);
    this._updateCircles(idx);
    this.btnNext.textContent = 'Yes';
  }

  hide() {
    Object.values(this._animCache).forEach(a => a && a.stop && a.stop());
    this._els.forEach((el, i) => {
      if (this.ANSWERS[i].type === 'video') {
        const v = el.querySelector('video');
        if (v) v.pause();
      }
    });
    this.overlay.style.display = 'none';
    this.btnNext.textContent   = 'Next';
    this.btnNext.classList.remove('btn-next-disabled');
    if (this.illustrationImg) this.illustrationImg.style.display = '';
  }

  reset() {
    Object.values(this._animCache).forEach(a => a && a.destroy && a.destroy());
    this._animCache     = {};
    this._currentIndex  = -1;
    this._selectedIndex = null;
    this._render();
    this._updateTitle(-1);
    this._updateCircles(-1);
    if (this.hintEl) this.hintEl.style.opacity = '1';
  }
}
