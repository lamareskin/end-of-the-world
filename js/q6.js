class Q6Interaction {
  constructor({ overlay, animationContainer, btnNext, onAnswer }) {
    this.overlay            = overlay;
    this.animationContainer = animationContainer;
    this.btnNext            = btnNext;
    this.onAnswer           = onAnswer;

    this.titleEl         = document.getElementById('question-text');
    this._anim           = null;
    this._currentFrame   = 0;
    this._selectedStage  = null;
    this._isDragging     = false;
    this._dragStartX     = 0;
    this._dragStartFrame = 0;

    // Frame 0 = no answer, 15/30/45/60 = stages 1-4
    this.STAGES = [0, 15, 30, 45, 60];
    this.LABELS = [
      null,
      'no',
      'no opinion',
      'yes',
      'definitely',
    ];
    this.TITLE_SENTENCES = [
      null,
      { prefix: '', pink: 'No', rest: '' },
      { prefix: 'I don\'t have an ', pink: 'opinion', rest: '' },
      { prefix: '', pink: 'Yes', rest: '' },
      { prefix: '', pink: 'Definitely', rest: '' },
    ];
    this.DEFAULT_TITLE = { prefix: 'Do you think the world will be ', pink: 'a simulation', rest: '?' };

    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp   = this._handleMouseUp.bind(this);
  }

  _initAnim() {
    if (this._anim) return;
    this._anim = lottie.loadAnimation({
      container:     this.animationContainer,
      renderer:      'svg',
      loop:          false,
      autoplay:      false,
      animationData: SIMULATION_DATA,
    });
    this._anim.goToAndStop(0, true);
  }

  _updateTitle(stageIndex) {
    if (!this.titleEl) return;
    const t = (!stageIndex || stageIndex === 0) ? this.DEFAULT_TITLE : this.TITLE_SENTENCES[stageIndex];
    this.titleEl.innerHTML = `${t.prefix}<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
  }

  _nearestStage(frame) {
    return this.STAGES.reduce((best, s) =>
      Math.abs(s - frame) < Math.abs(best - frame) ? s : best
    );
  }

  _setFrame(frame) {
    this._currentFrame = Math.max(0, Math.min(60, frame));
    this._anim.goToAndStop(this._currentFrame, true);
  }

  _snapTo(targetFrame, cb) {
    const start    = this._currentFrame;
    const delta    = targetFrame - start;
    if (Math.abs(delta) < 0.5) { this._setFrame(targetFrame); if (cb) cb(); return; }
    const duration  = 300;
    const startTime = performance.now();
    const animate   = (now) => {
      const t     = Math.min((now - startTime) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup',   this._onMouseUp);
  }

  _handleMouseMove(e) {
    if (!this._isDragging) return;
    const dragWidth = window.innerWidth * 0.75;
    const dx        = e.clientX - this._dragStartX;
    const newFrame  = this._dragStartFrame + (dx / dragWidth) * 60;
    this._setFrame(newFrame);

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
        if (this.onAnswer) this.onAnswer(stageIndex - 1);
      }
    });
  }

  show() {
    this._initAnim();
    this.overlay.style.display = 'flex';

    const frame = this._selectedStage !== null ? this.STAGES[this._selectedStage] : 0;
    this._setFrame(frame);
    this._updateTitle(this._selectedStage !== null ? this._selectedStage : 0);

    if (!this._selectedStage) {
      this.btnNext.classList.add('btn-next-disabled');
    } else {
      this.btnNext.classList.remove('btn-next-disabled');
    }

    this.btnNext.textContent = 'Continue';
    document.getElementById('screen-question').classList.add('q6-active');
    this.overlay.addEventListener('mousedown', this._onMouseDown);
  }

  hide() {
    this.overlay.style.display = 'none';
    this.btnNext.textContent   = 'Next';
    const sq = document.getElementById('screen-question');
    sq.classList.remove('q6-active');
    sq.classList.remove('q6-sidebar');
    this.btnNext.classList.remove('btn-next-disabled');
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

  showSidebarMode() {
    this._initAnim();
    this.overlay.style.display = 'flex';
    const sq = document.getElementById('screen-question');
    sq.classList.add('q6-active');
    sq.classList.add('q6-sidebar');
    const frame = this._selectedStage !== null ? this.STAGES[this._selectedStage] : 0;
    this._setFrame(frame);
    this._updateTitle(this._selectedStage !== null ? this._selectedStage : 0);
  }
}
