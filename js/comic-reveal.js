class ComicRevealInteraction {
  constructor({ screen, sceneEl, titleEl, titleBoxEl, inboxCaptionEl, characterEl, floatingCharEl, panelQ1, panelQ4, panelQ5, boxQ4, footboxEl, continueEl, introHintEl, idleHintEl, bubbleEl, bubbleTextEl, bubbleCharEl, bubbleCharTextEl, shapeQ4El, shapeCharEl, bgOverlayEl, globeEl, globeResultArtEl, resultCharEl, resultArtEl, resultDescEl, toResultsEl, onComplete }) {
    this.screen      = screen;
    this.sceneEl     = sceneEl;
    this.titleEl     = titleEl;
    this.titleBoxEl     = titleBoxEl;
    this.inboxCaptionEl = inboxCaptionEl;
    this.characterEl = characterEl;
    this.floatingCharEl = floatingCharEl; // separate floatingperson.svg, exit-only pose
    this.panelQ1     = panelQ1;
    this.panelQ4     = panelQ4;
    this.panelQ5     = panelQ5;
    this.boxQ4       = boxQ4;
    this.footboxEl   = footboxEl;
    this.continueEl  = continueEl;
    this.introHintEl = introHintEl;
    this.idleHintEl  = idleHintEl;
    this.bubbleEl     = bubbleEl;
    this.bubbleTextEl = bubbleTextEl;
    this.bubbleCharEl     = bubbleCharEl;
    this.bubbleCharTextEl = bubbleCharTextEl;
    this.shapeQ4El   = shapeQ4El;
    this.shapeCharEl = shapeCharEl;
    this.bgOverlayEl       = bgOverlayEl;
    this.globeEl           = globeEl;
    this.globeResultArtEl  = globeResultArtEl;  // img inside globe (center display)
    this.resultCharEl      = resultCharEl;       // char art, top-left
    this.resultArtEl       = resultArtEl;        // result art, bottom-right final position
    this.resultDescEl      = resultDescEl;       // description paragraph
    this.toResultsEl       = toResultsEl;        // "to the results" button
    this.onComplete  = onComplete;

    this._exitSequenceActive = false;
    this._exitResultsStarted = false;
    this._resultKey          = null;
    this._exitTimeouts       = [];

    // Stages: -1 = pre-scroll intro hint -> 0 = character alone + title box ->
    // 1 = Q4 portrait enters near center, "X will tell you:" caption ->
    // 2 = Q4 speech bubble "the world will end" (still centered) ->
    // 3 = bubble changes to "it will be caused by X" (STILL centered) ->
    // 4 = characters shift RIGHT to their resting spot AND the Q1 image
    //     appears at top-left simultaneously, title recenters, caption clears ->
    // 5 = beat -> 6 = zoom in + main character's bubble "that sounds X" +
    // legs/face swap -> 7 = zoom back out (bubble hides) -> 8 = his bubble
    // reappears "I will spend my last day X" -> 9 = Q5 image appears ->
    // 10 = temporary "continue" trigger
    this.STAGE_COUNT = 10;
    this.stage        = -1;
    this._svgLoaded   = false;
    this._svgEl       = null;
    this._wheelLocked = false;
    // How long with no scroll input before the "keep scrolling ↓" idle hint
    // fades in (only while -1 < stage < STAGE_COUNT — the intro already has
    // its own persistent reminder, and the final stage already has
    // .comic-continue for that job).
    this.IDLE_MS      = 4000;
    this._idleTimer    = null;

    // How long after the Q3 zoom-in (stage 8) before his legs/face actually
    // swap to the reaction pose — was happening instantly alongside the zoom,
    // which read as too abrupt; this lets the zoom settle first. _legsRevealed
    // tracks whether that swap has already fired for the current "reached
    // stage 8" session, so scrolling forward more (9, 10...) doesn't re-delay
    // it, and scrolling back below 8 resets it for next time.
    this.LEGS_REVEAL_DELAY_MS = 0;
    this._legsRevealTimer = null;
    this._legsRevealed    = false;

    // Q3 is multi-select (up to 3 emotions, in pick order). On the zoomed-in
    // beat (stage 6) they are revealed one scroll at a time — each forward
    // scroll shows the next emotion (bubble text REPLACED, not stacked: "that
    // sounds stressful", then "and scary", ...) and swaps the legs/face to it;
    // scrolling back steps them off again. Only once all chosen emotions are
    // shown does a further scroll advance to stage 7. _q3Revealed = how many
    // are currently shown (>=1 while on stage 6 with an answer).
    this._q3Revealed = 0;
    // Whether the zoom-in transition (see .comic-scene.zoomed) has finished
    // settling since last entering stage 6 — see the render()'s zoom block.
    this._zoomSettled = false;
    this._zoomSettleTimer = null;

    // Groups inside comic.svg this controller manages — 'upperbody' and 'person'
    // are intentionally excluded, they stay visible always. The floating-exit
    // pose used to be a group here ('floatingperson') but is now its own
    // separate floatingperson.svg file (see floatingCharEl / _runExitSequence),
    // swapped in as a whole element instead of toggled inside this SVG.
    this.MANAGED_GROUPS = [
      'stresslegs', 'relieflegs', 'deniallegs', 'fearlegs', 'normallegs', 'shocklegs',
      'stressface', 'fearface', 'reliefface', 'shockface', 'normal_face',
    ];
    // Default face+legs shown whenever no Q3 reaction pose is active.
    this.DEFAULT_GROUPS = ['normallegs', 'normal_face'];

    this.Q1_FILES   = ['humancomic.svg', 'aicomic.svg', 'cosmiccomic.svg', 'godcomic.svg'];
    this.Q1_CAPTION = ['Humans', 'AI', 'a cosmic Event', 'God'];
    // Each file's own viewBox ratio — panelQ1 has no fixed height, so this is
    // set directly on the element per image to derive it, keeping the full
    // assigned width filled exactly (no letterboxing) for every answer.
    this.Q1_ASPECT  = ['1131.14 / 534.58', '1131.13 / 510.19', '1131.12 / 548.54', '1170.43 / 685.71'];
    // Each file has its own clipping-mask polygon (id="clippath") marking the
    // real panel box, separate from the full canvas — godcomic/cosmiccomic
    // deliberately draw content above that box (meant to bleed past the grid).
    // Value = (that polygon's topmost Y / viewBox width) * 8, i.e. expressed as
    // a multiple of one column+gap at this panel's assigned width, so the BOX's
    // top edge (not the canvas's) is what lines up with --sg-top.
    this.Q1_TOP_OFFSET = [0.1255, 0.0106, 0.2693, 0.5223];
    // The clip box's actual height (bottom Y - top Y), same units — nearly
    // constant across files (~3.47-3.64). Used to find Q1's real bottom edge so
    // Q5 can be pinned a fixed distance below it, regardless of which Q1/Q5
    // files are showing.
    this.Q1_BOX_HEIGHT = [3.6409, 3.5834, 3.5959, 3.4700];
    // Same technique, measuring the clip polygon's leftmost X instead — most files
    // sit flush left (~0), but godcomic's box is inset 3.5% of its own width,
    // which is what was throwing off left-edge alignment with Q5.
    this.Q1_LEFT_OFFSET = [0.0106, 0.0106, 0.0106, 0.2789];

    this.Q4_FILES = ['popecomic.svg', 'billcomic.svg', 'concomic.svg', 'newscomic.svg'];

    this.Q3_LEGS    = ['stresslegs', 'fearlegs', 'deniallegs', 'relieflegs', 'shocklegs'];
    this.Q3_FACE    = ['stressface', 'fearface', 'normal_face', 'reliefface', 'shockface']; // Denial reuses the default face
    this.Q3_CAPTION = ['stressful', 'terrifying', 'like denial', 'relieving', 'shocking'];

    this.Q5_FILES   = ['doomcomic.svg', 'naturecomic.svg', 'lovedcomic.svg', 'recklesscomic.svg', 'showcomic.svg'];
    this.Q5_CAPTION = ['doomscrolling', 'with Nature', 'with loved ones', 'doing something Reckless', 'preparing for the show'];
    this.Q5_ASPECT  = ['1131.13 / 739.07', '1131.13 / 764.44', '1131.13 / 739.07', '1351.02 / 749.71', '1137.62 / 760.22'];
    // recklesscomic's box is inset 6.5% of its own width from the left, showcomic
    // ~1.9% — both were throwing off left-edge alignment with Q1.
    this.Q5_LEFT_OFFSET = [0.0106, 0.0106, 0.0106, 0.5193, 0.1195];

    this._onWheel = this._onWheel.bind(this);
    this._onResize = this._onResize.bind(this);
    this.continueEl.addEventListener('click', () => { if (this.onComplete) this.onComplete(); });
    if (this.toResultsEl) this.toResultsEl.addEventListener('click', () => this._onToResults());

    // Dev preview: click any panel to cycle through its possible answers, so all
    // combinations can be checked without replaying the quiz.
    this.panelQ1.addEventListener('click', () => this._cyclePanel(0, this.Q1_FILES.length));
    this.panelQ4.addEventListener('click', () => this._cyclePanel(3, this.Q4_FILES.length));
    this.panelQ5.addEventListener('click', () => this._cyclePanel(4, this.Q5_FILES.length));
  }

  _cyclePanel(qIndex, count) {
    const cur = State.getAnswer(qIndex) ?? -1;
    const next = (cur + 1) % count;
    console.log('[comic-reveal] panel clicked, qIndex=' + qIndex + ' cur=' + cur + ' next=' + next); // temporary debug
    State.setAnswerAt(qIndex, next);
    this._render();
  }

  _ensureCharacterSvg() {
    if (this._svgLoaded) return;
    // COMIC_SVG (js/comic-data.js) is comic.svg's markup inlined as a JS string —
    // avoids fetch(), which is blocked under file:// and required a local server.
    // <script src> tags (unlike fetch/AJAX) load fine under file://, same pattern
    // already used by icon-doom.js etc. for their inline SVG icons.
    let text = COMIC_SVG;
    // comic.svg's <style> block defines generic classes like .cls-1 — other inlined
    // SVGs on this page (e.g. the Q2 clock cursor) reuse those same names with different
    // colors. Since inlined <style> tags aren't scoped to their own SVG, that collides
    // and cross-wires colors between unrelated elements. Namespace them before inserting.
    text = text.replace(/\bcls-(\d+)\b/g, 'comicsvg-cls-$1');
    this.characterEl.innerHTML = text;
    this._svgEl = this.characterEl.querySelector('svg');
    if (this._svgEl) {
      this._svgEl.style.width   = '100%';
      this._svgEl.style.height  = '100%';
      this._svgEl.style.display = 'block';
    }
    this._svgLoaded = true;
    this._setGroups(this.DEFAULT_GROUPS);
  }

  _setGroups(visibleIds) {
    if (!this._svgEl) return;
    this.MANAGED_GROUPS.forEach(id => {
      const el = this.characterEl.querySelector('#' + id);
      if (el) el.style.display = visibleIds.includes(id) ? '' : 'none';
    });
  }

  async start(resultKey) {
    this._resultKey = resultKey || null;
    await this._ensureCharacterSvg();
    this.stage = 0; // skip the "scroll down" intro hint — character appears immediately
    this._render(false);
    this.screen.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('resize', this._onResize);
  }

  skipToEnd() {
    this._q3Revealed = 99;
    this.stage = this.STAGE_COUNT;
    this._render(false);
    this.screen.scrollTop = this.screen.scrollHeight;
  }

  stop() {
    this.screen.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('resize', this._onResize);
    clearTimeout(this._resizeTimer);
    clearTimeout(this._idleTimer);
    clearTimeout(this._legsRevealTimer);
    clearTimeout(this._zoomSettleTimer);
    this._exitTimeouts.forEach(t => clearTimeout(t));
    this._exitTimeouts = [];
  }

  _onResize() {
    // Re-run layout only (not a full _render) — resizing shouldn't touch
    // stage/answers, just where Q1/Q5 (and the bubble tails, which depend on
    // real on-screen positions) land. Debounced since 'resize' fires
    // continuously while the user is dragging the window edge.
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      this._layoutQ1Q5();
      if (this.stage >= 1 && this.stage < 4) this._layoutQ4Centered();
      this._layoutCharacterBubble();
      this._updateBubbleShapes();
    }, 100);
  }

  reset() {
    this.stop();
    this.stage = -1;
    this._legsRevealTimer     = null;
    this._legsRevealed        = false;
    this._q3Revealed          = 0;
    this._zoomSettled         = false;
    this._zoomSettleTimer     = null;
    this._exitSequenceActive  = false;
    this._exitResultsStarted  = false;
    this._resultKey           = null;
    // Clean up exit sequence DOM state
    this.screen.classList.remove('exiting',
      'result-nonchalant', 'result-clueless', 'result-knowitall', 'result-runaway');
    this.bgOverlayEl.classList.remove('gradient-in', 'gradient-warm', 'full-pink');
    this.globeEl.classList.remove('globe-rising', 'result-touched', 'globe-hide');
    this.resultCharEl.classList.remove('slide-in');
    this.resultArtEl.classList.remove('slide-in');
    this.resultDescEl.classList.remove('slide-in');
    // Restore the real character (hidden via inline style when the
    // floatingperson.svg pose took over, see _runExitSequence) and reset that
    // floating pose element back to its own hidden default state.
    this.characterEl.style.display = '';
    if (this.floatingCharEl) {
      this.floatingCharEl.classList.remove('floating', 'char-shrink', 'char-gone');
      // Clear any inline overrides left by the char-shrink freeze trick (see
      // _onToResults) so a replay starts clean.
      this.floatingCharEl.style.animation = '';
      this.floatingCharEl.style.transform = '';
    }
    if (this.toResultsEl) this.toResultsEl.classList.remove('visible');
    document.getElementById('btn-restart').classList.remove('visible');
    document.getElementById('btn-share').classList.remove('visible');
    this.idleHintEl.classList.remove('visible');
    if (this._svgLoaded) this._setGroups(this.DEFAULT_GROUPS);
    this._render(false);
  }

  // Restarts the "no input for IDLE_MS" countdown; called on every wheel
  // event (whether or not it changed stage) and once the countdown fires,
  // shows the idle hint — but only mid-scroll (stage -1 already has its own
  // persistent reminder, stage STAGE_COUNT already has .comic-continue).
  _armIdleTimer() {
    clearTimeout(this._idleTimer);
    if (this.stage >= 0 && this.stage < this.STAGE_COUNT) {
      this._idleTimer = setTimeout(() => this.idleHintEl.classList.add('visible'), this.IDLE_MS);
    }
  }

  _onWheel(e) {
    e.preventDefault();
    clearTimeout(this._idleTimer);
    this.idleHintEl.classList.remove('visible');

    // During the exit sequence, scrolling does nothing — the reveal is driven
    // by the "to the results" button (see _onToResults), not the wheel.
    if (this._exitSequenceActive) return;

    if (!this._wheelLocked && Math.abs(e.deltaY) >= 30) {
      const dir = e.deltaY > 0 ? 1 : -1;

      // One more scroll past the last stage kicks off the exit animation.
      if (this.stage === this.STAGE_COUNT && dir > 0) {
        this._wheelLocked = true;
        setTimeout(() => { this._wheelLocked = false; }, 650);
        this._runExitSequence();
        return;
      }

      // Q3 multi-emotion: while on the zoomed-in beat with more than one chosen
      // emotion, each scroll steps through them (forward reveals the next,
      // backward steps one off) BEFORE the stage itself changes. The stage only
      // moves on once they're all shown (forward) or all stepped off (backward).
      const q3list = this._getQ3List();
      if (this.stage === 6 && q3list.length > 1) {
        if (dir > 0 && this._q3Revealed < q3list.length) {
          this._q3Revealed++;
          this._render();
          this._wheelLocked = true;
          setTimeout(() => { this._wheelLocked = false; }, 650);
          this._armIdleTimer();
          return;
        }
        if (dir < 0 && this._q3Revealed > 1) {
          this._q3Revealed--;
          this._render();
          this._wheelLocked = true;
          setTimeout(() => { this._wheelLocked = false; }, 650);
          this._armIdleTimer();
          return;
        }
      }

      const next = this.stage + dir;
      if (next >= -1 && next <= this.STAGE_COUNT) {
        this._wheelLocked = true;
        this.stage = next;
        this._render(true);
        setTimeout(() => { this._wheelLocked = false; }, 650);
      }
    }

    this._armIdleTimer();
  }

  // Q3 answer normalised to an array of emotion indices (see constructor).
  _getQ3List() {
    const raw = State.getAnswer(2);
    if (raw === null || raw === undefined) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  // Panels stagger off the top, the character swaps to the floating pose and
  // floats; ~1s later a "to the results" button fades in below him. Clicking
  // it (see _onToResults) shrinks him away and reveals the result page.
  _runExitSequence() {
    this._exitSequenceActive = true;

    // Pre-load all result assets before any animation starts.
    if (this._resultKey && typeof QUIZ_RESULTS !== 'undefined') {
      const r = QUIZ_RESULTS[this._resultKey];
      if (r) {
        this.globeResultArtEl.src    = r.art;
        this.resultArtEl.src         = r.art;
        this.resultCharEl.src        = r.char;
        this.resultDescEl.textContent = r.desc;
      }
    }
    // Stamp result class for per-result sizing overrides.
    if (this._resultKey) this.screen.classList.add('result-' + this._resultKey);

    // Slide panels/chrome off top; hide bubbles.
    this.continueEl.classList.remove('visible');
    this.screen.classList.add('exiting');
    this.bgOverlayEl.classList.add('gradient-in');

    const _t = (fn, ms) => {
      const id = setTimeout(fn, ms);
      this._exitTimeouts.push(id);
    };

    // 600ms: swap the real character out for the separate floatingperson.svg
    // pose (see index.html / floatingCharEl) and start it floating. A whole-
    // element swap rather than toggling a group inside the giant inline SVG.
    _t(() => {
      this.characterEl.style.display = 'none';
      if (this.floatingCharEl) this.floatingCharEl.classList.add('floating');
    }, 600);

    // 1600ms: background begins blooming toward pink.
    _t(() => {
      this.bgOverlayEl.classList.add('gradient-warm');
    }, 1600);

    // 1600ms (~1s after he starts floating): show the "to the results" button.
    _t(() => {
      if (this.toResultsEl) this.toResultsEl.classList.add('visible');
    }, 1600);
  }

  // "to the results" click: hide the button, shrink the character away in
  // place, then once he's gone reveal the result page from the bottom up.
  _onToResults() {
    if (this._exitResultsStarted) return;
    this._exitResultsStarted = true;

    if (this.toResultsEl) this.toResultsEl.classList.remove('visible');

    // floatingCharEl (the floatingperson.svg pose, see _runExitSequence) is
    // mid-way through the infinite .comic-float keyframe animation. Adding
    // .char-shrink and letting its transform transition take over in the SAME
    // style recalc doesn't animate — the browser has no committed prior frame
    // to transition FROM (the animation was driving the value, not the
    // transition), so it just snaps straight to scale(0). Fix: freeze it at
    // its exact current animated position first (inline style, forcing a
    // reflow so it's actually committed/painted), THEN on the next frame swap
    // to the shrink transition — now there's a real "from" value.
    const el = this.floatingCharEl || this.characterEl;
    const frozenTransform = getComputedStyle(el).transform;
    el.style.animation = 'none';
    el.style.transform = frozenTransform;
    void el.offsetHeight; // force reflow to commit the frozen frame

    requestAnimationFrame(() => {
      el.classList.add('char-shrink');
      // Let the (!important) class rules take over cleanly instead of racing
      // with these inline values.
      el.style.animation = '';
      el.style.transform = '';
    });

    // Once the shrink (0.6s) finishes and he's invisible, build the result page.
    const id = setTimeout(() => this._revealResults(), 620);
    this._exitTimeouts.push(id);
  }

  // Result page assembles on its own: art rises from below first, then the
  // character art and the description follow.
  _revealResults() {
    this.bgOverlayEl.classList.add('full-pink');
    this.resultArtEl.classList.add('slide-in');
    const t1 = setTimeout(() => this.resultCharEl.classList.add('slide-in'), 700);
    const t2 = setTimeout(() => this.resultDescEl.classList.add('slide-in'), 1400);
    // 1 second after the last element (desc at 1400ms) slides in, show buttons.
    const t3 = setTimeout(() => {
      document.getElementById('btn-restart').classList.add('visible');
      document.getElementById('btn-share').classList.add('visible');
    }, 2400);
    this._exitTimeouts.push(t1, t2, t3);
  }

  _render() {
    const q1 = State.getAnswer(0); // who will end the world
    const q2 = State.getAnswer(1); // when
    const q4 = State.getAnswer(3); // who breaks the news
    const q5 = State.getAnswer(4); // final day

    // Q3 (immediate reaction) is multi-select — normalise to an array of
    // chosen emotion indices in pick order (see constructor / _getQ3List).
    const q3list = this._getQ3List();

    // Pre-scroll intro hint — the only thing visible at stage -1. Fades out
    // for good the moment the user's first scroll input moves stage to 0.
    this.introHintEl.classList.toggle('hidden', this.stage >= 0);

    // Title box and inbox caption removed — replaced by the pre-comic sequence.
    this.titleBoxEl.classList.remove('visible');
    this.titleEl.classList.remove('visible');
    this.inboxCaptionEl.classList.remove('visible');

    // Character grows from tiny (stage -1) to full size at stage 0 (centered),
    // nudges slightly left at stage 1-2 to share center space with Q4,
    // then shifts right to its resting spot at stage 3.
    this.characterEl.classList.toggle('grown', this.stage >= 0);
    this.characterEl.classList.toggle('nudged', this.stage >= 1 && this.stage <= 3);
    this.characterEl.classList.toggle('placed', this.stage >= 4);

    // Q4's speech bubble — both lines are spoken while the characters are
    // still centered together: "the world will end" (stage 2), then "it will
    // be caused by X" (stage 3). The bubble is cleared at stage 4 so it's
    // hidden during the shift-right move (which now happens alongside Q1).
    let bubbleText = '';
    if (this.stage === 2 && q4 !== null) {
      bubbleText = 'the world will end';
    } else if (this.stage === 3 && q1 !== null) {
      bubbleText = `it will be caused by ${this.Q1_CAPTION[q1]}`;
    }
    this.bubbleTextEl.textContent = bubbleText;
    this.bubbleEl.classList.toggle('visible', bubbleText !== '');

    // Q4 panel — fades in near center at stage 1 (positioned by
    // _layoutQ4Centered), then shifts right with pink box at stage 4
    // (positioned by _layoutQ1Q5 from that point on).
    const showQ4 = this.stage >= 1 && q4 !== null;
    if (showQ4) this.panelQ4.src = this.Q4_FILES[q4];
    this.panelQ4.classList.toggle('visible', showQ4);
    // Pink box only appears once they shift right at stage 4.
    this.boxQ4.classList.toggle('visible', this.stage >= 4 && showQ4);

    // Q1 panel — top-left, appears at stage 4, together with the shift-right.
    const showQ1 = this.stage >= 4 && q1 !== null;
    if (showQ1) {
      this.panelQ1.src = this.Q1_FILES[q1];
      this.panelQ1.style.aspectRatio = this.Q1_ASPECT[q1];
    }
    this.panelQ1.classList.toggle('visible', showQ1);

    // Camera zoom — only during the Q3 stage, zooms back out after. Scales the
    // whole scene wrapper (see .comic-scene.zoomed), not just the character.
    // Computed BEFORE the char bubble below because the bubble's own position
    // depends on it settling first (see _zoomSettled).
    const wasZoomed = this.sceneEl.classList.contains('zoomed');
    const zoomedNow = this.stage === 6;
    this.sceneEl.classList.toggle('zoomed', zoomedNow);
    const zoomingOut = wasZoomed && !zoomedNow;

    if (zoomedNow && !wasZoomed) {
      // Just started zooming in — the whole scene (character included) is
      // still mid-transition, so measuring the character's bubble right now
      // would use a stale/transitional rect and the bubble would visibly jump
      // once the zoom actually settles (this was the "bubble lifts and stops
      // sitting behind the text" bug). Keep the bubble hidden until the zoom's
      // own 0.6s transition (see .comic-scene.zoomed) has finished, then
      // re-render once so it measures against the final, settled rect. After
      // that, stepping through the Q3 emotions on this same settled rect never
      // needs to re-measure differently, so it stays put.
      this._zoomSettled = false;
      clearTimeout(this._zoomSettleTimer);
      this._zoomSettleTimer = setTimeout(() => {
        this._zoomSettled = true;
        this._render();
      }, 630);
    } else if (!zoomedNow) {
      this._zoomSettled = false;
      clearTimeout(this._zoomSettleTimer);
    }

    // Main character's own speech bubble — the Q3 reaction at stage 6 shows
    // ONE emotion at a time (replaced, not stacked): the first reads "that
    // sounds stressful", each subsequent scroll replaces it with "and scary"
    // etc. Hides for the zoom out (stage 7), then reappears with "I will spend
    // my last day X" from stage 8 on.
    let charBubbleText = '';
    if (this.stage === 6 && q3list.length > 0 && this._zoomSettled) {
      const shown = Math.min(Math.max(this._q3Revealed, 1), q3list.length);
      const idx   = q3list[shown - 1];
      charBubbleText = shown === 1
        ? `that sounds ${this.Q3_CAPTION[idx]}`
        : `and ${this.Q3_CAPTION[idx]}`;
    } else if (this.stage >= 8 && q5 !== null) {
      charBubbleText = `I will spend my last day ${this.Q5_CAPTION[q5]}`;
    }
    this.bubbleCharTextEl.textContent = charBubbleText;
    this.bubbleCharEl.classList.toggle('visible', charBubbleText !== '');

    // Ground panel behind his legs — appears right at the zoom-in (not
    // delayed like the leg swap below) and then persists for the rest of the
    // scene, even once the camera zooms back out at stage 8.
    if (this.footboxEl) this.footboxEl.classList.toggle('visible', this.stage >= 6 && q3list.length > 0);

    // Q3 legs/face swap — scroll-driven (see _onWheel). On first reaching stage
    // 6 the first chosen emotion shows (_q3Revealed 0 -> 1); each forward scroll
    // steps to the next. The pose always reflects the currently-shown emotion
    // and, once all are stepped through, persists through the later stages
    // (zoom out, Q5, ...). Dropping below stage 6 resets the count.
    if (this.stage >= 6 && q3list.length > 0) {
      if (this._q3Revealed === 0) this._q3Revealed = 1;
      const shown  = Math.min(Math.max(this._q3Revealed, 1), q3list.length);
      const latest = q3list[shown - 1];
      this._setGroups([this.Q3_LEGS[latest], this.Q3_FACE[latest]].filter(Boolean));
    } else {
      this._q3Revealed = 0;
      this._setGroups(this.DEFAULT_GROUPS);
    }

    // Q5 panel — bottom-left, appears at stage 9 (one stage after the char
    // bubble text at stage 8) and stays. Anchored directly on the bottom margin.
    const showQ5 = this.stage >= 9 && q5 !== null;
    if (showQ5) {
      this.panelQ5.src = this.Q5_FILES[q5];
      this.panelQ5.style.aspectRatio = this.Q5_ASPECT[q5];
    }
    this.panelQ5.classList.toggle('visible', showQ5);

    // Q1's own height (aspect-ratio-locked to its width) and Q5's height are
    // both derived from the SAME shared width — see _layoutQ1Q5 — so this has
    // to run after both srcs/aspect-ratios above are set, on every render, not
    // just when Q5 first appears (Q1 needs to already be sized for the Q5
    // that's coming, so it doesn't visibly resize/jump when Q5 shows up
    // later). Also covers Q4 (see showQ4 above) — it now appears a stage
    // before Q1 does, and needs its own top/height set here too.
    if (showQ1 || showQ4 || showQ5) this._layoutQ1Q5();
    // At stages 1-3, Q4 is in its centered position — _layoutQ1Q5 skips Q4
    // there, so a separate call positions it.
    if (showQ4 && this.stage < 4) this._layoutQ4Centered();
    if (this.stage >= 1) this._layoutCharacterBubble();
    // Skip footbox layout when the zoom-out transition just started — at that
    // moment getBoundingClientRect() still returns 1.7× zoomed measurements,
    // which would write oversized vw/vh values that stick until the next event.
    // The transitionend listener in start() re-runs this once the scale is 1×.
    // footbox2 is now purely CSS-positioned (see .comic-footbox in styles.css)

    // Positions/visibility above are already final by this point (only
    // opacity transitions on these elements, not left/top/width), so it's
    // safe to measure real on-screen positions for the bubble shapes here.
    this._updateBubbleShapes();

    // Temporary continue hint at the last stage
    this.continueEl.classList.toggle('visible', this.stage === this.STAGE_COUNT);
  }

  // Draws each visible bubble as ONE continuous SVG shape — an ellipse
  // outline (matching the invisible text div's real size/position) with a
  // small wedge of its own outline replaced by two straight lines that taper
  // to a point at an approximate mouth position on the character it belongs
  // to. This is the standard "speech bubble with integrated tail" technique:
  // body and tail read as a single shape and the tail naturally stretches
  // long or short depending on distance, rather than a separate fixed-size
  // arrow bolted onto a box (see conversation — that's what this replaced).
  _updateBubbleShapes() {
    this._updateBubbleShape(this.bubbleEl, this.shapeQ4El, () => {
      const t = this.panelQ4.getBoundingClientRect();
      // Bubble sits to the left — aim at the portrait's near (left) edge, upper face.
      // curveSign flips which side the tail's gentle bulge bows toward — this
      // one reads more natural curving down toward the portrait. spread is
      // wide (vs. the original 0.22) so the tail reads as a thick wedge
      // instead of a thin spike.
      return { x: t.left + t.width * 0.06, y: t.top + t.height * 0.16, spread: 0.34, maxTail: 110, curveSign: -1 };
    });
    this._updateBubbleShape(this.bubbleCharEl, this.shapeCharEl, () => {
      const t = this.characterEl.getBoundingClientRect();
      // Bubble sits to his right now, roughly at head height — aim lower,
      // toward mouth/chin height rather than the top of his head, so the
      // target sits clearly BELOW the bubble's own center. That guarantees
      // the tail exits from the bubble's bottom-left (down-and-left) instead
      // of running out flat from the middle of its left side.
      return { x: t.left + t.width * 0.18, y: t.top + t.height * 0.22, spread: 0.4, maxTail: 60, curveSign: 1 };
    });
  }

  _updateBubbleShape(bubbleEl, pathEl, getTarget) {
    if (!bubbleEl.classList.contains('visible')) {
      pathEl.setAttribute('d', '');
      return;
    }
    const b = bubbleEl.getBoundingClientRect();
    const { x: targetX, y: targetY, spread = 0.22, maxTail = 100, minTail = 28, curveSign = 1 } = getTarget();

    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const rx = b.width / 2;
    const ry = b.height / 2;

    const angle = Math.atan2(targetY - cy, targetX - cx);
    const a1 = angle - spread;
    const a2 = angle + spread;
    const p1x = cx + rx * Math.cos(a1), p1y = cy + ry * Math.sin(a1);
    const p2x = cx + rx * Math.cos(a2), p2y = cy + ry * Math.sin(a2);

    // Tail tip: start from the bubble edge toward the mouth, but cap length so
    // long distances don't produce a huge wedge. A slight curve reads more
    // natural than a dead-straight spike.
    const edgeX = cx + rx * Math.cos(angle);
    const edgeY = cy + ry * Math.sin(angle);
    // Direction the tail travels: normally "toward the target", but if the
    // bubble has been pushed close enough to overlap its target, the target
    // can end up INSIDE the ellipse — closer to the center than the edge
    // point itself. In that case (target - edge) points backward, toward
    // the center, which folds the whole tail wedge back inside the bubble
    // instead of letting it poke out (that's the "tail got eaten" bug).
    // Detect that with a dot product against the outward radial direction
    // and fall back to just continuing straight outward instead.
    const outwardX = edgeX - cx, outwardY = edgeY - cy;
    let dirX = targetX - edgeX, dirY = targetY - edgeY;
    if (dirX * outwardX + dirY * outwardY < 0) {
      dirX = outwardX;
      dirY = outwardY;
    }
    const toTarget = Math.hypot(dirX, dirY) || 1;
    // Clamped on BOTH ends: capped at maxTail so far targets don't produce a
    // huge wedge, but also floored at minTail so that once the bubble sits
    // close to (or even overlapping) its target — as intentionally happens
    // now that both bubbles overlap their character a bit — the tail doesn't
    // shrink toward zero length and disappear. Below minTail this makes the
    // tail overshoot slightly past the literal target point, which is fine
    // since it was always just an approximate aim anyway.
    const tailLen = Math.min(Math.max(toTarget, minTail), maxTail);
    const tipX = edgeX + (dirX / toTarget) * tailLen;
    const tipY = edgeY + (dirY / toTarget) * tailLen;

    const midX = (p1x + p2x) / 2;
    const midY = (p1y + p2y) / 2;
    const perpX = -(tipY - midY);
    const perpY = tipX - midX;
    const perpLen = Math.hypot(perpX, perpY) || 1;
    const bulge = Math.min(10, tailLen * 0.08) * curveSign;
    const cpX = (midX + tipX) / 2 + (perpX / perpLen) * bulge;
    const cpY = (midY + tipY) / 2 + (perpY / perpLen) * bulge;

    pathEl.setAttribute('d',
      `M ${p2x} ${p2y} A ${rx} ${ry} 0 1 1 ${p1x} ${p1y} Q ${cpX} ${cpY} ${tipX} ${tipY} Z`
    );
  }

  // Positions the main character's bubble beside his head once he's in his
  // resting spot (stage >= 1). Fixed CSS percentages couldn't track his actual
  // on-screen head position across screen sizes. Sits to his RIGHT, raised
  // well above head height so its tail — anchored on the bubble's own left
  // side, see _updateBubbleShapes — has room to slope back down to his head
  // instead of running flat/upward into it.
  _layoutCharacterBubble() {
    if (!this.characterEl.classList.contains('placed')) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const toVw = (px) => `${(px / vw) * 100}vw`;
    const toVh = (px) => `${(px / vh) * 100}vh`;

    const char = this.characterEl.getBoundingClientRect();
    const ph = vw * 0.02;
    const headY = char.top + char.height * 0.11;

    // Kept fairly narrow on purpose — long lines (e.g. "I will spend my last
    // day doing something Reckless") should wrap to two lines rather than
    // stretching the bubble into a wide pill.
    const width = char.width * 0.6;
    // Negative: overlaps back onto his shoulder so the bubble reads close
    // beside him instead of floating off to the right.
    const gap = -char.width * 0.22;
    const left = Math.min(vw - ph - width, char.left + char.width + gap);
    const top = headY - char.height * 0.1;

    this.bubbleCharEl.style.left = toVw(left);
    this.bubbleCharEl.style.width = toVw(width);
    this.bubbleCharEl.style.top = toVh(top);
  }

  // Positions Q4 in its "centered entry" position (stages 1-3), to the left
  // of the main character who has nudged slightly left. Both characters sit
  // roughly in the center of the screen together. At stage 4, _layoutQ1Q5
  // takes over and the CSS transition on left/width animates the slide right.
  _layoutQ4Centered() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const toVw = (px) => `${(px / vw) * 100}vw`;
    const toVh = (px) => `${(px / vh) * 100}vh`;

    const ph = vw * 0.02;
    const comicGap = 19;
    const comicPv = 24;
    const col = (vw - 2 * ph - 11 * comicGap) / 12;
    const row = (vh - 2 * comicPv) / 12;

    const BOX_HEIGHT_VH = 0.848;
    const boxHeight = vh * BOX_HEIGHT_VH;

    // Match the resting width (3.75 cols, same as _layoutQ1Q5 at s=1)
    // so Q4 doesn't visibly resize when it shifts right at stage 3.
    const q4Width = 3.75 * (col + comicGap);

    // Center the pair on screen. The character (nudged left by 1 col from
    // its own center) starts at: 50%vw - charW/2 - 1*(col+gap).
    const charW    = 3.6 * (col + comicGap);
    const charLeft = vw / 2 - charW / 2 - (col + comicGap);
    const GAP_BETWEEN = col * 0.15;
    // Q4 sits to the RIGHT of the character
    const q4Left = charLeft + charW + GAP_BETWEEN;

    // Bubble sits between the character and Q4 (to the left of Q4)
    const BUBBLE_FACE_Y = 0.14;
    const bubbleWidth = q4Width * 0.55;
    const bubbleLeft  = q4Left - bubbleWidth * 0.7;
    const q4Top = vh * 0.058;
    const bubbleTop = q4Top + boxHeight * BUBBLE_FACE_Y;

    this.panelQ4.style.left   = toVw(q4Left);
    this.panelQ4.style.width  = toVw(q4Width);
    this.panelQ4.style.top    = '5.8vh';
    this.panelQ4.style.height = toVh(boxHeight);

    this.bubbleEl.style.left  = toVw(bubbleLeft);
    this.bubbleEl.style.width = toVw(bubbleWidth);
    this.bubbleEl.style.top   = toVh(bubbleTop);
  }

  // Sizes+positions Q1 and Q5 together so they always share one width (their
  // right edges stay aligned, per-file LEFT_OFFSET nudges aside). Q1 and Q5
  // each get their own vertical position as an affine function of `row`
  // (i.e. of viewport height) — Q1_TOP_A/B and Q5_TOP_A/B below are the two
  // (BASE, PER_ROW) constants of each line, solved from two calibration
  // points: "A" = 1728x1117 (the original reference size/combo, already
  // approved) and "B" = 2240x1260 with the AI/doomscrolling answers (tuned
  // by hand in DevTools — see conversation). Q1's line is in terms of its
  // offset-corrected base position (add back offset*unit to get the actual
  // top); Q5's has no per-file offset (matches how it's always been). This
  // replaced an earlier version that pinned Q5's top to Q1's own measured
  // bottom edge + a fixed ratio — that assumed the transparent padding above
  // Q5's diagonal art was roughly the same fraction of every file's height,
  // which doesn't hold across very different Q1/Q5 answer combos, so it's
  // simpler and more accurate to fit each panel's line independently.
  _layoutQ1Q5() {
    const q1 = State.getAnswer(0);
    const q5 = State.getAnswer(4);
    if (q1 === null && q5 === null) return;

    // base + per-row. Slopes (the _B constants) are kept from the original
    // two-point fit (1728x1117 vs 2240x1260) — the user has since re-tuned
    // just the 1728x1117 intercepts by hand in DevTools (top:13vh for Q1,
    // top:32vh for Q5, width:64.733vw for both) and said not to worry about
    // other sizes tracking exactly, just to stay responsive — so only the
    // _A intercepts were re-solved against that new target, same slopes.
    //
    // Re-solved once more against the user's real viewport — 1728x1084, not
    // 1728x1117 as previously assumed. That 33px gap was macOS reserving
    // space for the camera housing/menu bar, invisible to window.innerHeight
    // vs the nominal window size, so every earlier calibration against
    // "1117" was quietly off by that much. Same slopes as before either way.
    const Q1_TOP_A = 160.584, Q1_TOP_B = -0.25931;
    const Q5_TOP_A = 123.910, Q5_TOP_B = 2.2449;
    // Independent of Q1/Q5 — the pink Q4 fill's own top, as an editable knob
    // (previously just var(--sg-top) baked into the CSS, shared/entangled
    // with other things). Re-solved to hit top:12.6307vh at 1728x1084 (tuned
    // by hand in DevTools), same BOX_TOP_B slope as the original --sg-top
    // formula (comicPv + 1.2*row).
    const BOX_TOP_A = 0, BOX_TOP_B = 0; // replaced by fixed vh below
    const BOX_HEIGHT_VH = 0.848;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ph = vw * 0.02;         // --ph: 2vw
    const comicGap = 19;          // --comic-gap
    const comicPv = 24;           // --comic-pv
    const col = (vw - 2 * ph - 11 * comicGap) / 12;
    const row = (vh - 2 * comicPv) / 12;
    const naturalWidth = 8 * (col + comicGap);
    const naturalUnit = naturalWidth / 8;

    const parseAspect = (s) => { const [w, h] = s.split('/').map(Number); return w / h; };
    const q1Aspect = q1 !== null ? parseAspect(this.Q1_ASPECT[q1]) : null;
    const q5Aspect = q5 !== null ? parseAspect(this.Q5_ASPECT[q5]) : null;
    const q1NaturalHeight = q1Aspect ? naturalWidth / q1Aspect : 0;
    const q5NaturalHeight = q5Aspect ? naturalWidth / q5Aspect : 0;
    const offset1 = q1 !== null ? this.Q1_TOP_OFFSET[q1] : 0;

    const q1TopBase = Q1_TOP_A + Q1_TOP_B * row;
    const q5Top      = Q5_TOP_A + Q5_TOP_B * row; // doesn't depend on scale — see s_bound5 below

    // Solve for the largest scale s (<=1) such that neither panel's bottom
    // edge passes the bottom margin. q5Top/q1TopBase don't depend on s, so
    // each bound is a simple linear solve.
    //
    // This used to also subtract a full extra row here to reserve room for
    // "keep scrolling" — but that's now redundant with (and was fighting)
    // the dynamic keep-scrolling placement further below, which already
    // guarantees no overlap by sitting wherever Q5's real bottom edge
    // actually ends up. Reserving a whole row here on top of that was
    // triggering shrinkage even at the normal/reference screen size, which
    // is why the numbers kept drifting away from what was set by hand.
    const availableBottom = vh - comicPv;
    const s_bound5 = (availableBottom - q5Top) / q5NaturalHeight;
    const s_bound1 = (availableBottom - q1TopBase) / (q1NaturalHeight - offset1 * naturalUnit);
    const s = Math.min(1, s_bound5, s_bound1);

    const width = naturalWidth * s;
    const unit  = naturalUnit * s;

    // Expressed in vw/vh (of the viewport at the moment we computed these
    // numbers) rather than px, so the browser keeps these panels tracking
    // the viewport natively on every reflow — including the instant a window
    // drag happens, before the debounced resize handler below gets a chance
    // to re-run the fit math — instead of sitting at a stale px snapshot
    // until the next recalculation lands.
    const toVw = (px) => `${(px / vw) * 100}vw`;
    const toVh = (px) => `${(px / vh) * 100}vh`;

    let q1Right = ph + width;
    let q5Right = ph + width;
    if (q1 !== null) {
      const left = vw * 0.0191423;
      this.panelQ1.style.width = toVw(width);
      this.panelQ1.style.top   = '5.13vh';
      this.panelQ1.style.left  = toVw(left);
      q1Right = left + width;
    }
    if (q5 !== null) {
      const left = vw * 0.0191423;
      this.panelQ5.style.width = toVw(width);
      this.panelQ5.style.top   = '24vh';
      this.panelQ5.style.left  = toVw(left);
      q5Right = left + width;

      // "keep scrolling" (.comic-continue/.comic-idle-hint) now lives in
      // whatever gap is actually left below Q5's real bottom edge, instead
      // of a fixed row at the bottom margin — that's the space the Q5 lift
      // above was for. Left/width stay as defined in CSS; only vertical
      // placement is dynamic here.
      const q5Bottom = q5Top + q5NaturalHeight * s;
      const gapTop    = q5Bottom + 8;
      const gapHeight = Math.max(0, availableBottom - gapTop);
      this.continueEl.style.top    = toVh(gapTop);
      this.continueEl.style.height = toVh(gapHeight);
      this.idleHintEl.style.top    = toVh(gapTop);
      this.idleHintEl.style.height = toVh(gapHeight);
    }

    // At stages 1-3, Q4 is in its centered entry position — _layoutQ4Centered
    // handles its left/width/top/height there. Skip all Q4/box/bubble
    // positioning here until stage 4 when they shift right together.
    if (this.stage < 4) return;

    // The solid pink fill behind Q4 normally starts at a fixed column (its
    // CSS default), regardless of how far Q1/Q5's right edge actually
    // reaches — so when Q1/Q5 shrink, a gap of bare background opens up
    // between them and Q4. Stretch the fill's left edge back to meet
    // whichever of Q1/Q5 reaches furthest right, plus a small breathing gap
    // (BOX_GAP_RATIO, in the same width-based units as everything else —
    // calibrated to reproduce left:64.5vw/width:33.5vw at 2240x1260, tuned
    // by hand in DevTools), keeping the fill's own right edge (its normal
    // CSS position, i.e. Q4's normal position) fixed. Only ever extends
    // left, never past its own default position.
    const BOX_GAP_RATIO = 0.18;
    const boxRight = ph + naturalWidth + comicGap + 3.75 * naturalUnit; // original left + original width
    const boxLeft  = Math.min(ph + naturalWidth + comicGap, Math.max(q1Right, q5Right) + BOX_GAP_RATIO * unit);
    this.boxQ4.style.left  = toVw(boxLeft);
    this.boxQ4.style.width = toVw(boxRight - boxLeft);

    const boxHeight = vh * BOX_HEIGHT_VH;
    this.boxQ4.style.top    = '6.6vh';
    this.boxQ4.style.height = toVh(boxHeight);
    this.panelQ4.style.left   = toVw(ph + naturalWidth * s + comicGap - 20);
    this.panelQ4.style.width  = toVw(3.75 * naturalUnit * s);
    this.panelQ4.style.top    = '5.8vh';
    this.panelQ4.style.height = toVh(boxHeight);

    // Q4's speech bubble — sits to the LEFT of his box (not overlapping his
    // portrait), tail pointing right into the artwork.
    const BUBBLE_FACE_Y = 0.14;
    const BUBBLE_WIDTH_RATIO = 0.17;
    const bubbleWidth = width * BUBBLE_WIDTH_RATIO;
    const BUBBLE_GAP = -bubbleWidth * 0.45;
    const bubbleLeft  = boxLeft - BUBBLE_GAP - bubbleWidth;
    const bubbleTop   = vh * 0.066 + boxHeight * BUBBLE_FACE_Y;
    this.bubbleEl.style.left  = toVw(bubbleLeft);
    this.bubbleEl.style.width = toVw(bubbleWidth);
    this.bubbleEl.style.top   = toVh(bubbleTop);
  }
}
