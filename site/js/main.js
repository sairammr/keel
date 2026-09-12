/* KEEL — The Argument. One authored motion idea: ledger slips file in beside the
   passage that cites them; figures draw once on entry. No pinning, no scroll-jack. */
(function () {
  "use strict";
  gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (/[?&]nomotion/.test(location.search)) return; // static capture mode

  /* hero: one quiet entrance */
  gsap.timeline({ defaults: { ease: "power3.out" } })
    .from(".hero h1", { y: 26, opacity: 0, duration: 0.9 }, 0.1)
    .from(".hero-thesis, .hero-line", { y: 18, opacity: 0, duration: 0.8, stagger: 0.12 }, 0.35)
    .from(".hero-actions", { y: 14, opacity: 0, duration: 0.7 }, 0.6)
    .from(".hero-ship", { x: -60, opacity: 0, duration: 1.2, ease: "power2.out" }, 0.4);

  /* signature: slips file in from the right and settle onto their pin rotation */
  gsap.utils.toArray(".slip").forEach(function (slip, i) {
    var settle = gsap.getProperty(slip, "rotate");
    gsap.from(slip, {
      x: 48, opacity: 0, rotate: settle + 2.5,
      duration: 0.75, delay: (i % 3) * 0.08, ease: "power3.out",
      scrollTrigger: { trigger: slip, start: "top 88%", once: true }
    });
  });

  /* figure 1: the hunt bands step in */
  gsap.from("#leak .f-band", {
    scaleY: 0, transformOrigin: "center center", stagger: 0.25, duration: 0.6, ease: "power2.out",
    scrollTrigger: { trigger: "#leak .fig", start: "top 80%", once: true }
  });
  gsap.from("#leak .f-target", {
    drawSVG: "0%", duration: 0.4, delay: 1.1, ease: "none",
    scrollTrigger: { trigger: "#leak .fig", start: "top 80%", once: true }
  });

  /* figure 2: the storm draws itself once */
  var storm = gsap.timeline({
    scrollTrigger: { trigger: "#storm .fig-wide", start: "top 78%", once: true },
    defaults: { ease: "power1.inOut" }
  });
  gsap.set(["#defend1", "#defend2", "#liqMark", "#surviveMark"], { autoAlpha: 0 });
  storm
    .from("#liqLine", { drawSVG: "0%", duration: 0.5 }, 0)
    .from("#lineUnd", { drawSVG: "0%", duration: 1.6 }, 0.3)
    .from("#lineKeel", { drawSVG: "0%", duration: 1.6 }, 0.3)
    .to("#defend1", { autoAlpha: 1, duration: 0.25 }, 0.75)
    .to("#defend2", { autoAlpha: 1, duration: 0.25 }, 1.35)
    .to("#liqMark", { autoAlpha: 1, duration: 0.3 }, 1.6)
    .to("#surviveMark", { autoAlpha: 1, duration: 0.3 }, 1.95);

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
