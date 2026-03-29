/* ============================================
   KRKAI — GSAP ScrollTrigger + Content Panels
   ============================================ */

var KRKAI_Scroll = (function() {
  'use strict';

  var panels = [];
  var currentProgress = 0;

  // === CACHED DOM REFERENCES (avoid per-frame getElementById) ===
  var _godray, _fireflies, _fog, _petals, _timelineFill;
  var _vignette, _grain, _normalSec;

  function init() {
    // Always start at top — prevents browser scroll restoration from causing mid-flight initial render
    window.scrollTo(0, 0);
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.clearScrollMemory();

    // Cache all DOM elements used in the hot scroll path
    _godray = document.getElementById('godray-overlay');
    _fireflies = document.getElementById('firefly-overlay');
    _fog = document.getElementById('fog-overlay');
    _petals = document.getElementById('petal-overlay');
    _timelineFill = document.querySelector('.timeline-fill');
    _vignette = document.getElementById('vignette-overlay');
    _grain = document.getElementById('grain-overlay');
    _normalSec = document.getElementById('normal-scroll-sections');

    applyScrollTimings();
    cachePanels();
    initParallax();
    setupMasterScroll();
    setupNormalSectionAnimations();

    // Fire initial state at progress 0 so camera/pen are correctly positioned
    onProgressUpdate(0);
  }

  // === APPLY SECTION TIMINGS FROM CONFIG ===
  // Maps particles.config.js sections{} onto data-enter / data-exit attributes
  // so the HTML never needs to be edited manually.
  var _sectionIdMap = {
    scrollHint: 'scroll-hint',
    hero:       'section-hero',
    problem:    'section-problem',
    mission:    'section-mission',
    program:    'section-program',
    timeline:   'section-timeline',
    stories:    'section-stories',
    impact:     'section-impact',
    gallery:    'section-gallery',
    video:      'section-video'
  };

  function applyScrollTimings() {
    var cfg = (typeof KRKAI_ParticleConfig !== 'undefined' && KRKAI_ParticleConfig.sections) ? KRKAI_ParticleConfig.sections : null;
    if (!cfg) return;
    var keys = Object.keys(_sectionIdMap);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var timing = cfg[key];
      if (!timing) continue;
      var el = document.getElementById(_sectionIdMap[key]);
      if (!el) continue;
      el.setAttribute('data-enter', timing.enter);
      el.setAttribute('data-exit',  timing.exit);
    }
  }

  // === CACHE CONTENT PANELS ===
  function cachePanels() {
    var elements = document.querySelectorAll('.content-panel');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      panels.push({
        el: el,
        enter: parseFloat(el.getAttribute('data-enter')),
        exit: parseFloat(el.getAttribute('data-exit')),
        visible: false
      });
    }
  }

  // === MASTER SCROLL TRIGGER ===
  function setupMasterScroll() {
    var scrollSpacer = document.getElementById('scroll-spacer');
    if (!scrollSpacer) return;

    ScrollTrigger.create({
      trigger: scrollSpacer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8,
      onUpdate: function(self) {
        currentProgress = self.progress;
        onProgressUpdate(currentProgress);
      }
    });
  }

  // === PARALLAX BACKGROUND DEPTH (Step 6) ===
  var statsBgSection = null;
  function initParallax() {
    statsBgSection = document.querySelector('.problem-card');
  }

  // === ON PROGRESS UPDATE ===
  // Config values cached on first call
  var _cfgCached = false;
  var _grStart, _grEnd, _ffStart, _ffEnd, _fogEnabled, _fogStart, _fogEnd;
  var _ptCount, _ptStart, _ptEnd;
  var _canvasFadeStart, _canvasNormalAppear;
  // Track vignette state to avoid redundant style writes
  var _lastVignetteStrong = -1;
  // Track overlay visibility to avoid redundant classList toggles
  var _lastGodrayVis = false, _lastFireflyVis = false, _lastFogVis = false, _lastPetalVis = false;
  // Cache canvas-fade opacity and background gradient to skip redundant DOM writes
  var _lastFadeOpacity = -1;
  var _lastBgPercent   = -1;

  function onProgressUpdate(p) {
    // Cache config on first call (config doesn't change at runtime)
    if (!_cfgCached) {
      var pcfg = typeof KRKAI_ParticleConfig !== 'undefined' ? KRKAI_ParticleConfig : {};
      var grCfg = pcfg.godray || {};
      var ffCfg = pcfg.fireflies || {};
      var fogCfg = pcfg.fog || {};
      var ptCfg = pcfg.petals || {};
      _grStart = grCfg.scrollStart || 0.04;
      _grEnd = grCfg.scrollEnd || 0.50;
      _ffStart = ffCfg.scrollStart || 0.02;
      _ffEnd = ffCfg.scrollEnd || 0.88;
      _fogEnabled = fogCfg.enabled !== false;
      _fogStart = fogCfg.scrollStart || 0.02;
      _fogEnd = fogCfg.scrollEnd || 0.88;
      _ptCount = ptCfg.count || 0;
      _ptStart = ptCfg.scrollStart || 0.28;
      _ptEnd = ptCfg.scrollEnd || 0.68;
      var fadeCfg = pcfg.canvasFade || {};
      _canvasFadeStart   = fadeCfg.fadeStart            || 0.95;
      _canvasNormalAppear = fadeCfg.normalSectionsAppear || 0.98;
      _cfgCached = true;
    }

    // Toggle overlay visibility (only touch DOM when state changes)
    var vis;
    if (_godray) {
      vis = p > _grStart && p < _grEnd;
      if (vis !== _lastGodrayVis) { _godray.classList.toggle('visible', vis); _lastGodrayVis = vis; }
    }
    if (_fireflies) {
      vis = p > _ffStart && p < _ffEnd;
      if (vis !== _lastFireflyVis) { _fireflies.classList.toggle('visible', vis); _lastFireflyVis = vis; }
    }
    if (_fog) {
      vis = _fogEnabled && p > _fogStart && p < _fogEnd;
      if (vis !== _lastFogVis) { _fog.classList.toggle('visible', vis); _lastFogVis = vis; }
    }
    if (_petals) {
      vis = _ptCount > 0 && p > _ptStart && p < _ptEnd;
      if (vis !== _lastPetalVis) { _petals.classList.toggle('visible', vis); _lastPetalVis = vis; }
    }

    // Only update 3D scene when in the 3D section (before fade-out completes)
    if (p < (_canvasFadeStart || 0.95) + 0.05) {
      // Update 3D scene
      KRKAI_Scene.setProgress(p);

      // Update pen + camera
      var camera = KRKAI_Scene.getCamera();
      var nibLight = KRKAI_Scene.getNibLight();
      if (camera && nibLight) {
        KRKAI_Pen.update(p, camera, nibLight);
      }
    }

    // Update INIIBO guide (HTML-only, no 3D)
    if (typeof KRKAI_INIIBO !== 'undefined') {
      KRKAI_INIIBO.update(p);
    }

    // Update content panel visibility
    for (var i = 0; i < panels.length; i++) {
      var panel = panels[i];
      var shouldShow = p >= panel.enter && p <= panel.exit;
      if (shouldShow && !panel.visible) {
        panel.el.classList.add('visible');
        panel.visible = true;
      } else if (!shouldShow && panel.visible) {
        panel.el.classList.remove('visible');
        panel.visible = false;
      }
    }

    // Timeline fill progress
    if (_timelineFill) {
      if (p >= 0.48 && p <= 0.58) {
        var fillPercent = ((p - 0.48) / 0.10) * 100;
        _timelineFill.style.height = fillPercent + '%';
      } else if (p > 0.58) {
        _timelineFill.style.height = '100%';
      } else {
        _timelineFill.style.height = '0%';
      }
    }

    // Canvas fade out (timing controlled by particles.config.js → canvasFade)
    if (p >= _canvasFadeStart) {
      var canvasFadeT = Math.min((p - _canvasFadeStart) / 0.03, 1);
      var fadeOpacity = 1 - canvasFadeT;
      KRKAI_Scene.fadeCanvas(fadeOpacity);
      // Only write opacity when it has changed by more than 0.5% — avoids 60 DOM writes/sec at rest
      if (Math.abs(fadeOpacity - _lastFadeOpacity) > 0.005) {
        _lastFadeOpacity = fadeOpacity;
        if (_vignette)   _vignette.style.opacity   = fadeOpacity;
        if (_grain)      _grain.style.opacity       = fadeOpacity * 0.04;
        if (_fireflies)  _fireflies.style.opacity   = fadeOpacity;
        if (_fog)        _fog.style.opacity         = fadeOpacity;
        if (_petals)     _petals.style.opacity      = fadeOpacity;
      }
      // Only rebuild gradient string when the integer percent actually changes (0–60 range)
      var bgPct = Math.floor(canvasFadeT * 60);
      if (bgPct !== _lastBgPercent) {
        _lastBgPercent = bgPct;
        document.body.style.background = 'linear-gradient(180deg, #0A0308 ' + bgPct + '%, #07021A 100%)';
      }
      var normalFadeT = Math.max(0, Math.min((p - _canvasNormalAppear) / 0.02, 1));
      if (_normalSec) _normalSec.style.opacity = normalFadeT;
    } else {
      KRKAI_Scene.fadeCanvas(1);
      if (_lastBgPercent !== -1) {
        document.body.style.background = '';
        _lastBgPercent = -1;
      }
      if (_lastFadeOpacity !== -1) {
        _lastFadeOpacity = -1;
        if (_normalSec)  _normalSec.style.opacity  = '0';
        if (_grain)      _grain.style.opacity      = '';
        if (_fireflies)  _fireflies.style.opacity  = '';
        if (_fog)        _fog.style.opacity        = '';
        if (_petals)     _petals.style.opacity     = '';
      }
    }

    // Vignette intensity per scene — teal tint (only update when zone changes)
    if (_vignette && p < _canvasFadeStart) {
      var strong = (p >= 0.18 && p < 0.28) ? 1 : 0;
      if (strong !== _lastVignetteStrong) {
        _vignette.style.background = strong
          ? 'radial-gradient(ellipse at center, transparent 30%, rgba(2,6,5,0.85) 100%)'
          : 'radial-gradient(ellipse at center, transparent 50%, rgba(2,6,5,0.65) 100%)';
        _lastVignetteStrong = strong;
      }
    }
  }

  // === NORMAL SECTION ANIMATIONS (after 3D fades) ===
  function setupNormalSectionAnimations() {
    // Reveal animations for normal scroll sections
    var normalSections = document.querySelectorAll('.normal-section');
    for (var i = 0; i < normalSections.length; i++) {
      var section = normalSections[i];

      // Animate headings — GPU-friendly opacity + transform (Step 10)
      var headings = section.querySelectorAll('h2, h3');
      for (var h = 0; h < headings.length; h++) {
        gsap.from(headings[h], {
          scrollTrigger: {
            trigger: headings[h],
            start: 'top 96%',
            toggleActions: 'play none none none'
          },
          opacity: 0,
          y: 20,
          duration: 0.6,
          ease: 'power2.out',
          delay: h * 0.1
        });
      }

      // Animate cards — GPU-friendly opacity + transform (Step 10)
      var cards = section.querySelectorAll('.volunteer-card, .tier-card, .support-panel, .contact-card, .csr-calculator, .csr-pitch');
      for (var c = 0; c < cards.length; c++) {
        gsap.from(cards[c], {
          scrollTrigger: {
            trigger: cards[c],
            start: 'top 96%',
            toggleActions: 'play none none none'
          },
          opacity: 0,
          y: 30,
          duration: 0.65,
          ease: 'power3.out',
          delay: c * 0.08
        });
      }
    }

    // Footer animation
    var footer = document.getElementById('section-footer');
    if (footer) {
      gsap.from(footer.children, {
        scrollTrigger: {
          trigger: footer,
          start: 'top 90%',
          toggleActions: 'play none none none'
        },
        y: 20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1
      });
    }
  }

  return {
    init: init,
    getProgress: function() { return currentProgress; }
  };
})();
