// Mouse-reactive "paint mixing in water" background.
// Uses the webgl-fluid library (ESM port of PavelDoGreat/WebGL-Fluid-Simulation),
// loaded globally via the <script> tag in index.html — exposes window.WebGLFluid.
// TRANSPARENT: true means the simulation only paints color where the fluid is —
// everywhere else stays the page's white background, and the color bleeds through
// the blurred glass panels (nav pills, chat input) that sit on top of it.

(function initFluid() {
  const canvas = document.getElementById('fluidCanvas');
  if (!canvas || typeof WebGLFluid === 'undefined') return;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  WebGLFluid(canvas, {
    TRIGGER: 'hover',        // reacts continuously as the mouse moves, not just on click
    IMMEDIATE: false,        // stay blank until the visitor actually moves their mouse
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    DENSITY_DISSIPATION: 2.2,  // trail fades a bit sooner — keeps color from pooling into neon patches
    VELOCITY_DISSIPATION: 2.0,
    PRESSURE: 0.8,
    CURL: 14,                 // less curl = softer, less tightly-wound swirls
    SPLAT_RADIUS: 0.45,       // bigger, softer splats blend into each other like ink/paint in water
    SPLAT_FORCE: 3200,        // gentler force so colors diffuse instead of punching in bright
    SHADING: false,           // flat color, no fake 3D lighting — that lighting was the harsh neon-glow look
    COLORFUL: true,
    COLOR_UPDATE_SPEED: 3,    // slower hue drift = smooth pastel blending, not fast rainbow flashing
    TRANSPARENT: true,
    BLOOM: false,             // bloom was the main source of the too-bright glow — off
    SUNRAYS: false,
  });

  // ---- keep the fluid alive under the glass UI ----
  // WebGLFluid only listens for mouse/touch events on `canvas` itself. Once
  // the nav dock / input pill sit on top with pointer-events:auto (needed so
  // their buttons are clickable), the browser delivers real cursor events to
  // *them*, not to the canvas underneath — so the fluid would freeze under
  // any glass panel the cursor is over. Fix: listen globally and re-dispatch
  // a synthetic copy of every pointer event straight at the canvas, so the
  // simulation keeps reacting continuously everywhere, including on top of
  // the liquid-glass navbar/input, exactly like it does over open space.
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

  const POINTER_MAP = {
    pointermove: 'mousemove',
    pointerdown: 'mousedown',
    pointerup: 'mouseup',
  };

  Object.keys(POINTER_MAP).forEach((pointerType) => {
    window.addEventListener(pointerType, (e) => {
      if (e.target === canvas) return; // canvas already got the real event
      if (e.pointerType === 'touch') return; // avoid double-handling touch
      forwardToCanvas(POINTER_MAP[pointerType], e);
    }, { passive: true });
  });
})();