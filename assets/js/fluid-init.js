// Mouse-reactive "paint mixing in water" background.
// Uses the webgl-fluid library (ESM port of PavelDoGreat/WebGL-Fluid-Simulation),
// loaded globally via the <script> tag in index.html — exposes window.WebGLFluid.
// TRANSPARENT: true means the simulation only paints color where the fluid is —
// everywhere else stays the page's white background, and the color bleeds through
// the blurred glass panels (nav pills, chat input) that sit on top of it.

(function initFluid() {
  const canvas = document.getElementById('fluidCanvas');
  if (!canvas) {
    console.error('Fluid background: #fluidCanvas not found in the page.');
    return;
  }
  if (typeof WebGLFluid === 'undefined') {
    console.error('Fluid background: the webgl-fluid library did not load (check the <script> tag / network).');
    return;
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const FLUID_CONFIG = {
    TRIGGER: 'hover',        // reacts continuously as the mouse moves, not just on click
    IMMEDIATE: false,        // stay blank until the visitor actually moves their mouse
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 720,
    DENSITY_DISSIPATION: 3.2,
    VELOCITY_DISSIPATION: 2.4,
    PRESSURE: 0.92,
    CURL: 5,
    SPLAT_RADIUS: 0.36,
    SPLAT_FORCE: 3600,
    SHADING: false,
    COLORFUL: true,
    COLOR_UPDATE_SPEED: 1.6,
    TRANSPARENT: true,
    BLOOM: false,
    SUNRAYS: false,
  };

  function startFluid() {
    try {
      WebGLFluid(canvas, FLUID_CONFIG);
    } catch (err) {
      console.error('Fluid background: WebGLFluid() threw during init:', err);
    }
  }
  startFluid();

  // ---- recover automatically if the GPU drops the WebGL context ----
  canvas.addEventListener('webglcontextlost', (e) => {
    console.warn('Fluid background: WebGL context lost, will restore automatically.');
    e.preventDefault();
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('Fluid background: WebGL context restored, restarting simulation.');
    startFluid();
  }, false);

  // ---- keep the fluid alive under the glass UI ----
  // WebGLFluid only listens for mouse/touch events on `canvas` itself. Once
  // the nav dock / input pill sit on top with pointer-events:auto, the browser
  // delivers real cursor events to *them*, not to the canvas underneath — so
  // the fluid would freeze under any glass panel the cursor is over. Fix:
  // listen globally and re-dispatch a synthetic copy of every pointer event
  // straight at the canvas.
  //
  // Throttled to roughly one dispatch per 16ms (~60fps) using a plain
  // timestamp check — simpler and more robust than an animation-frame queue,
  // and still cuts GPU load a lot versus forwarding every raw input event
  // (some trackpads report 120-240 moves/sec).
  let lastForwardTime = 0;

  function forwardToCanvas(type, srcEvent) {
    const evt = new MouseEvent(type, {
      clientX: srcEvent.clientX,
      clientY: srcEvent.clientY,
      button: srcEvent.button || 0,
      bubbles: true,
      cancelable: true,
      view: window,
    });
    canvas.dispatchEvent(evt);
  }

  window.addEventListener('pointermove', (e) => {
    if (e.target === canvas) return;       // canvas already got the real event
    if (e.pointerType === 'touch') return; // avoid double-handling touch
    const now = performance.now();
    if (now - lastForwardTime < 16) return;
    lastForwardTime = now;
    forwardToCanvas('mousemove', e);
  }, { passive: true });

  ['pointerdown', 'pointerup'].forEach((pointerType) => {
    const mapped = pointerType === 'pointerdown' ? 'mousedown' : 'mouseup';
    window.addEventListener(pointerType, (e) => {
      if (e.target === canvas) return;
      if (e.pointerType === 'touch') return;
      forwardToCanvas(mapped, e);
    }, { passive: true });
  });
})();