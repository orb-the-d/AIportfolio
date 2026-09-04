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

  const FLUID_CONFIG = {
    TRIGGER: 'hover',        // reacts continuously as the mouse moves, not just on click
    IMMEDIATE: false,        // stay blank until the visitor actually moves their mouse
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 720,     // was 1024 — a long session of full-page mouse tracking at
                             // 1024 was heavy enough on some GPUs to eventually lose the
                             // WebGL context entirely, which freezes the last frame forever
    DENSITY_DISSIPATION: 3.2,  // fades out within a couple seconds — stops old splats from
                               // piling on top of new ones and washing the whole thing out to white
    VELOCITY_DISSIPATION: 2.4, // more resistance to motion = heavier, thicker liquid, not floaty air
    PRESSURE: 0.92,            // closer to incompressible = behaves like a real liquid, not gas
    CURL: 5,                   // low curl = a few big calm swirls, not lots of small chaotic
                                // wisps — this is the main "air vs water" knob
    SPLAT_RADIUS: 0.36,        // a drop spreading into water, not an overlapping smear
    SPLAT_FORCE: 3600,
    SHADING: false,           // flat color, no fake 3D lighting — that lighting was the harsh neon-glow look
    COLORFUL: true,
    COLOR_UPDATE_SPEED: 1.6,  // slow, gradual hue drift like dye actually diffusing — not a
                               // fast rainbow flicker, which reads as "air" rather than liquid
    TRANSPARENT: true,
    BLOOM: false,             // bloom was the main source of the too-bright glow — off
    SUNRAYS: false,
  };

  function startFluid() {
    WebGLFluid(canvas, FLUID_CONFIG);
  }
  startFluid();

  // ---- recover automatically if the GPU drops the WebGL context ----
  // Long sessions with lots of continuous full-page redraw can push some
  // GPUs (especially integrated/mobile ones) into losing the context —
  // the browser's own safety valve when it decides a page is asking for
  // too much for too long. Without handling this, losing the context
  // freezes whatever was last drawn on screen *permanently* — exactly the
  // "colors stopped moving" symptom. `preventDefault()` on contextlost is
  // required for the browser to ever fire contextrestored at all; without
  // it, the browser assumes the context is gone for good.
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
  // the nav dock / input pill sit on top with pointer-events:auto (needed so
  // their buttons are clickable), the browser delivers real cursor events to
  // *them*, not to the canvas underneath — so the fluid would freeze under
  // any glass panel the cursor is over. Fix: listen globally and re-dispatch
  // a synthetic copy of every pointer event straight at the canvas, so the
  // simulation keeps reacting continuously everywhere, including on top of
  // the liquid-glass navbar/input, exactly like it does over open space.
  //
  // Forwarding is throttled to one dispatch per animation frame (rAF), not
  // one per raw input event. Some trackpads/mice report pointermove at up
  // to 120-240Hz — dispatching a real fluid splat for every single one of
  // those was a big part of what overloaded the GPU over a long session.
  // Capping it to the screen's own refresh rate keeps the effect just as
  // smooth to the eye while cutting the actual GPU workload dramatically.
  let pendingMove = null;
  let rafScheduled = false;

  function flushPendingMove() {
    rafScheduled = false;
    if (!pendingMove) return;
    const evt = new MouseEvent('mousemove', {
      clientX: pendingMove.clientX,
      clientY: pendingMove.clientY,
      bubbles: true,
      cancelable: true,
      view: window,
    });
    pendingMove = null;
    canvas.dispatchEvent(evt);
  }

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
    if (e.target === canvas) return;      // canvas already got the real event
    if (e.pointerType === 'touch') return; // avoid double-handling touch
    pendingMove = e;
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(flushPendingMove);
    }
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