/* ═══════════════════════════════════════════════════════════════════════════
   Varzharan landing page

   Every behaviour here earns its place:
     theme      lets a parent read the page in whichever mode they live in
     nav state  signals "you have left the top of the page"
     scrollspy  a single pill glides between nav labels to show where you are
     split      headlines are broken into words so each can rise on its own
     count      the progress figure counts up as its card arrives
     reveal     sequences each section so the eye lands on the heading first
     spotlight  points at whichever subject tile the cursor is over
     ripple     acknowledges a press at the exact spot it happened
     rail       makes the teacher list obviously scrollable

   Nothing here is driven by a scroll listener. Scroll-dependent state uses
   IntersectionObserver, which the browser batches off the main thread. The one
   exception is the teacher rail, which attaches a passive listener to its own
   overflow container purely to enable/disable the two arrows. It drives no
   animation and never touches layout.

   Every motion path is skipped when the visitor asks for reduced motion.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');


  /* ── Theme ─────────────────────────────────────────────────────────────── */

  var toggle = document.getElementById('theme-toggle');
  var label  = document.getElementById('theme-label');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function activeTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return systemDark.matches ? 'dark' : 'light';
  }

  function syncToggle() {
    var next = activeTheme() === 'dark' ? 'light' : 'dark';
    label.textContent = next === 'dark' ? 'Dark' : 'Light';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }

  toggle.addEventListener('click', function () {
    var next = activeTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('varzharan-theme', next); } catch (e) {}
    syncToggle();
  });

  // Follow the OS while the visitor has not made an explicit choice.
  if (systemDark.addEventListener) {
    systemDark.addEventListener('change', function () {
      if (!root.hasAttribute('data-theme')) syncToggle();
    });
  }

  syncToggle();


  /* ── Nav: hairline appears once the page has moved ─────────────────────── */

  var nav = document.getElementById('nav');
  var sentinel = document.getElementById('nav-sentinel');

  if ('IntersectionObserver' in window && sentinel) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }


  /* ── Mobile menu ───────────────────────────────────────────────────────── */

  var burger = document.getElementById('burger');
  var menu   = document.getElementById('mobile-menu');

  var navBar = document.getElementById('nav-bar');

  function closeMenu() {
    menu.hidden = true;
    navBar.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
  }

  burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') === 'true';
    if (open) { closeMenu(); return; }
    menu.hidden = false;
    navBar.classList.add('is-open');   // pill relaxes into a rounded rect to hold the panel
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      burger.focus();
    }
  });


  /* ── Headline word split ───────────────────────────────────────────────── */
  /* Wraps each word in a masked box so the words can rise into place individually.
     Done in JS because the markup would be unreadable by hand and unmaintainable if
     the copy ever changes. Only text nodes are touched, so nested markup survives and
     the heading still reads as one string to a screen reader. */

  document.querySelectorAll('[data-split]').forEach(function (el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var n;
    while ((n = walker.nextNode())) { if (n.nodeValue.trim()) textNodes.push(n); }

    var index = 0;
    textNodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (chunk) {
        if (!chunk) return;
        if (!chunk.trim()) { frag.appendChild(document.createTextNode(' ')); return; }
        var outer = document.createElement('span');
        var inner = document.createElement('span');
        outer.className = 'word';
        inner.className = 'word__inner';
        inner.textContent = chunk;
        inner.style.setProperty('--w', index++);
        outer.appendChild(inner);
        frag.appendChild(outer);
      });
      node.parentNode.replaceChild(frag, node);
    });
  });


  /* ── Scrollspy: the travelling nav highlight ───────────────────────────── */
  /* A thin band across the middle of the viewport decides the current section. A
     section owns the highlight while it crosses that band, so the pill changes over
     at a consistent point on screen no matter how tall the section is.

     Still no scroll listener: the band is expressed as a negative rootMargin. */

  var navLinks = [].slice.call(document.querySelectorAll('.nav__links a'));
  var indicator = document.getElementById('nav-indicator');
  var navInner = document.querySelector('.nav__inner');
  var menuLinks = [].slice.call(document.querySelectorAll('.mobile-menu a[href^="#"]'));

  if (navLinks.length && indicator) {
    var navIds = navLinks.map(function (a) { return a.getAttribute('href').slice(1); });
    var currentId = null;

    function place(id) {
      var link = null;
      for (var i = 0; i < navLinks.length; i++) {
        if (navIds[i] === id) { link = navLinks[i]; break; }
      }
      if (!link) { indicator.classList.remove('is-on'); return; }

      // Measure against the list, not the page, so the nav's own morph does not skew it.
      var r = link.getBoundingClientRect();
      var parent = link.parentElement.getBoundingClientRect();
      indicator.style.width = r.width + 'px';
      indicator.style.transform = 'translate3d(' + (r.left - parent.left) + 'px, 0, 0)';
      indicator.classList.add('is-on');
    }

    function setActive(id) {
      if (id === currentId) return;
      currentId = id;
      navLinks.concat(menuLinks).forEach(function (a) {
        if (id && a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      place(id);
    }

    // Re-measure whenever the labels could have moved under the highlight.
    function reposition() { if (currentId) place(currentId); }
    window.addEventListener('resize', reposition);
    navInner.addEventListener('transitionend', reposition);   // nav morph changes padding
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(reposition);                  // webfont swap changes label widths
    }

    /* Clicking commits immediately rather than waiting for the smooth scroll to land.
       While that scroll travels it passes through every section in between, and the
       observer would light each one in turn, so the highlight is pinned to the target
       until the target actually arrives. The timeout is a safety net for the case
       where a short trailing section never reaches the middle band. */
    var pendingId = null;
    var pendingTimer = 0;

    navLinks.concat(menuLinks).forEach(function (a) {
      a.addEventListener('click', function () {
        var id = a.getAttribute('href').slice(1);
        if (!document.getElementById(id)) return;
        pendingId = id;
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(function () { pendingId = null; }, 1600);
        setActive(id);
      });
    });

    if ('IntersectionObserver' in window) {
      var watched = ['top'].concat(navIds).map(function (id) { return document.getElementById(id); })
                           .filter(Boolean);
      var visible = Object.create(null);

      var spyObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });

        // First in document order wins, so scrolling up hands the highlight back cleanly.
        var active = null;
        for (var i = 0; i < watched.length; i++) {
          if (visible[watched[i].id]) { active = watched[i].id; break; }
        }

        // Pinned to a clicked target: swallow the sections we are scrolling past.
        if (pendingId) {
          if (active === pendingId) { pendingId = null; clearTimeout(pendingTimer); }
          return;
        }

        if (active === 'top') setActive(null);          // above the first linked section
        else if (active) setActive(active);
        // No band match (the closing CTA, the footer): keep the last section lit.
      }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });

      watched.forEach(function (el) { spyObserver.observe(el); });
    }
  }


  /* ── Scroll reveal ─────────────────────────────────────────────────────── */

  var reveals = document.querySelectorAll('[data-reveal]');

  function revealAll() {
    for (var i = 0; i < reveals.length; i++) reveals[i].classList.add('is-in');
  }

  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);           // one-shot; nothing re-animates on scroll back
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });

    reveals.forEach(function (el) { revealObserver.observe(el); });

    // If the visitor turns reduced motion on mid-session, stop hiding anything.
    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener('change', function (e) { if (e.matches) revealAll(); });
    }
  }


  /* ── Count-up ──────────────────────────────────────────────────────────── */
  /* The meter fills as the card arrives; the number should arrive with it rather than
     sitting there already finished. Runs once, and only if motion is welcome. */

  var counters = document.querySelectorAll('[data-count]');

  if (counters.length && 'IntersectionObserver' in window) {
    var countObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);

        var el = entry.target;
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';

        if (reduceMotion.matches) { el.textContent = target + suffix; return; }

        var started = null;
        var duration = 1100;

        function tick(now) {
          if (started === null) started = now;
          var t = Math.min((now - started) / duration, 1);
          var eased = 1 - Math.pow(1 - t, 3);          // matches the meter's ease-out
          el.textContent = Math.round(target * eased) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });

    counters.forEach(function (el) { countObserver.observe(el); });
  }


  /* ── Subject tiles: cursor spotlight ───────────────────────────────────── */
  /* Writes CSS custom properties directly. No state, no re-render, no rAF loop. */

  if (window.matchMedia('(hover: hover)').matches && !reduceMotion.matches) {
    document.querySelectorAll('.spotlight').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }


  /* ── Buttons: ripple from the press point ──────────────────────────────── */

  document.querySelectorAll('.btn').forEach(function (btn) {
    btn.addEventListener('pointerdown', function (e) {
      if (reduceMotion.matches) return;

      var r = btn.getBoundingClientRect();
      var size = Math.max(r.width, r.height);
      var ink = document.createElement('span');

      ink.className = 'ripple';
      ink.style.width = ink.style.height = size + 'px';
      ink.style.left = (e.clientX - r.left - size / 2) + 'px';
      ink.style.top  = (e.clientY - r.top  - size / 2) + 'px';

      btn.appendChild(ink);
      ink.addEventListener('animationend', function () { ink.remove(); });
    });
  });


  /* ── Teacher rail ──────────────────────────────────────────────────────── */

  var rail = document.getElementById('rail');
  var prev = document.getElementById('rail-prev');
  var next = document.getElementById('rail-next');

  if (rail && prev && next) {
    function step() {
      var card = rail.querySelector('.teacher');
      if (!card) return rail.clientWidth * 0.8;
      var gap = parseFloat(getComputedStyle(rail).columnGap) || 16;
      return card.getBoundingClientRect().width + gap;
    }

    function scrollRail(dir) {
      rail.scrollBy({
        left: step() * dir,
        behavior: reduceMotion.matches ? 'auto' : 'smooth'
      });
    }

    prev.addEventListener('click', function () { scrollRail(-1); });
    next.addEventListener('click', function () { scrollRail(1); });

    // Grey out an arrow when the rail cannot travel further that way.
    function syncArrows() {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      prev.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= max;
      prev.style.opacity = prev.disabled ? '.4' : '1';
      next.style.opacity = next.disabled ? '.4' : '1';
    }

    rail.addEventListener('scroll', syncArrows, { passive: true });
    window.addEventListener('resize', syncArrows);
    syncArrows();
  }

})();
