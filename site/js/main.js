/* KEEL landing — scroll choreography. One scrubbed showpiece (the storm); everything else
   reveals once, fast, and gets out of the reader's way. */
(function () {
  "use strict";
  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (/[?&]nomotion/.test(location.search)) return; // static capture mode

  /* ---------- nav: solid after the hero ---------- */
  ScrollTrigger.create({
    trigger: ".hero", start: "bottom 90%",
    onEnter: function () { document.getElementById("nav").classList.add("is-solid"); },
    onLeaveBack: function () { document.getElementById("nav").classList.remove("is-solid"); }
  });

  /* ---------- hero: load ---------- */
  var h1 = new SplitText(".hero h1", { type: "lines", mask: "lines" });
  gsap.timeline({ defaults: { ease: "power3.out" } })
    .from(".hero-sky", { scale: 1.08, duration: 2.4, ease: "power2.out" }, 0)
    .from(h1.lines, { yPercent: 110, duration: 1, stagger: 0.14 }, 0.15)
    .from(".hero-sub", { y: 22, opacity: 0, duration: 0.8 }, 0.55)
    .from(".hero-actions", { y: 16, opacity: 0, duration: 0.7 }, 0.75)
    .from(".hero-ship", { y: 30, opacity: 0, duration: 0.9 }, 0.85);

  /* hero: gentle parallax out */
  gsap.to(".hero-sky", {
    yPercent: 14, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.8 }
  });
  gsap.to(".hero-inner", {
    yPercent: -12, opacity: 0.25, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 35%", scrub: 0.8 }
  });

  /* ---------- stat strip: rise + count ---------- */
  gsap.from(".stats", {
    y: 46, opacity: 0, duration: 0.9, ease: "power3.out",
    scrollTrigger: { trigger: ".stats", start: "top 96%", once: true }
  });
  gsap.utils.toArray(".stat b[data-count]").forEach(function (el) {
    var target = parseInt(el.dataset.count, 10);
    var obj = { v: 0 };
    el.textContent = "0";
    gsap.to(obj, {
      v: target, duration: 1.6, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
      onUpdate: function () { el.textContent = Math.round(obj.v).toLocaleString("en-US"); }
    });
  });

  /* ---------- section headlines: line mask rise ---------- */
  gsap.utils.toArray(".reveal-h").forEach(function (h) {
    var split = new SplitText(h, { type: "lines", mask: "lines" });
    gsap.from(split.lines, {
      yPercent: 115, duration: 0.85, stagger: 0.1, ease: "power3.out",
      scrollTrigger: { trigger: h, start: "top 86%", once: true }
    });
  });

  /* ---------- generic rise-ins ---------- */
  ScrollTrigger.batch(".sec-sub, .leak-points li, .card, .formula, .sec-note, .enc-facts li, .term, .close-card, .close-links a, .verdict-sub", {
    start: "top 92%", once: true,
    onEnter: function (els) {
      gsap.from(els, { y: 30, opacity: 0, stagger: 0.08, duration: 0.7, ease: "power3.out" });
    }
  });

  /* ---------- leak figure: bands collapse, target locks ---------- */
  var leakTl = gsap.timeline({
    scrollTrigger: { trigger: ".leak-fig", start: "top 78%", once: true },
    defaults: { ease: "power2.out" }
  });
  leakTl
    .from(".f-band.b1", { scaleY: 0, transformOrigin: "center center", duration: 0.5 }, 0)
    .from(".f-band.b2", { scaleY: 0, transformOrigin: "center center", duration: 0.5 }, 0.35)
    .from(".f-band.b3", { scaleY: 0, transformOrigin: "center center", duration: 0.5 }, 0.7)
    .from("#leakTarget", { drawSVG: "0%", duration: 0.45, ease: "none" }, 1.1)
    .from(".leak-fig figcaption", { opacity: 0, duration: 0.4 }, 1.35);

  /* ---------- storm: the one scrubbed showpiece ---------- */
  gsap.set(["#defend1", "#defend2", "#liqMark", "#surviveMark"], { autoAlpha: 0 });
  gsap.set(["#defend1", "#defend2"], { scale: 0.4, transformOrigin: "center center" });
  gsap.timeline({
    scrollTrigger: {
      trigger: ".storm", start: "top top", end: "+=150%", pin: ".storm-pin",
      scrub: 0.7, anticipatePin: 1
    },
    defaults: { ease: "none" }
  })
    .from("#liqLine", { drawSVG: "0%", duration: 0.4 }, 0)
    .from("#lineUnd", { drawSVG: "0%", duration: 2 }, 0.3)
    .from("#lineKeel", { drawSVG: "0%", duration: 2 }, 0.3)
    .to("#defend1", { autoAlpha: 1, scale: 1, duration: 0.2, ease: "back.out(2)" }, 0.75)
    .to("#defend2", { autoAlpha: 1, scale: 1, duration: 0.2, ease: "back.out(2)" }, 1.4)
    .to("#liqMark", { autoAlpha: 1, duration: 0.25 }, 1.8)
    .to("#surviveMark", { autoAlpha: 1, duration: 0.25 }, 2.1);

  /* ---------- pipeline: the line draws, steps land on it ---------- */
  gsap.from("#pipePath", {
    drawSVG: "0%", ease: "none",
    scrollTrigger: { trigger: ".pipe", start: "top 82%", end: "top 45%", scrub: 0.6 }
  });
  ScrollTrigger.batch(".pstep", {
    start: "top 90%", once: true,
    onEnter: function (els) {
      gsap.from(els, { y: 36, opacity: 0, stagger: 0.1, duration: 0.7, ease: "power3.out" });
    }
  });

  /* ---------- footer ship sails in ---------- */
  gsap.from(".foot-ship", {
    xPercent: -240, opacity: 0, ease: "power1.out",
    scrollTrigger: { trigger: ".foot", start: "top 96%", end: "top 65%", scrub: 0.8 }
  });

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
