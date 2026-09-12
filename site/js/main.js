/* KEEL scroll story — GSAP + ScrollTrigger (+SplitText, +DrawSVG). Vanilla, no build. */
(function () {
  "use strict";
  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return; // CSS handles the static fallback

  /* ---------- hero: load-in ---------- */
  var heroSplit = new SplitText(".hero-title", { type: "chars" });
  gsap.timeline({ defaults: { ease: "power3.out" } })
    .from(heroSplit.chars, { yPercent: 60, opacity: 0, duration: 1.1, stagger: 0.06 }, 0.15)
    .from(".hero-kicker", { opacity: 0, y: -14, duration: 0.8 }, 0.4)
    .from(".hero-sub", { opacity: 0, y: 24, duration: 0.9 }, 0.75)
    .from(".hero-ship .ship-svg", { xPercent: -140, opacity: 0, duration: 1.6, ease: "power2.out" }, 0.35)
    .from(".scroll-cue", { opacity: 0, duration: 0.6 }, 1.2);

  /* hero: scroll-out — sky drifts slower than content (parallax), ship sails on */
  gsap.timeline({
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  })
    .to(".sky-img", { yPercent: 14, scale: 1.06, ease: "none" }, 0)
    .to(".hero-inner", { yPercent: -28, opacity: 0, ease: "none" }, 0)
    .to(".hero-ship .ship-svg", { xPercent: 60, yPercent: 8, rotate: -2, ease: "none" }, 0)
    .to(".scroll-cue", { opacity: 0 }, 0);

  /* ---------- helper: pinned beat sequence ---------- */
  function beatTimeline(sectionSel, beatsPerScreen) {
    var beats = gsap.utils.toArray(sectionSel + " .beat");
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionSel,
        start: "top top",
        end: "+=" + beats.length * (beatsPerScreen || 90) + "%",
        pin: true,
        scrub: 0.6
      }
    });
    beats.forEach(function (b, i) {
      tl.to(b, { autoAlpha: 1, y: 0, duration: 0.35 }, i);
      if (i < beats.length - 1) tl.to(b, { autoAlpha: 0, y: -26, duration: 0.35 }, i + 0.65);
    });
    return tl;
  }

  /* ---------- 01 the leak: binary search narrows the band ---------- */
  gsap.set("#problem .beat", { y: 26 });
  var leak = beatTimeline("#problem");
  // observations pop as beats advance; band collapses to the located threshold
  leak.to('[data-obs="0"]', { autoAlpha: 1, duration: 0.2 }, 1.0)
      .to("#huntBand", { scaleY: 0.55, duration: 0.5, ease: "power2.inOut" }, 1.05)
      .to('[data-obs="1"]', { autoAlpha: 1, duration: 0.2 }, 1.45)
      .to("#huntBand", { scaleY: 0.28, duration: 0.5, ease: "power2.inOut" }, 1.5)
      .to('[data-obs="2"]', { autoAlpha: 1, duration: 0.2 }, 2.0)
      .to("#huntBand", { scaleY: 0.02, duration: 0.5, ease: "power2.inOut" }, 2.05)
      .to("#huntTarget", { autoAlpha: 1, duration: 0.3 }, 2.45);

  /* ---------- 02 the jitter: the marker refuses to settle ---------- */
  gsap.set("#idea .beat", { y: 26 });
  var jit = beatTimeline("#idea", 100);
  // jitter marker hops to a fresh level each "round" — pseudo-random fixed draws
  var hops = [1.055, 1.083, 1.064, 1.092, 1.058, 1.088, 1.071];
  hops.forEach(function (hf, i) {
    var topPct = ((1.12 - hf) / 0.12) * 100;
    jit.to("#jitterMark", { top: topPct + "%", duration: 0.28, ease: "steps(1)" }, 0.6 + i * 0.45);
  });
  jit.to("#hardFloor", { autoAlpha: 1, duration: 0.3 }, 2.6);

  /* ---------- 03 the proof: horizontal pipeline ---------- */
  var track = document.getElementById("htrack");
  function trackShift() { return -(track.scrollWidth - window.innerWidth); }
  var hscroll = gsap.to(track, {
    x: trackShift,
    ease: "none",
    scrollTrigger: {
      trigger: "#pipeline",
      start: "top top",
      end: function () { return "+=" + (track.scrollWidth - window.innerWidth); },
      pin: true,
      scrub: 0.5,
      invalidateOnRefresh: true
    }
  });
  gsap.utils.toArray(".hcard").forEach(function (card) {
    gsap.from(card, {
      opacity: 0.25, scale: 0.94, ease: "none",
      scrollTrigger: {
        trigger: card, containerAnimation: hscroll,
        start: "left 90%", end: "left 55%", scrub: true
      }
    });
  });

  /* ---------- 04 the storm: lines draw, defends pop, undefended dies ---------- */
  gsap.set(["#defend1", "#defend2", "#skull", "#survive"], { autoAlpha: 0 });
  gsap.set(["#defend1", "#defend2"], { scale: 0.4, transformOrigin: "center center" });
  gsap.timeline({
    scrollTrigger: {
      trigger: "#storm", start: "top top", end: "+=220%", pin: true, scrub: 0.6
    }
  })
    .from("#liqLine", { drawSVG: "0%", duration: 0.5, ease: "none" }, 0)
    .from("#lineUnd", { drawSVG: "0%", duration: 2.4, ease: "none" }, 0.4)
    .from("#lineKeel", { drawSVG: "0%", duration: 2.4, ease: "none" }, 0.4)
    .to("#defend1", { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, 0.95)
    .to("#defend2", { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, 1.75)
    .to("#skull", { autoAlpha: 1, duration: 0.3 }, 2.0)
    .to("#survive", { autoAlpha: 1, duration: 0.3 }, 2.6);

  /* ---------- 05 stats count up (once, on enter) ---------- */
  gsap.utils.toArray(".stat b").forEach(function (el) {
    var target = parseInt(el.dataset.count, 10);
    var obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.6, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
      onUpdate: function () { el.textContent = Math.round(obj.v).toLocaleString("en-US"); }
    });
  });
  gsap.from(".term", {
    y: 60, opacity: 0, duration: 0.9, ease: "power3.out",
    scrollTrigger: { trigger: ".term", start: "top 85%", once: true }
  });

  /* ---------- 06 run: cards rise, footer ship sails in ---------- */
  ScrollTrigger.batch(".runcard, .links a", {
    start: "top 90%",
    once: true,
    onEnter: function (els) { gsap.from(els, { y: 40, opacity: 0, stagger: 0.12, duration: 0.8, ease: "power3.out" }); }
  });
  gsap.from(".foot-ship", {
    xPercent: -300, opacity: 0, ease: "power1.out",
    scrollTrigger: { trigger: ".foot", start: "top 95%", end: "top 60%", scrub: true }
  });

  /* refresh after images/fonts settle so pin distances are right */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
