(() => {
  const DEFAULTS = {
    scalePopе:   1.28,
    scaleBill:   0.83,
    scaleCon:    0.96,
    scaleNews:   1.08,
    offsetPope:  0,   // px, positive = nudge right
    offsetBill:  0,
    offsetCon:   0,
    offsetNews:  0,
    trayGap:     84,
    slotGap:     22,
    textSize:    18,
    trayRight:   3,
    trayTop:     50,
  };

  const state = { ...DEFAULTS };

  const styleEl = document.createElement('style');
  styleEl.id = 'q4-live-controls';
  document.head.appendChild(styleEl);

  function applyCSS() {
    styleEl.textContent = `
#screen-question.q4-active .q1-icon-tray {
  gap: ${state.trayGap}px;
  right: ${state.trayRight}vw;
  top: ${state.trayTop}%;
  transform: translateY(-${state.trayTop}%);
  align-items: flex-end;
  width: auto;
}
#screen-question.q4-active .q1-icon-slot { gap: ${state.slotGap}px; }
#screen-question.q4-active .q1-icon-label { font-size: ${state.textSize}px; }

#screen-question.q4-active .q1-icon-tray .q1-icon-slot:nth-child(1) .q1-icon {
  transform: scale(${state.scalePopе}) translateX(${state.offsetPope}px);
  transform-origin: right center;
}
#screen-question.q4-active .q1-icon-tray .q1-icon-slot:nth-child(2) .q1-icon {
  transform: scale(${state.scaleBill}) translateX(${state.offsetBill}px);
  transform-origin: right center;
}
#screen-question.q4-active .q1-icon-tray .q1-icon-slot:nth-child(3) .q1-icon {
  transform: scale(${state.scaleCon}) translateX(${state.offsetCon}px);
  transform-origin: right center;
}
#screen-question.q4-active .q1-icon-tray .q1-icon-slot:nth-child(4) .q1-icon {
  transform: scale(${state.scaleNews}) translateX(${state.offsetNews}px);
  transform-origin: right center;
}
    `.trim();
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'q4-control-panel';
    panel.style.cssText = `
      position: fixed; top: 16px; left: 16px; z-index: 9999;
      background: rgba(20,0,8,0.92); color: #ffeef0;
      font-family: system-ui, sans-serif; font-size: 12px;
      border-radius: 10px; padding: 14px 16px 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      width: 300px; user-select: none;
    `;

    const title = document.createElement('div');
    title.textContent = 'Q4 Controls  (drag to move)';
    title.style.cssText = 'font-weight:700; font-size:13px; margin-bottom:12px; color:#fe80fe; cursor:grab;';
    panel.appendChild(title);

    function section(label) {
      const el = document.createElement('div');
      el.textContent = label;
      el.style.cssText = 'font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#fe80fe; opacity:0.6; margin: 10px 0 6px;';
      panel.appendChild(el);
    }

    function slider({ key, label, min, max, step }) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; margin-bottom:6px; gap:6px;';

      const lbl = document.createElement('span');
      lbl.textContent = label;
      lbl.style.cssText = 'width:120px; flex-shrink:0; color:#ffcdd2;';

      const input = document.createElement('input');
      input.type = 'range';
      input.min = min; input.max = max; input.step = step;
      input.value = state[key];
      input.style.cssText = 'flex:1; accent-color:#fe80fe; cursor:pointer;';

      const val = document.createElement('span');
      val.textContent = state[key];
      val.style.cssText = 'width:36px; text-align:right; color:#fe80fe; font-weight:600;';

      input.addEventListener('input', () => {
        state[key] = parseFloat(input.value);
        val.textContent = input.value;
        applyCSS();
      });

      row.appendChild(lbl); row.appendChild(input); row.appendChild(val);
      panel.appendChild(row);
    }

    section('Position per icon  ← →');
    slider({ key: 'offsetPope', label: 'Pope offset',  min: -80, max: 80, step: 1 });
    slider({ key: 'offsetBill', label: 'Bill offset',  min: -80, max: 80, step: 1 });
    slider({ key: 'offsetCon',  label: 'Con offset',   min: -80, max: 80, step: 1 });
    slider({ key: 'offsetNews', label: 'News offset',  min: -80, max: 80, step: 1 });

    section('Scale per icon');
    slider({ key: 'scalePopе', label: 'Pope scale',  min: 0.3, max: 3, step: 0.01 });
    slider({ key: 'scaleBill', label: 'Bill scale',  min: 0.3, max: 3, step: 0.01 });
    slider({ key: 'scaleCon',  label: 'Con scale',   min: 0.3, max: 3, step: 0.01 });
    slider({ key: 'scaleNews', label: 'News scale',  min: 0.3, max: 3, step: 0.01 });

    section('Tray & text');
    slider({ key: 'trayGap',   label: 'Icon gap (px)',  min: 0,  max: 140, step: 1   });
    slider({ key: 'slotGap',   label: 'Text↔icon gap',  min: 0,  max: 60,  step: 1   });
    slider({ key: 'textSize',  label: 'Text size (px)', min: 10, max: 40,  step: 1   });
    slider({ key: 'trayRight', label: 'Tray right (vw)',min: 0,  max: 20,  step: 0.5 });
    slider({ key: 'trayTop',   label: 'Tray top (%)',   min: 10, max: 90,  step: 1   });

    // Copy CSS
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy CSS';
    copyBtn.style.cssText = `
      margin-top:10px; width:100%; padding:6px; border:none; border-radius:6px;
      background:#fe80fe; color:#550017; font-weight:700; font-size:12px; cursor:pointer;
    `;
    copyBtn.addEventListener('click', () => {
      const css =
`/* Q4 icon tray */
#screen-question.q4-active .q1-icon-tray { gap: ${state.trayGap}px; }
#screen-question.q4-active .q1-icon-slot { gap: ${state.slotGap}px; }
#screen-question.q4-active .q1-icon-label { font-size: ${state.textSize}px; }
#screen-question.q4-active .q1-icon-tray .q1-icon-slot:nth-child(1) .q1-icon { transform: scale(${state.scalePopе}) translateX(${state.offsetPope}px); transform-origin: right center; }
#screen-question.q4-active .q1-icon-tray .q1-icon-slot:nth-child(2) .q1-icon { transform: scale(${state.scaleBill}) translateX(${state.offsetBill}px); transform-origin: right center; }
#screen-question.q4-active .q1-icon-tray .q1-icon-slot:nth-child(3) .q1-icon { transform: scale(${state.scaleCon})  translateX(${state.offsetCon}px);  transform-origin: right center; }
#screen-question.q4-active .q1-icon-tray .q1-icon-slot:nth-child(4) .q1-icon { transform: scale(${state.scaleNews}) translateX(${state.offsetNews}px); transform-origin: right center; }`;
      navigator.clipboard.writeText(css).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy CSS'; }, 1500);
      });
    });
    panel.appendChild(copyBtn);

    // Drag to reposition
    let dragging = false, ox = 0, oy = 0;
    title.addEventListener('mousedown', (e) => {
      dragging = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
      title.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.left = (e.clientX - ox) + 'px';
      panel.style.top  = (e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; title.style.cursor = 'grab'; });

    document.body.appendChild(panel);
  }

  applyCSS();
  buildPanel();
})();
