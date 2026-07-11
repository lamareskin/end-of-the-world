(() => {
  // --- Elements ---
  const screenStart       = document.getElementById("screen-start");
  const screenPreQuestion = document.getElementById("screen-prequestion");
  const screenQuestion    = document.getElementById("screen-question");
  const screenLoading     = document.getElementById("screen-loading");
  const screenComicReveal = document.getElementById("screen-comic-reveal");

  const btnStart    = document.getElementById("btn-start");
  const btnHome     = document.getElementById("btn-home");
  const btnPrev     = document.getElementById("btn-prev");
  const btnNext     = document.getElementById("btn-next");
  const btnRestart     = document.getElementById("btn-restart");

  const progressTracker = document.getElementById("progress-tracker");
  const questionText    = document.getElementById("question-text");
  const illustrationImg = document.getElementById("illustration-img");
  const carouselEl      = document.getElementById("carousel");
  const questionIntro   = document.getElementById("question-intro");
  const carouselWrapper = document.querySelector(".carousel-wrapper");
  const artOverlay      = document.getElementById("art-overlay");
  const artImg          = document.getElementById("art-img");
  const qIntro          = document.getElementById("q-intro");
  const qIntroBg        = document.getElementById("q-intro-bg");
  const qIntroBig       = document.getElementById("q-intro-big");
  const qIntroHeading   = document.getElementById("q-intro-heading");
  const qIntroBlame     = document.getElementById("q-intro-blame");
  const qIntroTitle     = document.getElementById("q-intro-title");
  const centerHint      = document.getElementById("center-hint");

  const preComicStepA      = document.getElementById("preComic-stepA");
  const preComicStepB      = document.getElementById("preComic-stepB");
  const preComicQ2Line     = document.getElementById("preComic-q2Line");
  const preComicStepC      = document.getElementById("preComic-stepC");
  const preComicClickHint  = document.getElementById("preComic-clickHint");

  let carousel = null;
  let artTimer = null;
  let cleanupTimer = null;
  let _hintDismissHandler = null;

  const _svgUrl = svg => 'data:image/svg+xml,' + encodeURIComponent(svg);

  // Q3 art controller — manages the original q3-box slide animations
  const q3Art = (() => {
    const SLOTS = [
      { svg: 'stress.svg',  top: '15vh', bottom: '0',    left: '12vw', right: '12vw', hidden: 'translateY(110vh)',  fit: 'cover',   pos: 'top center'    },
      { svg: 'fear.svg',    top: '15vh', bottom: '0',    left: '16vw', right: '16vw', hidden: 'translateY(110vh)',  fit: 'cover',   pos: 'top center'    },
      { svg: 'denial.svg',  top: '15vh', bottom: '-6vh', left: '0',    right: '-6vw', hidden: 'translateX(110vw)',  fit: 'contain', pos: 'bottom right'  },
      { svg: 'relief.svg',  top: '15vh', bottom: '3vh',  left: '0',    right: '3vw',  hidden: 'translateX(-110vw)', fit: 'contain', pos: 'bottom left'   },
      { svg: 'shock.svg',   top: '15vh', bottom: '0',    left: '10vw', right: '10vw', hidden: 'translateY(110vh)',  fit: 'contain', pos: 'bottom center' },
    ];
    const overlay = document.getElementById('q3-overlay');
    const box     = document.getElementById('q3-box');
    let els          = [];
    let current      = -1;
    let _bubbleGrown = false;

    // small side-icons that appear next to the sidebar for non-active selections
    const sideIcons = []; // one per SLOT index, or null

    const ICON_W = 110; // width — wider than half-height makes it an elongated half-ellipse
    const ICON_H = 96; // full height (diameter)

    function _getOrCreateSideIcon(i) {
      if (sideIcons[i]) return sideIcons[i];

      // wrapper = the semicircle (flat right, round left)
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        position:      'fixed',
        width:         `${ICON_W}px`,
        height:        `${ICON_H}px`,
        borderRadius:  `${ICON_W}px 0 0 ${ICON_W}px`,
        background:    '#5e0015',
        zIndex:        '200',
        overflow:      'hidden',
        pointerEvents: 'none',
        transform:     'translateX(100%)',
        opacity:       '0',
        transition:    'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
      });

      const img = document.createElement('img');
      img.src = SLOTS[i].svg;
      img.draggable = false;
      Object.assign(img.style, {
        position:   'absolute',
        inset:      '18px',
        width:      'calc(100% - 36px)',
        height:     'calc(100% - 36px)',
        objectFit:  'contain',
        objectPosition: 'center',
        transform:  i === 1 ? 'rotate(-40deg)' : [0, 4].includes(i) ? 'rotate(-90deg)' : i === 3 ? 'scaleX(-1)' : 'none',
      });

      wrap.appendChild(img);
      document.body.appendChild(wrap);
      sideIcons[i] = wrap;
      return wrap;
    }

    function _positionSideIcon(i, chipEl) {
      if (!chipEl) return;
      const wrap = _getOrCreateSideIcon(i);
      const chipRect   = chipEl.getBoundingClientRect();
      const bubble     = document.querySelector('.sb-bubble.sb-multi-select');
      const bubbleLeft = bubble ? bubble.getBoundingClientRect().left : chipRect.left;
      wrap.style.top   = `${chipRect.top + chipRect.height / 2 - ICON_H / 2 + 12}px`;
      wrap.style.right = `${window.innerWidth - bubbleLeft - 40}px`;
      wrap.style.left  = 'auto';
    }

    function _showSideIcon(i, chipEl, delayAnimate) {
      const wrap = _getOrCreateSideIcon(i);
      if (!delayAnimate) {
        _positionSideIcon(i, chipEl);
        requestAnimationFrame(() => { wrap.style.transform = 'translateX(0)'; wrap.style.opacity = '1'; });
      }
      // if delayAnimate, positioning and animation happen later via afterGrow callback
    }

    function _hideSideIcon(i) {
      const wrap = sideIcons[i];
      if (!wrap) return;
      wrap.style.transform = 'translateX(100%)';
      wrap.style.opacity   = '0';
    }

    function _clearAllSideIcons() {
      sideIcons.forEach((el, i) => { if (el) _hideSideIcon(i); });
    }

    function _render() {
      box.innerHTML = '';
      els = SLOTS.map(s => {
        const wrap = document.createElement('div');
        wrap.className = 'q3-slot';
        Object.assign(wrap.style, { top: s.top, bottom: s.bottom, left: s.left, right: s.right, transform: s.hidden, transition: 'none' });
        const img = document.createElement('img');
        img.src = s.svg;
        img.className = 'q3-illustration';
        img.draggable = false;
        img.style.objectFit     = s.fit;
        img.style.objectPosition = s.pos;
        wrap.appendChild(img);
        box.appendChild(wrap);
        return { el: wrap, hidden: s.hidden };
      });
      current = -1;
    }

    // show(indices, chips) — indices is full selected array, last = active full illustration
    function show(indices, chips) {
      const all     = Array.isArray(indices) ? indices : [indices];
      const lastIdx = all.at(-1);

      // hide full illustration for anything no longer in selection
      const allSet = new Set(all);
      els.forEach((e, i) => {
        if (!allSet.has(i) && e) {
          e.el.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
          e.el.style.transform  = e.hidden;
        }
      });

      // show full illustration only for the last-clicked
      if (current !== lastIdx) {
        // slide out old full illustration (will become side icon if still selected)
        if (current !== -1 && els[current] && allSet.has(current)) {
          els[current].el.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
          els[current].el.style.transform  = els[current].hidden;
        }
        current = lastIdx;
        requestAnimationFrame(() => {
          els[lastIdx].el.style.transition = 'transform 0.4s cubic-bezier(0.4,0,0.2,1)';
          els[lastIdx].el.style.transform  = 'translate(0,0)';
        });
      }

      // Will the bubble grow this click?
      const willGrow = all.length >= 2 && !_bubbleGrown;

      // side icons: show for all selected except the last
      // If bubble is about to grow, delay animation until after grow completes
      SLOTS.forEach((_, i) => {
        if (allSet.has(i) && i !== lastIdx) {
          _showSideIcon(i, chips ? chips[i] : null, willGrow);
        } else {
          _hideSideIcon(i);
        }
      });

      // stretch active bubble when side icons appear (2+ selections)
      _setBubbleStretch(all.length, () => {
        // Reposition all side icons at final chip positions, then animate in
        SLOTS.forEach((_, i) => {
          if (allSet.has(i) && i !== lastIdx && chips && chips[i]) {
            _positionSideIcon(i, chips[i]);
            const wrap = sideIcons[i];
            if (wrap) requestAnimationFrame(() => { wrap.style.transform = 'translateX(0)'; wrap.style.opacity = '1'; });
          }
        });
      });
    }

    function _setBubbleStretch(count, afterGrow) {
      requestAnimationFrame(() => {
        const bubble   = document.querySelector('.sb-bubble.sb-multi-select');
        const chipList = document.querySelector('.sb-chip-list');
        if (!bubble) return;
        if (count >= 2) {
          const growing = !_bubbleGrown;
          _bubbleGrown = true;
          bubble.style.setProperty('--q3-bubble-grow', '2.5');
          if (chipList) chipList.style.gap = '36px';
          // If bubble just started growing, wait for transition; otherwise measure immediately
          if (afterGrow) growing ? setTimeout(afterGrow, 460) : requestAnimationFrame(afterGrow);
        } else {
          _bubbleGrown = false;
          bubble.style.removeProperty('--q3-bubble-grow');
          if (chipList) chipList.style.gap = '';
          if (afterGrow) requestAnimationFrame(afterGrow);
        }
      });
    }

    function hide() {
      _bubbleGrown = false;
      if (current !== -1 && els[current]) {
        els[current].el.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
        els[current].el.style.transform  = els[current].hidden;
        current = -1;
      }
      _clearAllSideIcons();
      _setBubbleStretch(0);
    }

    function init() {
      _render();
      overlay.style.display = 'block';
    }

    function cleanup() {
      hide();
      _clearAllSideIcons();
      setTimeout(() => { overlay.style.display = 'none'; }, 400);
    }

    return { init, show, hide, cleanup, resetStretch: () => _setBubbleStretch(0) };
  })();

  const q2Interaction = new Q2Interaction({
    overlay:            document.getElementById("q2-overlay"),
    animationContainer: document.getElementById("q2-animation"),
    illustrationImg,
    btnNext,
    onAnswer: (i) => State.setAnswer(i),
  });

  const q6Interaction = new Q6Interaction({
    overlay:            document.getElementById("q6-overlay"),
    animationContainer: document.getElementById("q6-animation"),
    btnNext,
    onAnswer: (i) => { State.setAnswer(i); },
  });

  const _dndShared = {
    overlay:        document.getElementById("q1-overlay"),
    dropZone:       document.getElementById("q1-drop-zone"),
    iconTray:       document.getElementById("q1-icon-tray"),
    circleText:     document.getElementById("q1-circle-text"),
    illustrationImg,
    btnNext,
    onAnswer: (i) => State.setAnswer(i),
  };

  const q1Interaction = new Q1Interaction({
    ..._dndShared,
    dropZone:     null,
    circleText:   null,
    activeClass:  'q1-active',
    accentColor:  '#5e0015',
    flatBg:       true,
    hoverPreview: true,
    onDropComplete: (index, floating, dzEl) => _lockAnswer(index, floating, dzEl),
    icons: [
      { icon: 'humanicon.svg',  illustration: 'humans.svg',        result: 'energetic',  text: 'Humans'  },
      { icon: 'aiicon.svg',     illustration: 'ai-screen.svg',     result: 'reflective', text: 'AI'      },
      { icon: 'cosmicicon.svg', illustration: 'cosmic-screen.svg', result: 'adaptive',   text: 'Cosmic'  },
      { icon: 'godicon.svg',    illustration: 'god-screen.svg',    result: 'dreamy',     text: 'God'     },
    ],
    titleConfigs: [
      { pink: 'Humans',         rest: ' will end the World'  },
      { pink: 'AI',             rest: ' will end the World'  },
      { pink: 'A cosmic Event', rest: ' will end the World'  },
      { pink: 'God',            rest: ' will end the World'  },
    ],
    defaultTitle: { pink: 'Who', rest: ' will end the World?' },
    illustrationSetup: (img, i) => {
      const titleEl = document.getElementById('question-text');
      if (i === null) { titleEl.classList.remove('title-god-shift'); return; }
      titleEl.classList.toggle('title-god-shift', i === 3);
      img.classList.add('q1-img');
      if (i === 0) img.classList.add('q1-img-humans');
      if (i === 1) img.classList.add('q1-img-ai');
      if (i === 2) img.classList.add('q1-img-cosmic');
      if (i === 3) img.classList.add('q1-img-god');
    },
  });

  const q4Interaction = new Q1Interaction({
    ..._dndShared,
    dropZone:     null,
    circleText:   null,
    activeClass:  'q4-active',
    accentColor:  '#5e0015',
    flatBg:       true,
    hoverPreview: true,
    onDropComplete: (index, floating, dzEl) => _lockAnswer(index, floating, dzEl),
    icons: [
      { icon: 'popeicon.svg', illustration: 'pope.svg',        result: 'spiritual', text: 'The Pope'              },
      { icon: 'billicon.svg', illustration: 'bill.svg',        result: 'rational',  text: 'Tech Billionaire'      },
      { icon: 'conicon.svg',  illustration: 'conspiracy.svg',  result: 'skeptical', text: 'conspiracy theorist'   },
      { icon: 'newsicon.svg', illustration: 'news.svg',        result: 'informed',  text: 'News network'          },
    ],
    titleConfigs: [
      { pink: 'The Pope',              rest: ' will break the News to you' },
      { pink: 'Tech Billionaire',      rest: ' will break the News to you' },
      { pink: 'conspiracy theorist',   rest: ' will break the News to you' },
      { pink: 'News network',          rest: ' will break the News to you' },
    ],
    defaultTitle: { pink: 'Who', rest: ' will break the News to you?' },
    illustrationSetup: (img, i) => {
      const titleEl = document.getElementById('question-text');
      if (i === null) {
        titleEl.classList.remove('title-news-shift');
        if (img) {
          img.style.width = '';
          img.style.height = '';
          img.style.padding = '';
          img.style.objectFit = '';
          img.style.objectPosition = '';
        }
        return;
      }
      titleEl.classList.toggle('title-news-shift', i === 3);
      if (img) {
        img.classList.toggle('q4-img-pope', i === 0);
        img.classList.toggle('q4-img-con',  i === 2);
        img.classList.toggle('q4-img-news', i === 3);
        img.classList.toggle('ill-pope', i === 0);
        img.classList.toggle('ill-2', i === 1);
        img.classList.toggle('ill-3', i === 2);
        img.classList.toggle('ill-4', i === 3);
        img.style.width = '';
        img.style.height = '';
        img.style.padding = '';
        img.style.objectFit = '';
        img.style.objectPosition = '';
      }
    },
  });

  // Q5 art controller — manages the original q5-box lottie/video animations
  const q5Art = (() => {
    const SLOTS = [
      { type: 'lottie', dataVar: 'DOOM_DATA',   top: '10vh',  bottom: '0',    left: '0',    right: 'calc(100vw / 12)'  },
      { type: 'lottie', dataVar: 'NATURE_DATA', top: '-5vh',  bottom: '-5vh', left: '-5vw', right: '-5vw' },
      { type: 'lottie', dataVar: 'LOVED_DATA',  top: '-5vh',  bottom: '-5vh', left: '-5vw', right: '-5vw' },
      { type: 'video',  src: 'reckless.mp4',    top: '15vh',  bottom: '0',    left: '0',    right: '0'    },
      { type: 'lottie', dataVar: 'SHOW_DATA',   top: '15vh',  bottom: '0',    left: '0',    right: '3vw'  },
    ];
    const overlay   = document.getElementById('q5-overlay');
    const box       = document.getElementById('q5-box');
    const DUR       = '0.4s cubic-bezier(0.4,0,0.2,1)';
    let els         = [];
    let animCache   = {};
    let current     = -1;

    function _playAnim(i) {
      if (SLOTS[i].type === 'video') {
        const v = els[i] && els[i].querySelector('video');
        if (v) v.play();
      } else {
        if (animCache[i]) animCache[i].play();
      }
    }

    function _stopAnim(i) {
      if (SLOTS[i].type === 'video') {
        const v = els[i] && els[i].querySelector('video');
        if (v) { v.pause(); v.currentTime = 0; }
      } else {
        if (animCache[i]) animCache[i].stop();
      }
    }

    function _render() {
      Object.values(animCache).forEach(a => a && a.destroy && a.destroy());
      animCache = {};
      box.innerHTML = '';
      els = SLOTS.map((s, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'q5-slot';
        Object.assign(wrap.style, { position: 'absolute', top: s.top, bottom: s.bottom, left: s.left, right: s.right, transform: 'translateX(110vw)', transition: 'none' });

        if (s.type === 'video') {
          const video = document.createElement('video');
          video.src = s.src; video.loop = true; video.muted = true; video.playsInline = true;
          video.className = 'q5-media';
          wrap.appendChild(video);
        } else {
          const container = document.createElement('div');
          container.className = 'q5-anim-container';
          wrap.appendChild(container);
          animCache[i] = lottie.loadAnimation({
            container, renderer: 'svg', loop: true, autoplay: false,
            animationData: window[s.dataVar],
          });
        }

        box.appendChild(wrap);
        return wrap;
      });
      current = -1;
    }

    function show(i) {
      if (current === i) return;
      const prev = current;
      current = i;

      if (prev !== -1 && els[prev]) {
        _stopAnim(prev);
        els[prev].style.transition = `transform ${DUR}`;
        els[prev].style.transform  = 'translateX(-110vw)';
        const prevRef = prev;
        setTimeout(() => {
          if (els[prevRef]) { els[prevRef].style.transition = 'none'; els[prevRef].style.transform = 'translateX(110vw)'; }
        }, 410);
      }

      if (i >= 0 && els[i]) {
        els[i].style.transition = `transform ${DUR}`;
        els[i].style.transform  = 'translateX(0)';
        _playAnim(i);
      }
    }

    function hide() {
      if (current !== -1 && els[current]) {
        _stopAnim(current);
        els[current].style.transition = `transform ${DUR}`;
        els[current].style.transform  = 'translateX(-110vw)';
        current = -1;
      }
    }

    function init() {
      _render();
      overlay.style.display = 'block';
    }

    function cleanup() {
      hide();
      setTimeout(() => { overlay.style.display = 'none'; }, 410);
    }

    return { init, show, hide, cleanup };
  })();

  const q3DndInteraction = new Q1Interaction({
    ..._dndShared,
    dropZone:     null,
    circleText:   null,
    activeClass:  'q3dnd-active',
    accentColor:  '#5c4a00',
    flatBg:       true,
    hoverPreview: true,
    onDropComplete: (index, floating, dzEl) => _lockAnswer(index, floating, dzEl),
    illustrationSetup: (img, i) => {
      if (img) img.style.display = 'none';
      if (i === null || i === undefined) { q3Art.hide(); return; }
      q3Art.show(i);
    },
    icons: [
      { icon: 'stress.svg',  illustration: 'stress.svg',  result: 'stressed', text: 'Stress' },
      { icon: 'fear.svg',    illustration: 'fear.svg',    result: 'fearful',  text: 'Fear'   },
      { icon: 'denial.svg',  illustration: 'denial.svg',  result: 'denial',   text: 'Denial' },
      { icon: 'relief.svg',  illustration: 'relief.svg',  result: 'relieved', text: 'Relief' },
      { icon: 'shock.svg',   illustration: 'shock.svg',   result: 'shocked',  text: 'Shock'  },
    ],
    titleConfigs: [
      { pink: 'Stress', rest: ' will be your immediate reaction' },
      { pink: 'Fear',   rest: ' will be your immediate reaction' },
      { pink: 'Denial', rest: ' will be your immediate reaction' },
      { pink: 'Relief', rest: ' will be your immediate reaction' },
      { pink: 'Shock',  rest: ' will be your immediate reaction' },
    ],
    defaultTitle: { pink: 'What', rest: ' is your immediate reaction' },
  });

  const q5DndInteraction = new Q1Interaction({
    ..._dndShared,
    dropZone:     null,
    circleText:   null,
    activeClass:  'q5dnd-active',
    accentColor:  '#5c4a00',
    flatBg:       true,
    hoverPreview: true,
    onDropComplete: (index, floating, dzEl) => _lockAnswer(index, floating, dzEl),
    illustrationSetup: (img, i) => {
      if (img) img.style.display = 'none';
      if (i === null || i === undefined) { q5Art.hide(); return; }
      q5Art.show(i);
    },
    icons: [
      { icon: _svgUrl(window.ICON_DOOM),     illustration: '', result: 'energetic',  text: 'Doomscrolling'            },
      { icon: _svgUrl(window.ICON_NATURE),   illustration: '', result: 'dreamy',     text: 'with Nature'              },
      { icon: _svgUrl(window.ICON_LOVED),    illustration: '', result: 'reflective', text: 'with loved ones'          },
      { icon: _svgUrl(window.ICON_RECKLESS), illustration: '', result: 'adaptive',   text: 'doing something Reckless' },
      { icon: _svgUrl(window.ICON_SHOW),     illustration: '', result: 'bold',       text: 'preparing for the show'   },
    ],
    titleConfigs: [
      { pink: 'Doomscrolling',              rest: '' },
      { pink: 'with Nature',                rest: '' },
      { pink: 'with loved ones',            rest: '' },
      { pink: 'doing something Reckless',   rest: '' },
      { pink: 'preparing for the show',     rest: '' },
    ],
    defaultTitle: { pink: 'How', rest: ' will you spend your final day' },
  });

  const sidebarInteraction = new SidebarInteraction({
    questionConfigs: [
      // Q1 — who will end the world
      {
        type: 'click-icons',
        icons: [
          { icon: 'humanicon.svg',  illustration: 'humans.svg',        text: 'Humans'  },
          { icon: 'aiicon.svg',     illustration: 'ai-screen.svg',     text: 'AI'      },
          { icon: 'cosmicicon.svg', illustration: 'cosmic-screen.svg', text: 'A cosmic event'  },
          { icon: 'godicon.svg',    illustration: 'god-screen.svg',    text: 'God'     },
        ],
        titleConfigs: [
          { pink: 'Humans',         rest: ' will end the World' },
          { pink: 'AI',             rest: ' will end the World' },
          { pink: 'A cosmic Event', rest: ' will end the World' },
          { pink: 'God',            rest: ' will end the World' },
        ],
        defaultTitle: { pink: 'Who', rest: ' will end the World?' },
        onHover: (i, selectedIndex) => {
          if (qIntro.style.display === 'none') return;
          const names = ['Humans', 'AI', 'A cosmic Event', 'God'];
          if (names[i]) qIntroTitle.innerHTML = names[i];
        },
        onHoverEnd: (selectedIndex) => {
          if (qIntro.style.display === 'none') return;
          qIntroTitle.innerHTML = 'Who will end the World?';
        },
        onEnter: (img, i, item) => {
          if (qIntro.style.display !== 'none') {
            // Build the full sentence directly so we don't copy the short hover text
            const t = [
              { pink: 'Humans',         rest: ' will end the World' },
              { pink: 'AI',             rest: ' will end the World' },
              { pink: 'A cosmic Event', rest: ' will end the World' },
              { pink: 'God',            rest: ' will end the World' },
            ][i];
            if (t) questionText.innerHTML = `<span class="q1-pink-word">${t.pink}</span>${t.rest}`;
            _dismissIntro(QUESTIONS[0]);
          }
          img.classList.remove('q1-img', 'q1-img-humans', 'q1-img-ai', 'q1-img-cosmic', 'q1-img-god');
          img.src = item.illustration;
          img.style.display = '';
          img.classList.add('q1-img');
          img.classList.toggle('q1-img-humans', i === 0);
          img.classList.toggle('q1-img-ai',     i === 1);
          img.classList.toggle('q1-img-cosmic',  i === 2);
          img.classList.toggle('q1-img-god',    i === 3);
          questionText.classList.toggle('title-god-shift', i === 3);
        },
        onLeave: (img) => {
          img.src = '';
          img.style.display = 'none';
          img.classList.remove('q1-img', 'q1-img-humans', 'q1-img-ai', 'q1-img-cosmic', 'q1-img-god');
          questionText.classList.remove('title-god-shift');
        },
      },
      // Q2 — when will the world end (slider)
      {
        type: 'slider',
        sliderRef: q2Interaction,
        stages: [0, 30, 60, 90, 120],
        maxFrame: 120,
        answerIcon: 'clock.svg',
        answerIcons: ['5year.svg', '20years.svg', '60years.svg', 'oldage.svg'],
        defaultTitle: { pink: 'When', rest: ' will the world end?' },
        titleConfigs: [
          { pink: 'In 5 years',    rest: ' the world will end' },
          { pink: 'In 20 years',   rest: ' the world will end' },
          { pink: 'In 60 years',   rest: ' the world will end' },
          { pink: "When I'm too old to care", rest: ', the world ends' },
        ],
      },
      // Q3 — reaction (multi-select)
      {
        type: 'multi-select',
        words: [
          { label: 'Stress', icon: 'smallstress.svg' },
          { label: 'Fear',   icon: 'smallfear.svg'   },
          { label: 'Denial', icon: 'smalldenial.svg' },
          { label: 'Relief', icon: 'smallrelief.svg' },
          { label: 'Shock',  icon: 'smallshock.svg'  },
        ],
        defaultTitle: { pink: 'What', rest: ' will be your reaction to the end of the world?' },
        titleConfigs: [
          { pink: 'Stress', rest: ' will be your reaction' },
          { pink: 'Fear',   rest: ' will be your reaction' },
          { pink: 'Denial', rest: ' will be your reaction' },
          { pink: 'Relief', rest: ' will be your reaction' },
          { pink: 'Shock',  rest: ' will be your reaction' },
        ],
        onExpand:       () => q3Art.init(),
        onCollapse:     () => q3Art.cleanup(),
        onWordClick:    (i, selected, chips) => q3Art.show(selected, chips),
        onAllDeselected: () => { q3Art.hide(); q3Art.resetStretch(); },
        onLeave:        () => q3Art.hide(),
      },
      // Q4 — who breaks the news
      {
        type: 'icons',
        icons: [
          { icon: 'popeicon.svg', illustration: 'pope.svg',       text: 'The Pope'            },
          { icon: 'billicon.svg', illustration: 'bill.svg',       text: 'Tech Billionaire'    },
          { icon: 'conicon.svg',  illustration: 'conspiracy.svg', text: 'conspiracy theorist' },
          { icon: 'newsicon.svg', illustration: 'news.svg',       text: 'News network'        },
        ],
        titleConfigs: [
          { pink: '', rest: 'The Pope'              },
          { pink: '', rest: 'A Tech Billionaire'    },
          { pink: '', rest: 'A conspiracy theorist' },
          { pink: '', rest: 'A News network'        },
        ],
        defaultTitle: { pink: '', rest: 'Who will break the News to you?' },
        onHover: (i, selectedIndex) => {
          if (qIntro.style.display === 'none') return;
          const names = ['The Pope', 'A Tech Billionaire', 'A conspiracy theorist', 'A News network'];
          if (names[i]) qIntroTitle.innerHTML = names[i];
        },
        onHoverEnd: (selectedIndex) => {
          if (qIntro.style.display === 'none') return;
          qIntroTitle.innerHTML = 'Who will break the News to you?';
        },
        onEnter: (img, i, item) => {
          if (qIntro.style.display !== 'none') _dismissIntro(QUESTIONS[3]);
          const q4FullTitles = [
            { pink: 'The Pope',              rest: ' will break the News to you' },
            { pink: 'A Tech Billionaire',    rest: ' will break the News to you' },
            { pink: 'A conspiracy theorist', rest: ' will break the News to you' },
            { pink: 'A News network',        rest: ' will break the News to you' },
          ];
          const ft = q4FullTitles[i];
          if (ft) questionText.innerHTML = `<span class="q1-pink-word">${ft.pink}</span>${ft.rest}`;
          questionText.style.transition = 'none';
          questionText.style.opacity = '1';
          img.classList.remove('q4-img-pope', 'q4-img-con', 'q4-img-news', 'ill-pope', 'ill-2', 'ill-3', 'ill-4');
          if (i === 1) { img.src = ''; img.getBoundingClientRect(); }
          img.src = item.illustration;
          img.style.display = '';
          img.classList.toggle('q4-img-pope', i === 0);
          img.classList.toggle('q4-img-con',  i === 2);
          img.classList.toggle('q4-img-news', i === 3);
          img.classList.toggle('ill-pope', i === 0);
          img.classList.toggle('ill-2', i === 1);
          img.classList.toggle('ill-3', i === 2);
          img.classList.toggle('ill-4', i === 3);
          questionText.classList.toggle('title-news-shift', i === 3);
        },
        onLeave: (img) => {
          img.src = '';
          img.style.display = 'none';
          img.classList.remove('q4-img-pope', 'q4-img-con', 'q4-img-news', 'ill-pope', 'ill-2', 'ill-3', 'ill-4');
          questionText.classList.remove('title-news-shift');
        },
      },
      // Q5 — how will you spend your final day
      {
        type: 'wheel',
        icons: [
          { icon: _svgUrl(window.ICON_DOOM),     text: 'Doomscrolling'            },
          { icon: _svgUrl(window.ICON_NATURE),   text: 'with Nature'              },
          { icon: _svgUrl(window.ICON_LOVED),    text: 'with loved ones'          },
          { icon: _svgUrl(window.ICON_RECKLESS), text: 'doing something Reckless' },
          { icon: _svgUrl(window.ICON_SHOW),     text: 'preparing for the show'   },
        ],
        titleConfigs: [
          { pink: 'Doomscrolling',              rest: '' },
          { pink: 'with Nature',                rest: '' },
          { pink: 'with loved ones',            rest: '' },
          { pink: 'doing something Reckless',   rest: '' },
          { pink: 'preparing for the show',     rest: '' },
        ],
        defaultTitle: { pink: 'How', rest: ' will you spend your final day?' },
        onExpand:    () => q5Art.init(),
        onCollapse:  () => q5Art.cleanup(),
        onCentered:  (i) => q5Art.show(i),
        onLeave:     () => q5Art.hide(),
      },
      // Q6 — was it all a simulation (slider)
      {
        type: 'slider',
        sliderRef: q6Interaction,
        stages: [0, 15, 30, 45, 60],
        stageFrames: [0, 0, 15, 30, 60],
        maxFrame: 60,
        answerIcon: 'sword.svg',
        answerIcons: ['1.svg', '2.svg', '3.svg', '4.svg'],
        knobIcon: 'sword.svg',
        defaultTitle: { prefix: 'Do you think the world will be ', pink: 'a simulation', rest: '?' },
        titleConfigs: [
          { prefix: '', pink: 'No', rest: '' },
          { prefix: 'I don\'t have an ', pink: 'opinion', rest: '' },
          { prefix: '', pink: 'Yes', rest: '' },
          { prefix: '', pink: 'Definitely', rest: '' },
        ],
      },
    ],
    illustrationImg,
    titleEl:   questionText,
    onSelect:  (qIndex, answerIndex) => State.setAnswer(answerIndex),
    onAdvance: () => _advanceQuestion(),
  });

  const comicReveal = new ComicRevealInteraction({
    screen:      screenComicReveal,
    sceneEl:     document.getElementById('comic-scene'),
    titleEl:     document.getElementById('comic-title'),
    titleBoxEl:     document.getElementById('comic-title-box'),
    inboxCaptionEl: document.getElementById('comic-inbox-caption'),
    characterEl: document.getElementById('comic-character'),
    floatingCharEl: document.getElementById('comic-character-floating'),
    panelQ1:     document.getElementById('comic-panel-q1'),
    panelQ4:     document.getElementById('comic-panel-q4'),
    panelQ5:     document.getElementById('comic-panel-q5'),
    boxQ4:       document.getElementById('comic-panel-box-q4'),
    footboxEl:   document.getElementById('comic-footbox'),
    navBackEl:    document.getElementById('comic-nav-back'),
    navForwardEl: document.getElementById('comic-nav-forward'),
    introHintEl: document.getElementById('comic-intro-hint'),
    bubbleEl:      document.getElementById('comic-bubble'),
    bubbleTextEl:  document.getElementById('comic-bubble-text'),
    bubbleLine1El: document.getElementById('comic-bubble-line1'),
    bubbleLine2El: document.getElementById('comic-bubble-line2'),
    bubbleCharEl:     document.getElementById('comic-bubble-char'),
    bubbleCharTextEl: document.getElementById('comic-bubble-char-text'),
    shapeQ4El:   document.getElementById('comic-bubble-shape'),
    shapeCharEl: document.getElementById('comic-bubble-shape-char'),
    bgOverlayEl:      document.getElementById('comic-bg-overlay'),
    globeEl:          document.getElementById('comic-exit-globe'),
    globeResultArtEl: document.getElementById('comic-exit-result-art'),
    resultCharEl:     document.getElementById('comic-result-char-img'),
    resultEyebrowEl:  document.getElementById('comic-result-eyebrow'),
    resultArtEl:      document.getElementById('comic-result-art'),
    resultDescEl:     document.getElementById('comic-result-desc'),
    resultStatEl:     document.getElementById('comic-result-stat'),
    toResultsEl:      document.getElementById('comic-to-results'),
    starsCanvasEl:    document.getElementById('comic-stars-canvas'),
  });

  comicReveal.onProgressStep = () => sidebarInteraction.advanceProgress();
  comicReveal.onResultsShown = () => sidebarInteraction.dismissProgress();

  const shareViewer = new ShareViewer({ comicReveal });

  const _dndMap   = { q1: q1Interaction, q4: q4Interaction, q3dnd: q3DndInteraction, q5dnd: q5DndInteraction };
  const _scrubMap = { q2: q2Interaction, q6: q6Interaction };
  const _swipeMap  = {};
  const _lottieMap = {};

  // --- Screen transitions ---
  function showScreen(screen) {
    [screenStart, screenPreQuestion, screenQuestion, screenLoading, screenComicReveal].forEach(s => s.classList.remove("active"));
    screen.classList.add("active");
  }

  // --- Progress tracker ---
  let progressDots = [];
  function renderProgress() {
    if (progressTracker) {
      progressTracker.innerHTML = "";
      progressDots = [];
      const n = State.currentQuestion;
      for (let i = 0; i < State.totalQuestions; i++) {
        const dot = document.createElement("div");
        const classes = ['progress-dot'];
        if (i === n) classes.push('current');
        if (i < n || State.getAnswer(i) !== null) classes.push('answered');
        dot.className = classes.join(' ');
        progressTracker.appendChild(dot);
        progressDots.push(dot);
      }
    }
    sidebarInteraction.updateDots(State.currentQuestion);
  }

  // --- Illustration swap ---
  function setIllustration(assetPath) {
    illustrationImg.classList.add("fade-out");
    setTimeout(() => {
      illustrationImg.src = assetPath;
      const isDoom     = assetPath.endsWith("doom.png");
      const isLoved    = assetPath.endsWith("loved.png");
      const isNature   = assetPath.endsWith("nature.png");
      const isReckless = assetPath.endsWith("reckless.png");
      illustrationImg.classList.toggle("doom-img",     isDoom);
      illustrationImg.classList.toggle("loved-img",    isLoved);
      illustrationImg.classList.toggle("nature-img",   isNature);
      illustrationImg.classList.toggle("reckless-img", isReckless);
      illustrationImg.classList.toggle("full-bleed",   false);
      illustrationImg.onload = () => illustrationImg.classList.remove("fade-out");
      illustrationImg.onerror = () => {
        illustrationImg.src = "";
        illustrationImg.classList.remove("fade-out");
      };
    }, 150);
  }

  // --- Center hint (Q1, Q3, Q4, Q5) ---
  function _showHint(text) {
    if (!centerHint) return;
    if (_hintDismissHandler) {
      screenQuestion.removeEventListener('mousedown', _hintDismissHandler);
    }
    centerHint.textContent = text;
    centerHint.classList.remove('hint-gone');
    centerHint.classList.add('hint-visible');
    _hintDismissHandler = () => {
      centerHint.classList.add('hint-gone');
      screenQuestion.removeEventListener('mousedown', _hintDismissHandler);
      _hintDismissHandler = null;
    };
    screenQuestion.addEventListener('mousedown', _hintDismissHandler, { once: true });
  }

  function _hideHint() {
    if (!centerHint) return;
    if (_hintDismissHandler) {
      screenQuestion.removeEventListener('mousedown', _hintDismissHandler);
      _hintDismissHandler = null;
    }
    centerHint.classList.remove('hint-visible', 'hint-gone');
  }

  // --- Apply per-question style and show relevant interaction ---
  function applyQuestionStyle(q) {
    screenQuestion.style.background = q.background || "var(--bg)";
    Object.values(_dndMap).forEach(d => d.hide());
    Object.values(_scrubMap).forEach(d => d.hide());
    q3Art.cleanup();
    q5Art.cleanup();

    carouselWrapper.style.display = "none";
    illustrationImg.src = '';
    illustrationImg.style.display = 'none';
    _hideHint();

    if (q.id === 1) q2Interaction.showSidebarMode();
    else if (q.id === 5) q6Interaction.showSidebarMode();
  }

  // --- Answer selected (carousel questions) ---
  function onAnswerSelect(index) {
    State.setAnswer(index);
    const q = QUESTIONS[State.currentQuestion];
    if (!q.noCarousel) setIllustration(q.answers[index].asset);
  }

  // --- Results ---
  // Q3 is multi-select, so an answer may be a single index or an array of
  // indices — normalise to an array before looking up quizResult(s).
  function _answerIndices(qi) {
    const raw = State.getAnswer(qi);
    if (raw === null || raw === undefined) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  function computeResult() {
    const votes = { nonchalant: 0, clueless: 0, knowitall: 0, runaway: 0 };

    for (let qi = 0; qi < QUESTIONS.length; qi++) {
      for (const idx of _answerIndices(qi)) {
        const ans = QUESTIONS[qi].answers[idx];
        if (ans && ans.quizResult) votes[ans.quizResult]++;
      }
    }

    const max = Math.max(...Object.values(votes));
    const tied = Object.keys(votes).filter(k => votes[k] === max);
    if (tied.length === 1) return tied[0];

    // Tiebreaker: latest question's answer wins
    for (let qi = QUESTIONS.length - 1; qi >= 0; qi--) {
      for (const idx of _answerIndices(qi)) {
        const ans = QUESTIONS[qi].answers[idx];
        if (ans && ans.quizResult && tied.includes(ans.quizResult)) return ans.quizResult;
      }
    }

    return tied[0];
  }


  // ===================== PRE-COMIC TEXT SEQUENCE =====================

  // Q2 ("when will the world end?") answer -> the pre-comic statement.
  // Answers 0-2 ("In 5 years" etc.) just get prefixed; answer 3 ("When I'm
  // too old to care") reads badly with that same prefix, so it gets its own
  // full sentence instead.
  function _q2Sentence() {
    const idx = State.getAnswer(1);
    if (idx === null || idx === undefined) return '';
    if (idx === 3) return "Someday when you're too old to care,";
    const t = QUESTIONS[1].answers[idx].text;
    const tCap = t.charAt(0).toUpperCase() + t.slice(1);
    return `<span style="white-space:nowrap">Some random day</span><br>${tCap},`;
  }

  // Q4 ("who breaks the news?") answer -> the pre-comic statement. Each
  // answer needs its own article/casing to read naturally.
  function _q4Sentence() {
    const idx = State.getAnswer(3);
    if (idx === null || idx === undefined) return '';
    const phrasing = [
      'The Pope',
      'The Tech Billionaire',
      'A conspiracy theorist',
      'The News network',
    ];
    return `${phrasing[idx]}<br>will tell you...`;
  }

  let _preComicTimer    = null;
  let _preComicClickCb  = null; // set while waiting for a user click

  // Waits for ms with no click-skip (used for the loading step).
  function _preComicDelay(ms) {
    return new Promise((resolve) => {
      clearTimeout(_preComicTimer);
      _preComicTimer = setTimeout(resolve, ms);
    });
  }

  // Waits until the user clicks anywhere on the screen.
  function _preComicWaitClick() {
    return new Promise((resolve) => {
      _preComicClickCb = () => {
        _preComicClickCb = null;
        resolve();
      };
    });
  }

  screenLoading.addEventListener('click', () => {
    if (_preComicClickCb) {
      const cb = _preComicClickCb;
      _preComicClickCb = null;
      cb();
    }
  });

  // Sequence:
  //   [blank] — waits for readyPromise (sidebar exit animation done)
  //   Step A — "let's see what you answered" fades in; click to advance.
  //   Step B — someday text (Q2) fades in big. "click to continue" hint appears.
  //            First click → Q4 line fades in below it.
  //            Second click → everything fades out, onDone() called.
  async function _runPreComicSequence(readyPromise, onDone) {
    // Wait for sidebar vertical-stretch start before showing anything
    await readyPromise;

    // Init progress — 3 loading clicks + 8 comic stages + q3 extras + 1 result trigger
    const q3Raw    = State.getAnswer(2);
    const q3List   = Array.isArray(q3Raw) ? q3Raw : (q3Raw !== null ? [q3Raw] : []);
    const q3Extras = Math.max(0, q3List.length - 1);
    sidebarInteraction.initProgress(3 + 8 + q3Extras + 1);

    // Step A: "let's see your answers" + click hint
    preComicStepA.classList.add('visible');
    preComicClickHint.classList.add('visible');
    screenLoading.style.cursor = 'pointer';
    await _preComicWaitClick();
    sidebarInteraction.advanceProgress(); // step 1
    screenLoading.style.cursor = 'default';
    preComicStepA.classList.remove('visible');
    preComicClickHint.classList.remove('visible');
    await _preComicDelay(600);

    // Steps B1 / B2 — nav arrows drive navigation, not screen clicks
    const navArrowsEl = document.getElementById('comic-nav-arrows');
    const navFwdEl    = document.getElementById('comic-nav-forward');
    const navBackEl   = document.getElementById('comic-nav-back');

    // Helper: waits for a nav arrow click, intercepts before comic-reveal handles it.
    // Returns 'forward' or 'back'.
    function _waitNavClick(allowBack) {
      return new Promise(resolve => {
        function onFwd(e) {
          e.stopImmediatePropagation();
          navFwdEl.removeEventListener('click', onFwd, true);
          navBackEl.removeEventListener('click', onBack, true);
          resolve('forward');
        }
        function onBack(e) {
          e.stopImmediatePropagation();
          navFwdEl.removeEventListener('click', onFwd, true);
          navBackEl.removeEventListener('click', onBack, true);
          resolve('back');
        }
        navFwdEl.addEventListener('click', onFwd, true);
        if (allowBack) navBackEl.addEventListener('click', onBack, true);
      });
    }

    // Prepare text content
    preComicQ2Line.innerHTML   = _q2Sentence();
    preComicStepC.innerHTML    = _q4Sentence();

    // B1: Q2 line alone, forward arrow only
    preComicStepB.classList.add('visible');
    preComicQ2Line.classList.add('visible');
    navFwdEl.classList.add('visible');

    await _waitNavClick(false);
    sidebarInteraction.advanceProgress(); // step 2

    // B2: Q4 line appears below, back arrow becomes visible too.
    // Clicking back returns to B1; clicking forward exits to comic.
    let inB2 = true;
    preComicStepC.classList.add('visible');
    navBackEl.classList.add('visible');

    while (true) {
      if (inB2) {
        const dir = await _waitNavClick(true);
        if (dir === 'forward') break; // done — exit to comic
        // back: collapse to B1
        preComicStepC.classList.remove('visible');
        navBackEl.classList.remove('visible');
        inB2 = false;
      } else {
        // B1: only forward available
        await _waitNavClick(false);
        preComicStepC.classList.add('visible');
        navBackEl.classList.add('visible');
        inB2 = true;
      }
    }

    sidebarInteraction.advanceProgress(); // step 3

    // Fade everything out and go to comic
    navFwdEl.classList.remove('visible');
    navBackEl.classList.remove('visible');
    preComicStepB.classList.remove('visible');
    preComicQ2Line.classList.remove('visible');
    preComicStepC.classList.remove('visible');
    await _preComicDelay(600);

    onDone();
  }

  // Called on restart/home — abandons any in-flight sequence (the pending
  // _preComicWait promise just never resolves, harmlessly) and clears all
  // visible state so a replay starts clean.
  function _resetPreComicSequence() {
    clearTimeout(_preComicTimer);
    _preComicClickCb  = null;
    screenLoading.style.cursor = 'default';
    [preComicStepA, preComicStepB, preComicQ2Line, preComicStepC, preComicClickHint]
      .forEach(el => el.classList.remove('visible'));
  }

  // ===================== INTRO SYSTEM =====================
  // Type A (Q1, Q3, Q4): empty screen — sidebar opens with the question title,
  //                       texts dismissed on first click.
  // Type B (Q2, Q5, Q6): has illustration — texts auto-dismiss as sidebar opens.
  const INTRO_TYPE_A = new Set([0, 2, 3]);
  let _introClickDismiss = null; // stored so _clearIntro can remove it

  function _dismissIntro(q) {
    clearTimeout(artTimer);
    if (INTRO_TYPE_A.has(q.id)) {
      qIntroBig.style.transition = 'none';
      qIntroTitle.style.transition = 'none';
    }
    qIntroBig.style.opacity = '0';
    qIntroTitle.style.opacity = '0';
    qIntroBg.style.opacity = '0';
    if (!INTRO_TYPE_A.has(q.id)) {
      sidebarInteraction.expandFromArt();
    }
    if (q.id === 0) {
      // Q1: no reason to wait — qIntroBig/qIntroTitle are already forced to
      // opacity:0 with transition:none above, so there's nothing left to
      // finish animating before revealing the title. The 500ms delay below
      // exists for the OTHER question types' fade-out; skipping it here is
      // what makes this feel instant on click instead of visibly lagging.
      qIntro.style.display = 'none';
      sidebarInteraction.titleEl = questionText;
      questionText.style.transition = 'none';
      questionText.style.opacity = '1';
      return;
    }
    setTimeout(() => {
      qIntro.style.display = 'none';
      if (!INTRO_TYPE_A.has(q.id)) sidebarInteraction.expand(q.id);
      sidebarInteraction.titleEl = questionText;
      questionText.style.transition = 'opacity 0.4s ease';
      questionText.style.opacity = '1';
      setTimeout(() => { questionText.style.transition = ''; }, 420);
    }, 500);
  }

  function _showIntro(q) {
    questionText.textContent = q.text;
    questionText.style.opacity = '0';
    qIntroHeading.innerHTML = q.introHeading || '';
    qIntroHeading.style.display = q.introHeading ? '' : 'none';
    qIntroBlame.innerHTML = q.introBig;
    qIntroBlame.style.fontSize = q.id === 3 ? 'clamp(52px, 8.5vw, 140px)' : '';
    qIntroBig.style.opacity = '1';
    const _introCfg = sidebarInteraction.questionConfigs?.[q.id];
    const _introDt  = _introCfg?.defaultTitle;
    qIntroTitle.textContent = _introDt
      ? `${_introDt.prefix || ''}${_introDt.pink}${_introDt.rest}`
      : q.text;
    qIntroTitle.style.opacity = '0';
    // Background layer only for Type B (art is visible underneath)
    if (!INTRO_TYPE_A.has(q.id)) {
      qIntroBg.style.background = q.background || 'var(--bg)';
      qIntroBg.style.opacity = '1';
    } else {
      qIntroBg.style.opacity = '0';
    }
    qIntro.style.display = 'flex';
    sidebarInteraction.squeezeForArt(q.id);

    artTimer = setTimeout(() => {
      qIntroTitle.style.opacity = '1';

      if (INTRO_TYPE_A.has(q.id)) {
        // Sidebar opens 1 second after the question title appears
        setTimeout(() => {
          sidebarInteraction.expandFromArt();
          sidebarInteraction.expand(q.id);
          // expand() may write bold HTML into titleEl — restore plain intro title
          const cfg = sidebarInteraction.questionConfigs?.[q.id];
          const dt = cfg?.defaultTitle;
          qIntroTitle.textContent = dt ? `${dt.prefix || ''}${dt.pink}${dt.rest}` : q.text;
        }, 1000);

        if (q.id !== 0 && q.id !== 3) {
          // Q3: first click anywhere dismisses the intro
          _introClickDismiss = () => _dismissIntro(q);
          document.addEventListener('click', _introClickDismiss, { once: true });
        }
      } else {
        // Type B: auto-dismiss after 4 seconds
        artTimer = setTimeout(() => _dismissIntro(q), 3000);
      }
    }, 1000);
  }

  function _clearIntro() {
    clearTimeout(artTimer);
    if (_introClickDismiss) {
      document.removeEventListener('click', _introClickDismiss);
      _introClickDismiss = null;
    }
    qIntro.style.display = 'none';
    sidebarInteraction.titleEl = questionText;
    screenQuestion.classList.remove('q1-title-centered');
    questionText.style.opacity = '';
    questionText.style.transition = '';
    btnNext.classList.remove('btn-pre-art');
    btnPrev.classList.remove('btn-pre-art');
  }

  // --- Show a question ---
  function showQuestionWithArt(q) {
    clearTimeout(cleanupTimer);
    _clearIntro();

    applyQuestionStyle(q);
    renderProgress();
    btnPrev.style.visibility = State.currentQuestion === 0 ? 'hidden' : 'visible';

    showScreen(screenQuestion);
    _showIntro(q);
  }

  // --- Navigation ---;

  function doStartQuiz() {
    if (screenStart._zooming) return;
    screenStart._zooming = true;

    const SLIDE_DUR  = 1200; // ms each element slides up
    const EASE       = 'cubic-bezier(0.4, 0, 0.2, 1)';
    const BG_DUR     = 1400; // background crossfade duration

    // Elements to slide up, in stagger order
    const hint = document.getElementById("start-click-hint");
    const gc   = document.getElementById("globe-container");
    // Fade hint out instead of sliding
    if (hint) {
      hint.style.transition = 'opacity 300ms ease';
      hint.style.opacity = '0';
    }

    const moon = document.getElementById('start-moon');
    const slideEls = [
      { el: gc,                                          delay: 0   },
      { el: moon,                                        delay: 40  },
      { el: document.querySelector('.start-hero'),       delay: 80  },
    ].filter(e => e.el);

    // Freeze globe float-inner at its current animated Y position, then stop animation
    const gcInner = gc.querySelector('.globe-float-inner') || gc;
    const gcMatrix = window.getComputedStyle(gcInner).transform;
    const gcCurrentY = gcMatrix !== 'none' ? new DOMMatrix(gcMatrix).m42 : 0;
    gcInner.style.transform = `translateY(${gcCurrentY}px)`;
    gcInner.style.animation = 'none';

    slideEls.forEach(({ el, delay }) => {
      setTimeout(() => {
        el.style.transition = `transform ${SLIDE_DUR}ms ${EASE}, opacity ${SLIDE_DUR * 0.6}ms ease ${SLIDE_DUR * 0.4}ms`;
        el.style.transform  = 'translateY(-110vh)';
        el.style.opacity    = '0';
      }, delay);
    });

    // Background transitions from burgundy to Q1 pink
    screenStart.style.transition = `background ${BG_DUR}ms ease`;
    screenStart.style.background = '#ffebec';

    const lastDelay = slideEls[slideEls.length - 1].delay;
    setTimeout(() => {
      if (!screenStart.classList.contains('active')) {
        screenStart._zooming = false;
        return;
      }
      State.reset();
      sidebarInteraction.show();
      showQuestionWithArt(QUESTIONS[State.currentQuestion]);

      // Reset start screen elements silently for next visit
      slideEls.forEach(({ el }) => {
        el.style.transition = 'none';
        el.style.transform  = '';
        el.style.opacity    = '';
      });
      screenStart.style.transition = 'none';
      screenStart.style.background = '';
      (gc.querySelector('.globe-float-inner') || gc).style.animation = '';
      screenStart._zooming = false;
    }, lastDelay + SLIDE_DUR + 80);
  }

  screenStart.addEventListener("click", doStartQuiz);

  function showStartHint() {
    const hint = document.getElementById("start-click-hint");
    if (hint) hint.classList.add("visible");
  }
  screenStart.addEventListener("transitionend", () => {}, { once: true });
  // show hint 1s after start screen becomes active
  setTimeout(showStartHint, 1000);

  btnHome.addEventListener("click", () => {
    _clearIntro();
    questionIntro.classList.remove("active");
    screenQuestion.classList.remove("intro-active");
    carouselWrapper.classList.remove("slide-right");
    State.reset();
    sidebarInteraction.reset();
    comicReveal.reset();
    _resetPreComicSequence();

    // Reset start screen elements to their original visible state
    const gc   = document.getElementById("globe-container");
    const hero = document.querySelector(".start-hero");
    const moon = document.getElementById("start-moon");
    [gc, hero, moon].forEach(el => {
      if (!el) return;
      el.style.transition = 'none';
      el.style.transform  = '';
      el.style.opacity    = '';
    });
    (gc.querySelector('.globe-float-inner') || gc).style.animation = '';
    screenStart.style.transition = 'none';
    screenStart.style.background = '';
    screenStart._zooming = false;

    // Reset and re-show the hint after 1s
    const hint = document.getElementById("start-click-hint");
    if (hint) {
      hint.style.transition = 'none';
      hint.style.opacity    = '0';
      hint.classList.remove('visible');
      setTimeout(() => {
        hint.style.transition = '';
        hint.classList.add('visible');
      }, 1000);
    }

    showScreen(screenStart);
  });

  btnPrev.addEventListener("click", () => {
    sidebarInteraction.collapseActive();
    if (State.goPrev()) {
      showQuestionWithArt(QUESTIONS[State.currentQuestion]);
    }
  });

  function _advanceQuestion() {
    const advanced = State.goNext();
    if (advanced) {
      showQuestionWithArt(QUESTIONS[State.currentQuestion]);
    } else {
      _clearIntro();
      _startComicLoading(() => {
        screenComicReveal.classList.add('active');
        comicReveal.start(computeResult(), true);
        setTimeout(() => screenLoading.classList.remove('active'), 400);
      });
    }
  }

  // Shared helper — shows loading screen, runs the sidebar exit animation,
  // then the pre-comic text sequence. Used by both the real flow and dev shortcuts.
  // Pass sidebarVisible=false to skip showing the sidebar (e.g. → Result shortcut).
  function _startComicLoading(onDone, { sidebarVisible = true } = {}) {
    showScreen(screenLoading);

    if (sidebarVisible) {
      // Make sure the sidebar container is visible and at full width before animating
      sidebarInteraction._container.style.display = 'flex';
      sidebarInteraction._container.style.transition = 'none';
      sidebarInteraction._container.style.width = 'calc(100vw / 12)';
      sidebarInteraction._container.classList.add('sb-exiting');
      // Snap bubbles to pink immediately — no transition on first appearance
      sidebarInteraction._bubbles.forEach(b => { b.style.transition = 'none'; b.style.borderColor = '#ffb8d9'; });
    }

    let _sidebarReady;
    const _sidebarReadyPromise = new Promise(resolve => { _sidebarReady = resolve; });
    const _doSidebarDone = () => { _sidebarReady(); };

    if (sidebarVisible) {
      setTimeout(() => {
        sidebarInteraction.playExitAnimation(_doSidebarDone, _sidebarReady);
      }, 1400);
    } else {
      _sidebarReady();
    }

    _runPreComicSequence(_sidebarReadyPromise, onDone);
  }

  btnNext.addEventListener("click", _advanceQuestion);

  // --- DnD answer lock: animation handled inside Q1Interaction, just advance ---
  function _lockAnswer(index, floating, _unused) {
    if (floating) floating.remove();
    _advanceQuestion();
  }

  function _lockDropZone(floating) {
    const dropZone = document.getElementById('q4v2-drop-zone');
    if (!dropZone) { if (floating) floating.remove(); _advanceQuestion(); return; }

    const dzRect = dropZone.getBoundingClientRect();

    // Snap the ghost icon into the circle center, then animate it
    if (floating) {
      const floatImg = floating.querySelector('img');
      const size = 52;
      floating.style.transition = 'left 0.15s ease, top 0.15s ease';
      floating.style.left = (dzRect.left + dzRect.width  / 2 - size / 2) + 'px';
      floating.style.top  = (dzRect.top  + dzRect.height / 2 - size / 2) + 'px';
      if (floatImg) { floatImg.style.width = size + 'px'; floatImg.style.height = size + 'px'; }
      const label = floating.querySelector('span');
      if (label) label.style.display = 'none';
      floating.classList.add('q4v2-locked-ghost');
    }

    dropZone.classList.add('q4v2-pulsing');
    setTimeout(() => {
      dropZone.classList.remove('q4v2-pulsing');
      if (floating) floating.remove();
      _advanceQuestion();
    }, 550);
  }

  btnRestart.addEventListener("click", () => {
    shareViewer.close();
    _clearIntro();
    _hideHint();
    State.reset();
    Object.values(_dndMap).forEach(d => { d.hide(); d.reset(); });
    Object.values(_scrubMap).forEach(d => { d.hide(); d.reset(); });
    Object.values(_swipeMap).forEach(d => { d.hide(); d.reset(); });
    Object.values(_lottieMap).forEach(d => { d.hide(); d.reset(); });
    sidebarInteraction.reset();
    comicReveal.reset();
    _resetPreComicSequence();
    showScreen(screenStart);
  });

  // Share button click is handled inside ShareViewer constructor

  // --- About toggle ---
  const aboutContainer = document.getElementById('about-container');
  const aboutImg       = document.getElementById('about-img');
  aboutImg.addEventListener('mouseenter', () => aboutImg.src = 'abouthover.svg');
  aboutImg.addEventListener('mouseleave', () => aboutImg.src = 'about.svg');
  aboutImg.addEventListener('click', () => aboutContainer.classList.toggle('about-open'));
  document.getElementById('about-hover-img').addEventListener('click', () => aboutContainer.classList.remove('about-open'));

})();


// Q1 label offsets (hardcoded from design)
(function() {
  const offsets = [0, -2, 6, -1, -1];
  const tray = document.getElementById('q1-icon-tray');
  function apply() {
    tray.querySelectorAll('.q1-icon-label').forEach((el, i) => {
      el.style.marginTop = offsets[i] + 'px';
    });
  }
  new MutationObserver(apply).observe(tray, { childList: true });
})();

