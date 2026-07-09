class Q2Interaction {
  constructor({ overlay, animationContainer, illustrationImg, btnNext, onAnswer }) {
    this.overlay            = overlay;
    this.animationContainer = animationContainer;
    this.illustrationImg    = illustrationImg;
    this.btnNext            = btnNext;
    this.onAnswer           = onAnswer;

    this.titleEl       = document.getElementById('question-text');
    this._cursorEl     = document.getElementById('q2-custom-cursor');
    this._clockAngle   = 0;
    this._clockPrevX   = null;
    this._clockBig     = null;
    this._clockSmall   = null;
    this._clockLong    = null;
    this._clockLoaded  = true;

    // SVG is inlined in HTML — just grab the groups directly
    this._clockBig   = document.querySelector('#big');
    this._clockSmall = document.querySelector('#small');
    this._clockLong  = document.querySelector('#long');

    this._onCursorMove = (e) => {
      this._cursorEl.style.left = e.clientX + 'px';
      this._cursorEl.style.top  = e.clientY + 'px';
    };
    this._anim         = null;
    this._currentFrame = 0;
    this._selectedStage = null;
    this._isDragging   = false;
    this._dragStartX   = 0;
    this._dragStartFrame = 0;
    this._snapTimer    = null;

    this.STAGES = [0, 30, 60, 90, 120];
    this.TITLES = [
      { prefix: '',           pink: 'When',                      rest: ' will the world end?' },
      { prefix: '',           pink: 'In 5 years',                rest: ' the world will end?' },
      { prefix: '',           pink: 'In 20 years',               rest: ' the world will end?' },
      { prefix: '',           pink: 'In 60 years',               rest: ' the world will end?' },
      { prefix: 'The world will end ', pink: "when I'm too old to care",  rest: ''             },
    ];

    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp   = this._handleMouseUp.bind(this);
  }

  _initClock() {
    if (this._clockLoaded) return;
    this._clockLoaded = true;
    fetch('clock.svg')
      .then(r => r.text())
      .then(svg => {
        this._cursorEl.innerHTML = svg.replace(/<\?xml[^?]*\?>/i, '');
        const svgEl = this._cursorEl.querySelector('svg');
        console.log('[clock] SVG element found:', svgEl);
        if (svgEl) {
          svgEl.setAttribute('width', '90');
          svgEl.setAttribute('height', '90');
          svgEl.style.display = 'block';
        }
        this._clockBig   = this._cursorEl.querySelector('#big');
        this._clockSmall = this._cursorEl.querySelector('#small');
        this._clockLong  = this._cursorEl.querySelector('#long');
        console.log('[clock] groups — big:', this._clockBig, 'small:', this._clockSmall, 'long:', this._clockLong);
      });
  }

  _applyClockRotation() {
    const cx = 89.065, cy = 89.505;
    if (this._clockSmall) this._clockSmall.setAttribute('transform', `rotate(${this._clockAngle * 0.3}, ${cx}, ${cy})`);
    if (this._clockBig)   this._clockBig.setAttribute('transform',   `rotate(${this._clockAngle * 0.6}, ${cx}, ${cy})`);
    if (this._clockLong)  this._clockLong.setAttribute('transform',  `rotate(${this._clockAngle}, ${cx}, ${cy})`);
  }

  _initAnim() {
    if (this._anim) return;
    this._anim = lottie.loadAnimation({
      container:     this.animationContainer,
      renderer:      'svg',
      loop:          false,
      autoplay:      false,
      animationData: EYEANIMATION_DATA,
    });
    this._anim.goToAndStop(0, true);
  }

  _updateTitle(stageIndex) {
    if (!this.titleEl) return;
    const t = this.TITLES[stageIndex];
    this.titleEl.innerHTML =
      `${t.prefix}<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
  }

  _nearestStage(frame) {
    return this.STAGES.reduce((best, s) =>
      Math.abs(s - frame) < Math.abs(best - frame) ? s : best
    );
  }

  _setFrame(frame) {
    this._currentFrame = Math.max(0, Math.min(120, frame));
    this._anim.goToAndStop(this._currentFrame, true);
    const sat = 1 - (Math.max(0, this._currentFrame - 30) / 90) * 0.25;
    this.animationContainer.style.filter = `saturate(${sat})`;
  }

  _snapTo(targetFrame, cb) {
    const start     = this._currentFrame;
    const delta     = targetFrame - start;
    if (Math.abs(delta) < 0.5) {
      this._setFrame(targetFrame);
      if (cb) cb();
      return;
    }
    const duration  = 300;
    const startTime = performance.now();
    const animate   = (now) => {
      const t      = Math.min((now - startTime) / duration, 1);
      const eased  = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this._setFrame(start + delta * eased);
      if (t < 1) requestAnimationFrame(animate);
      else if (cb) cb();
    };
    requestAnimationFrame(animate);
  }

  _handleMouseDown(e) {
    if (e.button !== 0) return;
    this._isDragging     = true;
    this._dragStartX     = e.clientX;
    this._dragStartFrame = this._currentFrame;
    this._dragPrevX      = undefined;
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup',   this._onMouseUp);
  }

  _handleMouseMove(e) {
    if (!this._isDragging) return;
    const dragWidth = window.innerWidth * 0.75;
    const dx        = e.clientX - this._dragStartX;
    const newFrame  = this._dragStartFrame + (dx / dragWidth) * 120;
    this._setFrame(newFrame);

    if (this._dragPrevX !== undefined) {
      this._clockAngle += (e.clientX - this._dragPrevX) * 0.8;
      this._applyClockRotation();
    }
    this._dragPrevX = e.clientX;

    // Live title update while dragging
    const nearStageIdx = this.STAGES.indexOf(this._nearestStage(this._currentFrame));
    this._updateTitle(nearStageIdx);
  }

  _handleMouseUp() {
    if (!this._isDragging) return;
    this._isDragging = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);

    const snapped    = this._nearestStage(this._currentFrame);
    const stageIndex = this.STAGES.indexOf(snapped);

    this._snapTo(snapped, () => {
      this._updateTitle(stageIndex);
      this._selectedStage = stageIndex;

      if (stageIndex === 0) {
        this.btnNext.classList.add('btn-next-disabled');
      } else {
        this.btnNext.classList.remove('btn-next-disabled');
        if (this.onAnswer) this.onAnswer(stageIndex - 1); // 0-based answer index
      }
    });
  }

  show() {
    this._initAnim();
    this.overlay.style.display = 'flex';
    document.getElementById('screen-question').classList.add('q2-active');
    this._clockPrevX = null;
    this._cursorEl.style.display = 'block';
    document.addEventListener('mousemove', this._onCursorMove);

    const frame = this._selectedStage !== null ? this.STAGES[this._selectedStage] : 0;
    this._setFrame(frame);
    this._updateTitle(this._selectedStage !== null ? this._selectedStage : 0);

    if (this._selectedStage === null || this._selectedStage === 0) {
      this.btnNext.classList.add('btn-next-disabled');
    } else {
      this.btnNext.classList.remove('btn-next-disabled');
    }

    this.btnNext.textContent = 'Yes';
    if (this.illustrationImg) {
      this.illustrationImg.src          = '';
      this.illustrationImg.style.display = 'none';
    }
    this.overlay.addEventListener('mousedown', this._onMouseDown);
  }

  hide() {
    const sq = document.getElementById('screen-question');
    sq.classList.remove('q2-active');
    sq.classList.remove('q2-sidebar');
    this._cursorEl.style.display = 'none';
    this._clockPrevX = null;
    document.removeEventListener('mousemove', this._onCursorMove);
    this.overlay.style.display  = 'none';
    this.btnNext.textContent    = 'Next';
    this.btnNext.classList.remove('btn-next-disabled');
    if (this.illustrationImg) this.illustrationImg.style.display = '';
    this.overlay.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
  }

  reset() {
    this._selectedStage  = null;
    this._currentFrame   = 0;
    this._isDragging     = false;
    if (this._anim) this._anim.goToAndStop(0, true);
    this._updateTitle(0);
  }

  // Public wrappers for SidebarInteraction
  getCurrentFrame() { return this._currentFrame; }
  setFrame(frame)   { this._initAnim(); this._setFrame(frame); }
  updateTitle(si)   { this._updateTitle(si); }
  snapTo(frame, cb) { this._initAnim(); this._snapTo(frame, cb); }
  selectAnswer(answerIndex) {
    this._selectedStage = answerIndex + 1;
    if (this.onAnswer) this.onAnswer(answerIndex);
  }

  // Show only the lottie overlay — no cursor, no drag (sidebar drives it)
  showSidebarMode() {
    this._initAnim();
    this.overlay.style.display = 'flex';
    const sq = document.getElementById('screen-question');
    sq.classList.add('q2-active');
    sq.classList.add('q2-sidebar');
    const frame = this._selectedStage !== null ? this.STAGES[this._selectedStage] : 0;
    this._setFrame(frame);
    this._updateTitle(this._selectedStage !== null ? this._selectedStage : 0);
    if (this.illustrationImg) {
      this.illustrationImg.src          = '';
      this.illustrationImg.style.display = 'none';
    }
  }
}
