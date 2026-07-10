class ComicRevealInteraction {
  constructor({ screen, sceneEl, titleEl, titleBoxEl, inboxCaptionEl, characterEl, floatingCharEl, panelQ1, panelQ4, panelQ5, boxQ4, footboxEl, navBackEl, navForwardEl, introHintEl, bubbleEl, bubbleTextEl, bubbleLine1El, bubbleLine2El, bubbleCharEl, bubbleCharTextEl, shapeQ4El, shapeCharEl, bgOverlayEl, globeEl, globeResultArtEl, resultCharEl, resultArtEl, resultDescEl, toResultsEl }) {
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
    this.navBackEl    = navBackEl;
    this.navForwardEl = navForwardEl;
    this.introHintEl = introHintEl;
    this.bubbleEl      = bubbleEl;
    this.bubbleTextEl  = bubbleTextEl;
    this.bubbleLine1El = bubbleLine1El;
    this.bubbleLine2El = bubbleLine2El;
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

    this._autoBubble      = false;
    this._autoBubbleTimer = null;
    this._exitSequenceActive = false;
    this._exitResultsStarted = false;
    this._resultKey          = null;
    this._exitTimeouts       = [];
    this.comicSceneSnapshot  = null;

    // Stages: -1 = pre-scroll intro hint -> 0 = character alone + title box ->
    // 1 = Q4 portrait enters near center, "X will tell you:" caption ->
    // 2 = Q4 speech bubble "the world will end" (still centered) ->
    // 3 = bubble changes to "it will be caused by X" (STILL centered) ->
    // 4 = characters shift RIGHT to their resting spot AND the Q1 image
    //     appears at top-left simultaneously, title recenters, caption clears ->
    // 5 = zoom in + main character's bubble "that sounds X" + legs/face swap ->
    // 6 = zoom back out (bubble hides) -> 7 = his bubble reappears "I will
    // spend my last day X" -> 8 = Q5 image appears ->
    // 9 = temporary "continue" trigger
    this.STAGE_COUNT = 8;
    this.stage        = -1;
    this._svgLoaded   = false;
    this._svgEl       = null;
    this._clickLocked = false;

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
    // Per-answer manual position/size overrides (each art's own crop/scale
    // differs, so these are tuned by hand rather than derived) — set at
    // the user's reference screen size, same convention as other hardcoded
    // vw/vh values in this file. null = not tuned yet, falls back to the
    // shared computed layout below.
    // Shrunk ~6% from the user's original hand-tuned values, scaling from
    // each one's bottom-right corner (so the right/bottom edges — already
    // correct — stay put, and the leftmost/topmost point pulls in, fixing
    // both "too big" and "left point clipped behind other panels").
    this.Q4_OVERRIDE = [
      { left: '59.593vw', width: '31.96vw',   top: '9.2vh',    height: '84.6vh'  }, // pope
      { left: '59.713vw', width: '33.84vw',   top: '14.1vh',   height: '79.9vh'  }, // bill
      { left: '63.28vw',  width: '35.72vw',   top: '10.088vh', height: '79.712vh' }, // conspiracy
      { left: '65.676vw', width: '26.262vw',  top: '11.788vh', height: '79.712vh' }, // news
    ];

    this.Q3_LEGS    = ['stresslegs', 'fearlegs', 'deniallegs', 'relieflegs', 'shocklegs'];
    this.Q3_FACE    = ['stressface', 'fearface', 'normal_face', 'reliefface', 'shockface']; // Denial reuses the default face
    this.Q3_CAPTION = ['stressful', 'terrifying', 'like denial', 'relieving', 'shocking'];

    this.Q5_FILES   = ['doomcomic.svg', 'naturecomic.svg', 'lovedcomic.svg', 'recklesscomic.svg', 'showcomic.svg'];
    this.Q5_CAPTION = ['doomscrolling', 'with Nature', 'with loved ones', 'doing something Reckless', 'preparing for the show'];
    this.Q5_ASPECT  = ['1131.13 / 739.07', '1131.13 / 764.44', '1131.13 / 739.07', '1351.02 / 749.71', '1137.62 / 760.22'];
    // Same idea as Q1_LEFT_OFFSET/Q1_TOP_OFFSET: each file's clip mask is
    // inset a different amount from its own canvas's edges, measured as
    // (X or Y of the clip polygon / viewBox width) * 8. "doom" (index 0) is
    // flush/reference. recklesscomic's canvas is unusually wide (1351 vs
    // ~1131-1137 for the others) with gaps on BOTH left and right of the
    // visible art (not just left) — Q5_RIGHT_OFFSET captures that so the
    // scale factor accounts for the full inset, not just one side.
    this.Q5_LEFT_OFFSET  = [0.0106, 0.0106, 0.0106, 0.5193, 0.1195];
    this.Q5_RIGHT_OFFSET = [7.9894, 7.9894, 7.9894, 7.2055, 7.8805];
    this.Q5_TOP_OFFSET   = [0.0144, 0.0144, 0.0144, 0.0121, 0.1515];
    // recklesscomic's box is inset 6.5% of its own width from the left, showcomic
    // ~1.9% — both were throwing off left-edge alignment with Q1.
    this.Q5_LEFT_OFFSET = [0.0106, 0.0106, 0.0106, 0.5193, 0.1195];

    // Speech bubble SVG files — small/medium/large by text length.
    // Tail is at bottom-right (designed for a right-side speaker / Q4).
    // The main character's bubble img has .bubble-svg-img-flip (scaleX(-1))
    // applied in CSS so the tail mirrors to point toward him on the left.
    this.BUBBLE_SVGS = [
      { file: 'speechbubble-27.svg', maxChars: 25  }, // small
      { file: 'speechbubble-26.svg', maxChars: 45  }, // medium
      { file: 'speechbubble-25.svg', maxChars: Infinity }, // large
    ];
    this.bubbleImgEl     = document.getElementById('comic-bubble-img');
    this.bubbleCharImgEl = document.getElementById('comic-bubble-char-img');
    this.causeTextEl     = document.getElementById('comic-cause-text');

    this._onResize = this._onResize.bind(this);
    // Nav arrows are the only way to move forward/backward through the comic.
    this.navForwardEl.addEventListener('click', () => this._navigate(1));
    this.navBackEl.addEventListener('click', () => this._navigate(-1));
    if (this.toResultsEl) this.toResultsEl.addEventListener('click', () => this._onToResults());

    // Dev preview: click any panel to cycle through its possible answers, so all
    // combinations can be checked without replaying the quiz.
    this.panelQ1.addEventListener('click', () => this._cyclePanel(0, this.Q1_FILES.length));
    this.panelQ4.addEventListener('click', () => this._cyclePanel(3, this.Q4_FILES.length));
    this.panelQ5.addEventListener('click', () => this._cyclePanel(4, this.Q5_FILES.length));
  }

  _pickBubbleSvg(text) {
    return this.BUBBLE_SVGS.find(b => text.length <= b.maxChars).file;
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
    window.addEventListener('resize', this._onResize);
    this.navBackEl.classList.add('visible');
    this.navForwardEl.classList.add('visible');
    // Auto-show the bubble after the slide-in animation settles (~2s).
    this._autoBubbleTimer = setTimeout(() => {
      this._autoBubble = true;
      this._render();
    }, 2200);
  }

  skipToEnd() {
    this._q3Revealed = 99;
    this.stage = this.STAGE_COUNT;
    this._render(false);
    this.screen.scrollTop = this.screen.scrollHeight;
  }

  jumpToResult() {
    this.skipToEnd();
    this.navBackEl.classList.remove('visible');
    this.navForwardEl.classList.remove('visible');
    this._exitSequenceActive = true;
    this._exitResultsStarted = true;
    // Pre-load result assets
    if (this._resultKey && typeof QUIZ_RESULTS !== 'undefined') {
      const r = QUIZ_RESULTS[this._resultKey];
      if (r) {
        this.resultArtEl.src          = r.art;
        this.resultCharEl.src         = r.char;
        this.resultDescEl.textContent = r.desc;
      }
    }
    if (this._resultKey) this.screen.classList.add('result-' + this._resultKey);
    this.comicSceneSnapshot = this.sceneEl.cloneNode(true);
    // Skip all exit animations — hide comic chrome, go straight to result page
    this.screen.classList.add('exiting');
    this.bgOverlayEl.classList.add('gradient-in', 'gradient-warm');
    this.characterEl.style.display = 'none';
    if (this.floatingCharEl) this.floatingCharEl.classList.add('char-gone');
    this._revealResults();
  }

  stop() {
    window.removeEventListener('resize', this._onResize);
    clearTimeout(this._resizeTimer);
    clearTimeout(this._autoBubbleTimer);
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
      if (this.stage >= 0 && this.stage < 3) this._layoutQ4Centered();
      this._layoutCharacterBubble();
      this._updateBubbleShapes();
    }, 100);
  }

  reset() {
    this.stop();
    this.stage = -1;
    this._autoBubble          = false;
    this._autoBubbleTimer     = null;
    this._legsRevealTimer     = null;
    this._legsRevealed        = false;
    this._q3Revealed          = 0;
    this._zoomSettled         = false;
    this._zoomSettleTimer     = null;
    this._exitSequenceActive  = false;
    this._exitResultsStarted  = false;
    this._resultKey           = null;
    this.comicSceneSnapshot   = null;
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
    this.screen.style.removeProperty('--char-w');
    this.screen.style.removeProperty('--char-left-rest');
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
    this.navBackEl.classList.remove('visible');
    this.navForwardEl.classList.remove('visible');
    if (this._svgLoaded) this._setGroups(this.DEFAULT_GROUPS);
    this._render(false);
  }

  // Driven by the two nav arrow buttons — dir=1 (forward) or dir=-1 (back).
  // Replaces the old scroll/whole-screen-click interaction; same pace as
  // before (one click = one stage), now with an actual back control.
  _navigate(dir) {
    // During the exit sequence, the nav arrows are hidden (see
    // _runExitSequence) — the reveal is driven by the "to the results"
    // button (see _onToResults) instead.
    if (this._exitSequenceActive) return;
    if (this._clickLocked) return;

    // One more forward step past the last stage kicks off the exit animation.
    if (dir > 0 && this.stage === this.STAGE_COUNT) {
      this._clickLocked = true;
      setTimeout(() => { this._clickLocked = false; }, 650);
      this._runExitSequence();
      return;
    }

    // Q3 multi-emotion: while on the zoomed-in beat with more than one
    // chosen emotion, forward/back steps through them (bubble text
    // REPLACED, pose swapped) before the stage itself advances/retreats.
    const q3list = this._getQ3List();
    if (this.stage === 4 && !this._zoomSettled) return;
    if (this.stage === 4 && q3list.length > 1) {
      if (dir > 0 && this._q3Revealed < q3list.length) {
        this._q3Revealed++;
        this._render();
        this._clickLocked = true;
        setTimeout(() => { this._clickLocked = false; }, 650);
        return;
      }
      if (dir < 0 && this._q3Revealed > 1) {
        this._q3Revealed--;
        this._render();
        this._clickLocked = true;
        setTimeout(() => { this._clickLocked = false; }, 650);
        return;
      }
    }

    let next = this.stage + dir;
    // Stage 6 has no visible content — skip it in both directions.
    if (next === 6) next += dir;
    if (next >= -1 && next <= this.STAGE_COUNT) {
      this._clickLocked = true;
      const prevStage = this.stage;
      this.stage = next;
      if (next === -1) this._autoBubble = false;
      this._render(true);
      // Zoom-out transition: lock shorter so next click isn't eaten
      const lockMs = (prevStage === 4 && next !== 4) ? 350 : 650;
      setTimeout(() => { this._clickLocked = false; }, lockMs);
    }
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

    // Capture the comic scene before panels slide away — used by the share viewer
    // comic slide. cloneNode(true) preserves all inline style transforms set by JS.
    this.comicSceneSnapshot = this.sceneEl.cloneNode(true);

    // Slide panels/chrome off top; hide bubbles.
    this.navBackEl.classList.remove('visible');
    this.navForwardEl.classList.remove('visible');
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
    this.characterEl.classList.toggle('nudged', this.stage >= 0 && this.stage <= 2);
    this.characterEl.classList.toggle('placed', this.stage >= 3);

    // Q4's speech bubble — both lines are spoken while the characters are
    // still centered together: "the world will end" (stage 2), then "it will
    // be caused by X" (stage 3). The bubble is cleared at stage 4 so it's
    // hidden during the shift-right move (which now happens alongside Q1).
    const showBubble = (this.stage === 0 && this._autoBubble && q4 !== null) || (this.stage === 1 && q4 !== null);
    const showLine2  = this.stage >= 1;
    const BUBBLE_LINE1 = 'The world will end,';
    const Q4_LINE2 = [
      { text: 'and the time for repentance has passed',          html: 'and the time for<br>repentance has passed' },       // pope
      { text: 'and I have made a lot of money betting on it',    html: 'and I have made a lot<br>of money betting on it' }, // bill
      { text: 'and nobody listened to me!',                      html: 'and nobody listened<br>to me!' },                    // conspiracy
      { text: 'I repeat, the World will end',                    html: 'I repeat, the World<br>will end' },                 // news
    ];
    const line2Data   = q4 !== null ? Q4_LINE2[q4] : { text: '', html: '' };
    const BUBBLE_LINE2 = line2Data.text;
    const BUBBLE_FULL  = BUBBLE_LINE1 + '\n' + BUBBLE_LINE2;
    if (showBubble) {
      this.bubbleLine1El.textContent = BUBBLE_LINE1;
      this.bubbleLine2El.innerHTML = line2Data.html;
      this.bubbleLine2El.classList.toggle('bubble-line2-hidden', !showLine2);
      // Always size the SVG for the full sentence so the bubble never resizes.
      this.bubbleImgEl.src = this._pickBubbleSvg(BUBBLE_FULL);
      this.bubbleEl.style.transition = '';
      this.bubbleEl.classList.add('visible');
    } else {
      this.bubbleLine1El.textContent = '';
      this.bubbleLine2El.textContent = '';
      this.bubbleEl.style.transition = 'none';
      this.bubbleEl.classList.remove('visible');
    }

    // Full-screen text: stage 2 = "it will be caused by X", stage 7 = "You will spend your final day X".
    let fullScreenText = '';
    if (this.stage === 2 && q1 !== null)
      fullScreenText = `it will be caused by ${this.Q1_CAPTION[q1]}`;
    else if (this.stage === 7 && q5 !== null)
      fullScreenText = `You will spend your final day ${this.Q5_CAPTION[q5]}`;
    this.causeTextEl.textContent = fullScreenText;
    this.causeTextEl.classList.toggle('visible', fullScreenText !== '');
    const hideForFullScreen = this.stage === 2 || this.stage === 7;
    this.characterEl.style.transition = hideForFullScreen ? 'none' : '';
    this.characterEl.style.opacity    = hideForFullScreen ? '0' : '';
    this.panelQ4.style.transition     = hideForFullScreen ? 'none' : '';
    this.panelQ4.style.opacity        = hideForFullScreen ? '0' : '';
    // Stage 7 also hides all comic panels so only the text + arrows remain.
    const hideAllPanels = this.stage === 7;
    this.panelQ1.style.transition  = hideAllPanels ? 'none' : '';
    this.panelQ1.style.opacity     = hideAllPanels ? '0' : '';
    this.boxQ4.style.transition    = hideAllPanels ? 'none' : '';
    this.boxQ4.style.opacity       = hideAllPanels ? '0' : '';
    this.panelQ5.style.transition  = hideAllPanels ? 'none' : '';
    this.panelQ5.style.opacity     = hideAllPanels ? '0' : '';
    if (this.footboxEl) {
      this.footboxEl.style.transition = hideAllPanels ? 'none' : '';
      this.footboxEl.style.opacity    = hideAllPanels ? '0' : '';
    }

    // Q4 panel — fades in near center at stage 1 (positioned by
    // _layoutQ4Centered), then shifts right with pink box at stage 4
    // (positioned by _layoutQ1Q5 from that point on).
    const showQ4 = this.stage >= 0 && q4 !== null;
    if (showQ4) this.panelQ4.src = this.Q4_FILES[q4];
    this.panelQ4.classList.toggle('visible', showQ4);
    // Pink box only appears once they shift right at stage 3.
    this.boxQ4.classList.toggle('visible', this.stage >= 3 && showQ4);

    // Q1 panel — top-left, appears at stage 3, together with the shift-right.
    const showQ1 = this.stage >= 3 && q1 !== null;
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
    const zoomedNow = this.stage === 4;
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

    // Main character's own speech bubble — the Q3 reaction at stage 5 shows
    // ONE emotion at a time (replaced, not stacked): the first reads "that
    // sounds stressful", each subsequent scroll replaces it with "and scary"
    // etc. Hides for the zoom out (stage 6), then reappears with "I will spend
    // my last day X" from stage 7 on.
    let charBubbleText = '';
    if (this.stage === 4 && q3list.length > 0 && this._zoomSettled) {
      const shown = Math.min(Math.max(this._q3Revealed, 1), q3list.length);
      const idx   = q3list[shown - 1];
      charBubbleText = shown === 1
        ? `that sounds\n${this.Q3_CAPTION[idx]}`
        : `and\n${this.Q3_CAPTION[idx]}`;
    }
    this.bubbleCharTextEl.innerHTML = charBubbleText.replace('\n', '<br>');
    if (!charBubbleText) this.bubbleCharEl.style.transition = 'none';
    else this.bubbleCharEl.style.transition = '';
    this.bubbleCharEl.classList.toggle('visible', charBubbleText !== '');
    if (charBubbleText) this.bubbleCharImgEl.src = this._pickBubbleSvg(charBubbleText);

    // Ground panel behind his legs — appears right at the zoom-in (not
    // delayed like the leg swap below) and then persists for the rest of the
    // scene, even once the camera zooms back out at stage 7.
    if (this.footboxEl) this.footboxEl.classList.toggle('visible', this.stage >= 4 && q3list.length > 0);

    // Q3 legs/face swap — click-driven (see _navigate). On first reaching stage
    // 5 the first chosen emotion shows (_q3Revealed 0 -> 1); each click
    // steps to the next. The pose always reflects the currently-shown emotion
    // and, once all are stepped through, persists through the later stages
    // (zoom out, Q5, ...). Dropping below stage 5 resets the count.
    if (this.stage >= 4 && q3list.length > 0) {
      if (this._q3Revealed === 0) this._q3Revealed = 1;
      const shown  = Math.min(Math.max(this._q3Revealed, 1), q3list.length);
      const latest = q3list[shown - 1];
      this._setGroups([this.Q3_LEGS[latest], this.Q3_FACE[latest]].filter(Boolean));
    } else {
      this._q3Revealed = 0;
      this._setGroups(this.DEFAULT_GROUPS);
    }

    // Q5 panel — bottom-left, appears at stage 8 (one stage after the char
    // bubble text at stage 7) and stays. Anchored directly on the bottom margin.
    const showQ5 = this.stage >= 8 && q5 !== null;
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
    if (showQ4 && this.stage < 3) this._layoutQ4Centered();
    else this.characterEl.style.left = ''; // clear centered override once placed
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
  // on-screen head position across screen sizes. Sits to his LEFT (used to
  // be his right, but the Q4 characters now extend further left with their
  // manual per-answer overrides — see Q4_OVERRIDE — and would sit on top of
  // /behind a right-side bubble either way, hiding the text). The tail-aim
  // math in _updateBubbleShapes targets the character dynamically via
  // atan2, so it points the right way regardless of which side the bubble
  // is on — no changes needed there.
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
    const width = vw * 0.38;
    // Bubble sits to the RIGHT of the character — the flipped SVG tail
    // (scaleX(-1) on .bubble-svg-img-flip) points left back toward his face.
    const overlap = char.width * 0.12; // slight overlap onto his shoulder
    const left = Math.min(char.right - overlap, vw - width - ph) - vw * 0.13;
    const top = headY - char.height * 0.13;

    this.bubbleCharEl.style.left = toVw(left);
    this.bubbleCharEl.style.width = toVw(width);
    this.bubbleCharEl.style.top = toVh(top);
  }

  // Positions Q4 in its "centered entry" position (stages 1-3), to the left
  // of the main character who has nudged slightly left. Both characters sit
  // roughly in the center of the screen together. At stage 4, _layoutQ1Q5
  // takes over and the CSS transition on left/width animates the slide right.
  _layoutQ4Centered() {
    const q4 = State.getAnswer(3);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const toVw = (px) => `${(px / vw) * 100}vw`;
    const toVh = (px) => `${(px / vh) * 100}vh`;

    const ph = vw * 0.02;
    const comicGap = 19;
    const col = (vw - 2 * ph - 11 * comicGap) / 12;
    const naturalUnit = col + comicGap;

    // Use the exact same character size as the resting state so nothing
    // resizes when it later shifts right.
    const charW    = Math.min(3.3 * naturalUnit, 0.74 * vh * 470.53 / 771.45);
    // Resting left (mirrors --char-left-rest / _layoutQ1Q5 at s=1).
    const restLeft = ph + 5.05 * naturalUnit;
    // Nudged left (mirrors .comic-character.nudged CSS rule).
    const nudgedLeft = vw / 2 - charW / 2 - naturalUnit;
    // Apply that same shift to Q4 so relative size/distance is identical.
    // Extra gap only in the centered intro view — widens the space between the
    // two characters without affecting resting positions on the actual comic page.
    // Per-character: pope/bill keep the default; con and news get more breathing room.
    const CENTERED_EXTRA_GAPS = [0.5, 0.5, 1.1, 1.1]; // pope, bill, con, news
    const CENTERED_EXTRA_GAP = naturalUnit * (q4 !== null ? CENTERED_EXTRA_GAPS[q4] : 0.5);
    const shift = nudgedLeft - restLeft + CENTERED_EXTRA_GAP;

    const q4Override = q4 !== null ? this.Q4_OVERRIDE[q4] : null;
    let q4Left, q4Width, q4Top, q4Height;
    if (q4Override) {
      q4Width  = parseFloat(q4Override.width)  / 100 * vw;
      q4Top    = q4Override.top;    // keep original vh value
      q4Height = q4Override.height; // keep original vh value
      q4Left   = parseFloat(q4Override.left) / 100 * vw + shift;
    } else {
      q4Width  = 3.75 * naturalUnit;
      q4Top    = '5.8vh';
      q4Height = toVh(vh * 0.848);
      q4Left   = restLeft + charW + col * 0.15 + shift;
    }

    // Bubble — same proportions as before, anchored to the shifted Q4 left.
    // Fixed vw width so text always fits regardless of q4Width.
    // Position so the tail (at the bubble's right side) sits against the pope,
    // making it visually clear who is speaking.
    const bubbleWidth = vw * 0.40;
    const q4TopPx     = parseFloat(q4Top) / 100 * vh;
    // Per-character bubble nudges [pope, bill, con, news] — left in vw%, top in vh%.
    const BUBBLE_LEFT_NUDGE = [0,    0,   -8,   -8  ]; // vw%
    const BUBBLE_TOP_NUDGE  = [0,   -9,   -6,   -6  ]; // vh%
    const leftNudge = q4 !== null ? BUBBLE_LEFT_NUDGE[q4] / 100 * vw : 0;
    const topNudge  = q4 !== null ? BUBBLE_TOP_NUDGE[q4]  / 100 * vh : 0;
    const bubbleLeft = q4Left + q4Width * 0.05 + leftNudge;
    const bubbleTop  = q4TopPx + vh * 0.03 + topNudge;

    // Re-center the pair for characters that have extra gap.
    // The nudged CSS puts the main character at 50% - charW/2 - 0.4*naturalUnit.
    const mainLeft   = vw / 2 - charW / 2 - naturalUnit * 0.4;
    const mainCenter = mainLeft + charW / 2;
    const q4Center   = q4Left + q4Width / 2;
    const pairCenter = (mainCenter + q4Center) / 2;
    // Per-character rightward shift of the whole pair after centering [pope, bill, con, news].
    const PAIR_OFFSET = [0, 0, 4, 4]; // vw%
    const pairShift = q4 !== null ? PAIR_OFFSET[q4] / 100 * vw : 0;
    const adj        = vw / 2 - pairCenter + pairShift;
    this.characterEl.style.left = toVw(mainLeft + adj);
    this.panelQ4.style.left   = toVw(q4Left + adj);
    this.panelQ4.style.width  = toVw(q4Width);
    this.panelQ4.style.top    = q4Top;
    this.panelQ4.style.height = q4Height;

    this.bubbleEl.style.left  = toVw(bubbleLeft + adj);
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
    const q4 = State.getAnswer(3);
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
      // Each Q1 file's clip mask (built in Illustrator) starts at a different
      // distance from its own canvas's top/left edges — Q1_TOP_OFFSET and
      // Q1_LEFT_OFFSET measure that per file. "humans" (index 0) is the
      // reference/role model (its mask sits flush against both edges).
      // Left: most files are already flush (offset ~= humans'), but
      // "god"'s mask is inset from its canvas's left edge, so its visible
      // art doesn't reach as far left as the others' — scale the whole
      // image up (bigger canvas = the same relative inset covers more
      // absolute pixels, pushing the visible edge left to match), then
      // shift left by the same amount added to width so the RIGHT edge
      // (already correct) doesn't move.
      const scale = (8 - this.Q1_LEFT_OFFSET[0]) / (8 - this.Q1_LEFT_OFFSET[q1]);
      const w1    = width * scale;
      const unit1 = unit * scale;
      const left1 = left - (w1 - width);
      // Top: shift so the VISIBLE artwork (not the invisible canvas) lines
      // up the same way humans' does, using this file's own (possibly
      // scaled) unit.
      const topPx = vh * 0.0513 + this.Q1_TOP_OFFSET[0] * unit - this.Q1_TOP_OFFSET[q1] * unit1;
      this.panelQ1.style.width = toVw(w1);
      this.panelQ1.style.top   = toVh(topPx);
      this.panelQ1.style.left  = toVw(left1);
      q1Right = left + width; // right edge unaffected by per-file scaling
    }
    if (q5 !== null) {
      const left = vw * 0.0191423;
      // Same per-file clip-mask correction as Q1, but scaled by the actual
      // visible-width fraction (right offset minus left offset) rather than
      // left offset alone — reckless has a gap on both sides of its art, so
      // a left-only scale under-sizes it and the right/bottom edges fall
      // short. "doom" (index 0) is the reference.
      const visFrac0 = this.Q5_RIGHT_OFFSET[0] - this.Q5_LEFT_OFFSET[0];
      const visFrac5 = this.Q5_RIGHT_OFFSET[q5] - this.Q5_LEFT_OFFSET[q5];
      const scale5 = visFrac0 / visFrac5;
      const w5     = width * scale5;
      const unit5  = unit * scale5;
      const left5  = left + this.Q5_LEFT_OFFSET[0] * unit - this.Q5_LEFT_OFFSET[q5] * unit5;
      const topPx5 = vh * 0.24 + this.Q5_TOP_OFFSET[0] * unit - this.Q5_TOP_OFFSET[q5] * unit5;
      this.panelQ5.style.width = toVw(w5);
      this.panelQ5.style.top   = toVh(topPx5);
      this.panelQ5.style.left  = toVw(left5);
      q5Right = left + width; // right edge unaffected by per-file scaling
    }

    // At stages 1-3, Q4 is in its centered entry position — _layoutQ4Centered
    // handles its left/width/top/height there. Skip all Q4/box/bubble
    // positioning here until stage 4 when they shift right together.
    if (this.stage < 3) return;

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
    const q4Override = q4 !== null ? this.Q4_OVERRIDE[q4] : null;
    if (q4Override) {
      this.panelQ4.style.left   = q4Override.left;
      this.panelQ4.style.width  = q4Override.width;
      this.panelQ4.style.top    = q4Override.top;
      this.panelQ4.style.height = q4Override.height;
    } else {
      this.panelQ4.style.left   = toVw(ph + naturalWidth * s + comicGap - 20);
      this.panelQ4.style.width  = toVw(3.75 * naturalUnit * s);
      this.panelQ4.style.top    = '5.8vh';
      this.panelQ4.style.height = toVh(boxHeight);
    }

    // Scale character geometry with s so the character and footbox stay
    // proportional to the panels. When s < 1 (panels shrink to fit a tall
    // Q1/Q5 answer), the CSS formula for --char-left-rest (which bakes in
    // s=1) would leave the character appearing "shifted right" into the pink
    // Q4 area. Overriding both vars here keeps everything in sync.
    const charW    = Math.min(3.3 * naturalUnit * s, 0.74 * vh * 470.53 / 771.45);
    const charLeft = ph + 5.05 * naturalUnit * s;
    this.screen.style.setProperty('--char-w',         `${charW}px`);
    this.screen.style.setProperty('--char-left-rest', toVw(charLeft));

    // Q4's speech bubble — sits to the LEFT of his box (not overlapping his
    // portrait), tail pointing right into the artwork.
    const BUBBLE_FACE_Y = 0.14;
    const BUBBLE_WIDTH_RATIO = 0.40;
    const bubbleWidth = width * BUBBLE_WIDTH_RATIO;
    const BUBBLE_GAP = -bubbleWidth * 0.45;
    const bubbleLeft  = boxLeft - BUBBLE_GAP - bubbleWidth;
    const bubbleTop   = vh * 0.066 + boxHeight * BUBBLE_FACE_Y;
    this.bubbleEl.style.left  = toVw(bubbleLeft);
    this.bubbleEl.style.width = toVw(bubbleWidth);
    this.bubbleEl.style.top   = toVh(bubbleTop);
  }
}
