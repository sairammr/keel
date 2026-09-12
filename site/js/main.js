/* KEEL scroll story — GSAP + ScrollTrigger (+SplitText, +DrawSVG). */
(function () {
  "use strict";
  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return; // CSS handles the static fallback

  /* ---------- the flow: gentle per-element drift while its section crosses the viewport ---------- */
  gsap.utils.toArray("[data-drift]").forEach(function (el) {
    var d = parseFloat(el.dataset.drift) || 20;
    gsap.fromTo(el, { y: d }, {
      y: -d, ease: "none",
      scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1.2 }
    });
  });

  /* ---------- hero: load-in ---------- */
  var heroSplit = new SplitText(".hero-title", { type: "chars" });
  gsap.timeline({ defaults: { ease: "power3.out" } })
    .from(heroSplit.chars, { yPercent: 70, opacity: 0, duration: 1.3, stagger: 0.07, ease: "expo.out" }, 0.15)
    .from(".hero-kicker", { opacity: 0, y: -14, duration: 0.9 }, 0.5)
    .from(".hero-sub", { opacity: 0, y: 26, filter: "blur(6px)", duration: 1.1 }, 0.85)
    .from(".hero-ship .ship-svg", { xPercent: -160, opacity: 0, duration: 1.9, ease: "power2.out" }, 0.35)
    .from("#compassHero", { opacity: 0, rotate: -30, duration: 2, ease: "power2.out" }, 0.6)
    .from(".scroll-cue", { opacity: 0, duration: 0.7 }, 1.4);

  /* hero: scroll-out — layered parallax drift */
  gsap.timeline({
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 }
  })
    .to(".sky-img", { yPercent: 16, scale: 1.08, ease: "none" }, 0)
    .to(".hero-inner", { yPercent: -20, opacity: 0, filter: "blur(4px)", ease: "none" }, 0)
    .to(".hero-ship .ship-svg", { xPercent: 70, yPercent: 6, rotate: -2, ease: "none" }, 0)
    .to(".scroll-cue", { opacity: 0 }, 0);

  /* slow compass spins, tied to overall scroll */
  gsap.to("#compassHero", {
    rotate: 120, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.5 }
  });
  gsap.to("#compassRun", {
    rotate: 90, ease: "none",
    scrollTrigger: { trigger: "#run", start: "top bottom", end: "bottom top", scrub: 2 }
  });

  /* ---------- helper: pinned beat sequence with soft blur crossfades ---------- */
  function beatTimeline(sectionSel, beatsPerScreen) {
    var beats = gsap.utils.toArray(sectionSel + " .beat");
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionSel,
        start: "top top",
        end: "+=" + beats.length * (beatsPerScreen || 90) + "%",
        pin: true,
        scrub: 1
      }
    });
    beats.forEach(function (b, i) {
      tl.fromTo(b,
        { autoAlpha: 0, y: 34, filter: "blur(8px)" },
        { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.4, ease: "power2.out" }, i);
      if (i < beats.length - 1)
        tl.to(b, { autoAlpha: 0, y: -30, filter: "blur(8px)", duration: 0.4, ease: "power2.in" }, i + 0.62);
    });
    return tl;
  }

  /* ---------- 01 the leak ---------- */
  var leak = beatTimeline("#problem");
  leak.to('[data-obs="0"]', { autoAlpha: 1, x: 8, duration: 0.2 }, 1.0)
      .to("#huntBand", { scaleY: 0.55, duration: 0.55, ease: "power2.inOut" }, 1.05)
      .to('[data-obs="1"]', { autoAlpha: 1, x: 8, duration: 0.2 }, 1.45)
      .to("#huntBand", { scaleY: 0.28, duration: 0.55, ease: "power2.inOut" }, 1.5)
      .to('[data-obs="2"]', { autoAlpha: 1, x: 8, duration: 0.2 }, 2.0)
      .to("#huntBand", { scaleY: 0.02, duration: 0.55, ease: "power2.inOut" }, 2.05)
      .to("#huntTarget", { autoAlpha: 1, duration: 0.3 }, 2.45);

  /* ---------- 02 the jitter ---------- */
  var jit = beatTimeline("#idea", 100);
  var hops = [1.055, 1.083, 1.064, 1.092, 1.058, 1.088, 1.071];
  hops.forEach(function (hf, i) {
    var topPct = ((1.12 - hf) / 0.12) * 100;
    jit.to("#jitterMark", { top: topPct + "%", duration: 0.28, ease: "steps(1)" }, 0.6 + i * 0.45);
  });
  jit.to("#hardFloor", { autoAlpha: 1, duration: 0.3 }, 2.6);

  /* ---------- 03 the proof: horizontal pipeline + progress ---------- */
  var track = document.getElementById("htrack");
  var hscroll = gsap.to(track, {
    x: function () { return -(track.scrollWidth - window.innerWidth); },
    ease: "none",
    scrollTrigger: {
      trigger: "#pipeline",
      start: "top top",
      end: function () { return "+=" + (track.scrollWidth - window.innerWidth); },
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: function (self) { gsap.set(".hprogress i", { scaleX: self.progress }); }
    }
  });
  gsap.utils.toArray(".hcard").forEach(function (card) {
    gsap.from(card, {
      opacity: 0.2, scale: 0.93, yPercent: 4, ease: "none",
      scrollTrigger: {
        trigger: card, containerAnimation: hscroll,
        start: "left 95%", end: "left 55%", scrub: true
      }
    });
  });
  /* anchors drift against the track direction */
  gsap.to(".anchor-float.a1", { yPercent: 40, rotate: -10, ease: "none",
    scrollTrigger: { trigger: "#pipeline", start: "top top", end: "bottom top", scrub: 1.5 } });
  gsap.to(".anchor-float.a2", { yPercent: -50, rotate: 26, ease: "none",
    scrollTrigger: { trigger: "#pipeline", start: "top top", end: "bottom top", scrub: 1.5 } });

  /* ---------- 04 the storm ---------- */
  gsap.set(["#defend1", "#defend2", "#skull", "#survive"], { autoAlpha: 0 });
  gsap.set(["#defend1", "#defend2"], { scale: 0.4, transformOrigin: "center center" });
  gsap.timeline({
    scrollTrigger: {
      trigger: "#storm", start: "top top", end: "+=220%", pin: true, scrub: 1
    }
  })
    .to(".cloud-a", { xPercent: 6, ease: "none", duration: 3 }, 0)
    .to(".cloud-b", { xPercent: -8, ease: "none", duration: 3 }, 0)
    .from("#liqLine", { drawSVG: "0%", duration: 0.5, ease: "none" }, 0)
    .from("#lineUnd", { drawSVG: "0%", duration: 2.4, ease: "none" }, 0.4)
    .from("#lineKeel", { drawSVG: "0%", duration: 2.4, ease: "none" }, 0.4)
    .to("#defend1", { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, 0.95)
    .to("#defend2", { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, 1.75)
    .to("#skull", { autoAlpha: 1, duration: 0.3 }, 2.0)
    .to("#survive", { autoAlpha: 1, duration: 0.3 }, 2.6);

  /* ---------- section headline line-reveals (non-pinned sections) ---------- */
  gsap.utils.toArray(".reveal-h").forEach(function (h) {
    var split = new SplitText(h, { type: "lines", mask: "lines" });
    gsap.from(split.lines, {
      yPercent: 115, duration: 0.9, stagger: 0.12, ease: "power3.out",
      scrollTrigger: { trigger: h, start: "top 85%", once: true }
    });
  });

  /* ---------- 05 stats count up ---------- */
  gsap.utils.toArray(".stat b").forEach(function (el) {
    var target = parseInt(el.dataset.count, 10);
    var obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.8, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
      onUpdate: function () { el.textContent = Math.round(obj.v).toLocaleString("en-US"); }
    });
  });
  gsap.from(".term", {
    y: 70, opacity: 0, filter: "blur(6px)", duration: 1.1, ease: "power3.out",
    scrollTrigger: { trigger: ".term", start: "top 88%", once: true }
  });

  /* ---------- wavebars breathe in ---------- */
  gsap.utils.toArray(".wavebar").forEach(function (bar) {
    gsap.from(bar.querySelectorAll("svg"), {
      y: 14, opacity: 0, stagger: 0.1, duration: 0.7, ease: "power2.out",
      scrollTrigger: { trigger: bar, start: "top 92%", once: true }
    });
    gsap.from(bar.querySelectorAll(".waveline"), {
      scaleX: 0, duration: 1.1, ease: "power2.out",
      scrollTrigger: { trigger: bar, start: "top 92%", once: true }
    });
  });

  /* ---------- 06 run ---------- */
  ScrollTrigger.batch(".runcard, .links a", {
    start: "top 92%",
    once: true,
    onEnter: function (els) {
      gsap.from(els, { y: 46, opacity: 0, filter: "blur(5px)", stagger: 0.12, duration: 0.9, ease: "power3.out" });
    }
  });
  gsap.from(".foot-ship", {
    xPercent: -300, opacity: 0, ease: "power1.out",
    scrollTrigger: { trigger: ".foot", start: "top 95%", end: "top 55%", scrub: 1 }
  });

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
