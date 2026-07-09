class Q3Interaction {
  constructor({ overlay, box, tray, illustrationImg, btnNext, onAnswer }) {
    this.overlay         = overlay;
    this.box             = box;
    this.tray            = tray;
    this.illustrationImg = illustrationImg;
    this.btnNext         = btnNext;
    this.onAnswer        = onAnswer;

    this.titleEl = document.getElementById('question-text');

    this.ANSWERS = [
      {
        name: 'Stress', svg: 'stress.svg',
        slotTop: '15vh', slotBottom: '0',    slotLeft: '12vw', slotRight: '12vw',
        imgFit: 'cover', imgPos: 'top center',
        hidden: 'translateY(110vh)',
      },
      {
        name: 'Fear', svg: 'fear.svg',
        slotTop: '15vh', slotBottom: '0',    slotLeft: '16vw', slotRight: '16vw',
        imgFit: 'cover', imgPos: 'top center',
        hidden: 'translateY(110vh)',
      },
      {
        name: 'Denial', svg: 'denial.svg',
        slotTop: '15vh', slotBottom: '-6vh', slotLeft: '0',    slotRight: '-6vw',
        imgFit: 'contain', imgPos: 'bottom right',
        hidden: 'translateX(110vw)',
      },
      {
        name: 'Relief', svg: 'relief.svg',
        slotTop: '15vh', slotBottom: '3vh',  slotLeft: '0',    slotRight: '3vw',
        imgFit: 'contain', imgPos: 'bottom left',
        hidden: 'translateX(-110vw)',
      },
      {
        name: 'Shock', svg: 'shock.svg',
        slotTop: '15vh', slotBottom: '0',    slotLeft: '10vw', slotRight: '10vw',
        imgFit: 'contain', imgPos: 'bottom center',
        hidden: 'translateY(110vh)',
      },
    ];

    this.TITLES = [
      { pink: 'What',   rest: ' is your immediate reaction?'      },
      { pink: 'Stress', rest: ' will be your immediate reaction?' },
      { pink: 'Fear',   rest: ' will be your immediate reaction?' },
      { pink: 'Denial', rest: ' will be your immediate reaction?' },
      { pink: 'Relief', rest: ' will be your immediate reaction?' },
      { pink: 'Shock',  rest: ' will be your immediate reaction?' },
    ];

    this._currentIndex  = -1;
    this._selectedIndex = null;
    this._els           = [];
    this._circleEls     = [];
    this._hintEl        = null;
  }

  _render() {
    this.box.innerHTML  = '';
    this.tray.innerHTML = '';

    this._els = this.ANSWERS.map((ans) => {
      const wrap = document.createElement('div');
      wrap.className = 'q3-slot';
      Object.assign(wrap.style, {
        position: 'absolute',
        top:      ans.slotTop,
        bottom:   ans.slotBottom,
        left:     ans.slotLeft,
        right:    ans.slotRight,
        transform: ans.hidden,
      });

      const img = document.createElement('img');
      img.src       = ans.svg;
      img.className = 'q3-illustration';
      img.draggable = false;
      Object.assign(img.style, {
        objectFit:      ans.imgFit,
        objectPosition: ans.imgPos,
      });

      wrap.appendChild(img);
      this.box.appendChild(wrap);
      return wrap;
    });

    this._hintEl             = document.createElement('div');
    this._hintEl.className   = 'q3-hint';
    this._hintEl.textContent = 'Select one to reveal';
    this.box.appendChild(this._hintEl);

    this._circleEls = this.ANSWERS.map((ans, i) => {
      const btn = document.createElement('button');
      btn.className = 'q3-circle-btn';
      btn.type      = 'button';

      const circle = document.createElement('div');
      circle.className = 'q3-circle';

      const label = document.createElement('span');
      label.className   = 'q3-circle-label';
      label.textContent = ans.name;

      btn.appendChild(label);
      btn.appendChild(circle);
      btn.addEventListener('click', () => this._commitTo(i));
      this.tray.appendChild(btn);
      return btn;
    });
  }

  _updateTitle(index) {
    if (!this.titleEl) return;
    const cfg = index === -1 ? this.TITLES[0] : this.TITLES[index + 1];
    this.titleEl.innerHTML = `<span class="q1-pink-word">${cfg.pink}</span>${cfg.rest}`;
  }

  _applyTransforms(index, animate) {
    const dur = '0.4s cubic-bezier(0.4,0,0.2,1)';
    this._els.forEach((el, i) => {
      el.style.transition = animate ? `transform ${dur}` : 'none';
      el.style.transform  = i === index ? 'translate(0,0)' : this.ANSWERS[i].hidden;
    });
    if (this._hintEl) {
      this._hintEl.style.transition = animate ? 'opacity 0.25s' : 'none';
      this._hintEl.style.opacity    = index === -1 ? '1' : '0';
    }
  }

  _updateCircles(index) {
    this._circleEls.forEach((btn, i) => {
      btn.classList.toggle('q3-circle-active', i === index);
    });
  }

  _commitTo(index) {
    this._applyTransforms(index, true);
    this._currentIndex = index;
    this._updateTitle(index);
    this._updateCircles(index);

    if (index === -1) {
      this._selectedIndex = null;
      this.btnNext.classList.add('btn-next-disabled');
    } else {
      this._selectedIndex = index;
      this.btnNext.classList.remove('btn-next-disabled');
      if (this.onAnswer) this.onAnswer(index);
    }
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
    this._applyTransforms(idx, false);
    this._updateTitle(idx);
    this._updateCircles(idx);

    this.btnNext.classList.toggle('btn-next-disabled', idx === -1);
    this.btnNext.textContent = 'Yes';
  }

  hide() {
    this.overlay.style.display = 'none';
    this.btnNext.textContent   = 'Next';
    this.btnNext.classList.remove('btn-next-disabled');
    if (this.illustrationImg) this.illustrationImg.style.display = '';
  }

  reset() {
    this._currentIndex  = -1;
    this._selectedIndex = null;
    this._render();
    this._applyTransforms(-1, false);
    this._updateTitle(-1);
    this._updateCircles(-1);
  }
}
