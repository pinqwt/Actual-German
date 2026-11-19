// ═══════════════════════════════════════════════════════════
// Homepage hero (index.html) — the parts fly onto the board by themselves.
// On load, --p on #v3Scene runs 0 -> 1 once over ~1.3s; the CSS in 30-v3.css moves each
// part from off-screen to its slot as a function of --p (each part has its own start
// offset, so they arrive one after another). It plays ONCE and stops: no loop, and
// scrolling does nothing to it — the hero is a normal one-screen section and the page
// continues below it. prefers-reduced-motion gets the finished board with no motion.
// Every entry point checks for its own element, so on any other page this does nothing.
// ═══════════════════════════════════════════════════════════
(function v3Scene() {
  var scene = document.getElementById('v3Scene');
  if (!scene) return;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce || !window.requestAnimationFrame) { scene.style.setProperty('--p', '1'); return; }

  var DURATION = 1300;   // ms for the whole arrival, stagger included
  var DELAY = 120;       // lets the preloader fade first so the visitor sees it start
  scene.style.setProperty('--p', '0');
  function run() {
    var t0 = null;
    function frame(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / DURATION);
      scene.style.setProperty('--p', p.toFixed(4));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  setTimeout(run, DELAY);
})();

// Cars we fit: an endless strip. The seven cards are numbered, then cloned twice so
// the track is three identical sets; 30-v3.css slides it by exactly one set and
// repeats, which loops with no jump. Clones are hidden from assistive tech and the
// tab order (the originals stay reachable). Visitors who prefer reduced motion get
// the plain swipe row (the CSS hides the clones for them).
(function v3CarLoop() {
  var row = document.querySelector('.v3-car-row');
  if (!row) return;
  var originals = Array.prototype.slice.call(row.querySelectorAll('.v3-car-li'));
  originals.forEach(function (li, i) { li.style.setProperty('--n', String(i + 1)); });
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (var copy = 0; copy < 2; copy++) {
    originals.forEach(function (li) {
      var c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('data-clone', '');
      Array.prototype.forEach.call(c.querySelectorAll('button'), function (b) { b.tabIndex = -1; });
      row.appendChild(c);
    });
  }
})();
