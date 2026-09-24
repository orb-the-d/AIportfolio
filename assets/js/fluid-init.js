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
    DENSITY_DISSIPATION: 2.6,  // lingers a bit longer than before — now that the event-flood
                               // and brightness-filter causes of the old whiteout bug are both
                               // fixed, we can afford a slower fade for a more liquid, less
                               // "puff of smoke that vanishes instantly" feel
    VELOCITY_DISSIPATION: 2.6, // thick, heavy resistance to motion
    PRESSURE: 0.97,            // near-incompressible — real liquids barely compress; gas does
    CURL: 2,                   // very low = one or two big coherent liquid blobs, not lots of
                                // small chaotic wisps curling off — this is what reads as
                                // "smoke" at higher values and "liquid" at low ones
    SPLAT_RADIUS: 0.4,         // a fuller, heavier drop rather than a thin trail
    SPLAT_FORCE: 4200,
    SHADING: false,           // flat color, no fake 3D lighting — that lighting was the harsh neon-glow look
    COLORFUL: true,
    COLOR_UPDATE_SPEED: 1.4,  // slow, steady hue drift like dye actually diffusing through water
    TRANSPARENT: true,
    BLOOM: false,             // bloom was the main source of the too-bright glow — off
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
  // the nav dock / input pill / chat bubbles sit on top with
  // pointer-events:auto, the browser delivers real cursor events to *them*,
  // not to the canvas underneath — so the fluid would freeze under any glass
  // panel or chat content the cursor is over. Fix: listen globally and
  // re-dispatch a synthetic copy of every pointer event straight at the
  // canvas. (Note: this alone couldn't fully fix "no effect under the chat"
  // — that was actually a separate layout bug where the whole page could
  // grow taller than the viewport once messages piled up, desyncing the
  // fixed-position canvas from where the visitor was actually scrolled to.
  // Fixed in styles.css: .stage is now a real fixed 100vh box instead of
  // min-height:100vh, so the page itself never scrolls — only the
  // conversation panel scrolls internally.)
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