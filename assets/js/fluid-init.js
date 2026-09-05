// Mouse-reactive "paint mixing in water" background.
// Uses the webgl-fluid library (ESM port of PavelDoGreat/WebGL-Fluid-Simulation),
// loaded globally via the <script> tag in index.html — exposes window.WebGLFluid.
// TRANSPARENT: true means the simulation only paints color where the fluid is —
// everywhere else stays the page's white background, and the color bleeds through
// the blurred glass panels (nav pills, chat input) that sit on top of it.

(function initFluidController() {
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

  let canvas = document.getElementById('fluidCanvas');
  if (!canvas) {
    console.error('Fluid background: #fluidCanvas not found in the page.');
    return;
  }
  if (typeof WebGLFluid === 'undefined') {
    console.error('Fluid background: the webgl-fluid library did not load (check the <script> tag / network).');
    return;
  }

  // Rebuilding the canvas element (rather than resizing/reusing a live one) is what
  // makes this safe to call repeatedly: it guarantees a brand new WebGL context with
  // no stale framebuffers left over from the previous run. Mutating canvas.width /
  // canvas.height on an already-running simulation is what was causing the freeze —
  // the library's internal buffers stayed sized for the old dimensions for one frame,
  // producing NaNs in the velocity field that never dissipate (hence the screen
  // "throwing color" and then freezing solid on that garbage frame).
  function rebuildFluid() {
    const parent = canvas.parentNode;
    const fresh = document.createElement('canvas');
    fresh.id = 'fluidCanvas';
    fresh.className = 'fluid-canvas';
    parent.replaceChild(fresh, canvas);
    canvas = fresh;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    try {
      WebGLFluid(canvas, FLUID_CONFIG);
    } catch (err) {
      console.error('Fluid background: WebGLFluid() threw during init:', err);
      return;
    }

    canvas.addEventListener('webglcontextlost', (e) => {
      console.warn('Fluid background: WebGL context lost, rebuilding.');
      e.preventDefault();
      rebuildFluid();
    }, false);
  }

  rebuildFluid();

  // Resizing safely: rebuild from scratch, but debounced so dragging a window
  // edge doesn't tear down/recreate the WebGL context dozens of times a second.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuildFluid, 300);
  });

  // Switching tabs/apps and coming back is the other classic trigger for this kind
  // of simulation to explode: the library's next animation frame sees a huge elapsed
  // time (however long the tab was hidden) and produces the same NaN-explosion
  // symptom. Rebuilding on return sidesteps it entirely.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      rebuildFluid();
    }
  });
})();