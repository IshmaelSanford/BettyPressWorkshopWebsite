(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsapAvailable = typeof gsap !== "undefined";
  var scrollTriggerAvailable = gsapAvailable && typeof ScrollTrigger !== "undefined";
  var lenisAvailable = typeof Lenis !== "undefined";

  if (gsapAvailable && scrollTriggerAvailable) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* Preloader with progress
     ------------------------------------------------------------------------ */
  var preloader = document.getElementById("preloader");
  var preloaderFill = document.getElementById("preloader-fill");
  var preloaderPercent = document.getElementById("preloader-percent");
  var loadProgress = 0;

  function setLoadProgress(value) {
    loadProgress = Math.min(100, Math.max(0, value));
    if (preloaderFill) preloaderFill.style.width = loadProgress + "%";
    if (preloaderPercent) preloaderPercent.textContent = Math.round(loadProgress) + "%";
  }

  setLoadProgress(10);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setLoadProgress(40);
    });
  } else {
    setLoadProgress(40);
  }

  window.addEventListener("load", function () {
    setLoadProgress(100);
  });

  function hidePreloader() {
    if (!preloader || !gsapAvailable) {
      if (preloader) {
        preloader.classList.add("is-hidden");
        setTimeout(function () { preloader.remove(); }, 1000);
      }
      initAnimations();
      return;
    }

    gsap.to(preloader, {
      opacity: 0,
      duration: prefersReducedMotion ? 0 : 0.8,
      delay: prefersReducedMotion ? 0 : 0.3,
      ease: "power2.inOut",
      onComplete: function () {
        preloader.remove();
        initAnimations();
      }
    });
  }

  if (document.readyState === "complete") {
    setTimeout(hidePreloader, prefersReducedMotion ? 0 : 800);
  } else {
    window.addEventListener("load", function () {
      setTimeout(hidePreloader, prefersReducedMotion ? 0 : 800);
    });
  }

  /* Simulate loading progress
     ------------------------------------------------------------------------ */
  var progressInterval = setInterval(function () {
    if (loadProgress >= 90) {
      clearInterval(progressInterval);
      return;
    }
    setLoadProgress(loadProgress + Math.random() * 8);
  }, 120);

  window.addEventListener("load", function () {
    clearInterval(progressInterval);
  });

  /* Lenis smooth scroll
     ------------------------------------------------------------------------ */
  var lenis = null;

  function initLenis() {
    if (!lenisAvailable || prefersReducedMotion) return null;

    document.documentElement.classList.add("lenis", "lenis-smooth");

    lenis = new Lenis({
      duration: 1.2,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smoothWheel: true,
      touchMultiplier: 1.5
    });

    lenis.on("scroll", function () {
      if (scrollTriggerAvailable) ScrollTrigger.update();
    });

    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return lenis;
  }

  /* Split text into visual lines for scroll fill effect
     ------------------------------------------------------------------------ */
  function splitTextIntoLines(element) {
    var originalText = element.dataset.originalText || element.textContent.trim();
    element.dataset.originalText = originalText;

    var words = originalText.split(/\s+/);
    if (!words.length) return [];

    var styles = window.getComputedStyle(element);
    var width = element.getBoundingClientRect().width;

    var measure = document.createElement("div");
    measure.setAttribute("aria-hidden", "true");
    measure.style.cssText = [
      "position:absolute",
      "visibility:hidden",
      "pointer-events:none",
      "top:0",
      "left:-9999px",
      "width:" + width + "px",
      "font:" + styles.font,
      "letter-spacing:" + styles.letterSpacing,
      "word-spacing:" + styles.wordSpacing,
      "text-align:" + styles.textAlign,
      "line-height:" + styles.lineHeight
    ].join(";");
    document.body.appendChild(measure);

    var wordSpans = [];
    words.forEach(function (word, index) {
      var span = document.createElement("span");
      span.style.display = "inline";
      span.textContent = word + (index < words.length - 1 ? " " : "");
      measure.appendChild(span);
      wordSpans.push(span);
    });

    var lineGroups = [];
    var currentLine = [];
    var lastTop = null;

    wordSpans.forEach(function (span) {
      var top = span.offsetTop;
      if (lastTop !== null && Math.abs(top - lastTop) > 2) {
        lineGroups.push(currentLine);
        currentLine = [];
      }
      currentLine.push(span.textContent);
      lastTop = top;
    });

    if (currentLine.length) lineGroups.push(currentLine);
    document.body.removeChild(measure);

    element.textContent = "";
    element.setAttribute("aria-label", originalText);

    var lineElements = [];

    lineGroups.forEach(function (lineWords) {
      var lineText = lineWords.join("").replace(/\s+/g, " ").trim();

      var line = document.createElement("span");
      line.className = "text-line";

      var wrap = document.createElement("span");
      wrap.className = "text-line__wrap";

      var ghost = document.createElement("span");
      ghost.className = "text-line__ghost";
      ghost.textContent = lineText;
      ghost.setAttribute("aria-hidden", "true");

      var fill = document.createElement("span");
      fill.className = "text-line__fill";
      fill.textContent = lineText;

      wrap.appendChild(ghost);
      wrap.appendChild(fill);
      line.appendChild(wrap);
      element.appendChild(line);
      lineElements.push(line);
    });

    return lineElements;
  }

  function initTextFillAnimations() {
    document.querySelectorAll("[data-text-fill]").forEach(function (block) {
      if (block.dataset.linesSplit === "true") return;

      var lineElements = splitTextIntoLines(block);
      block.dataset.linesSplit = "true";

      if (!lineElements.length || prefersReducedMotion || !scrollTriggerAvailable) {
        block.querySelectorAll(".text-line__fill").forEach(function (fill) {
          fill.style.clipPath = "inset(0 0% 0 0)";
        });
        return;
      }

      lineElements.forEach(function (lineEl) {
        var fill = lineEl.querySelector(".text-line__fill");

        gsap.fromTo(
          fill,
          { clipPath: "inset(0 100% 0 0)" },
          {
            clipPath: "inset(0 0% 0 0)",
            ease: "none",
            scrollTrigger: {
              trigger: lineEl,
              start: "top 92%",
              end: "top 58%",
              scrub: 0.35,
              invalidateOnRefresh: true
            }
          }
        );
      });
    });

    if (scrollTriggerAvailable) ScrollTrigger.refresh();
  }

  function rebuildTextFillOnResize() {
    if (scrollTriggerAvailable) {
      ScrollTrigger.getAll().forEach(function (st) {
        var trigger = st.trigger;
        if (trigger && trigger.classList && trigger.classList.contains("text-line")) {
          st.kill();
        }
      });
    }

    document.querySelectorAll("[data-text-fill]").forEach(function (block) {
      if (block.dataset.originalText) {
        block.textContent = block.dataset.originalText;
        block.dataset.linesSplit = "false";
      }
    });

    initTextFillAnimations();
  }

  /* Split hero chars
     ------------------------------------------------------------------------ */
  function splitChars(element) {
    var text = element.textContent;
    element.textContent = "";
    element.setAttribute("aria-label", text);

    text.split("").forEach(function (char) {
      var span = document.createElement("span");
      span.className = "char";
      span.textContent = char === " " ? "\u00A0" : char;
      if (char === " ") span.style.width = "0.3em";
      element.appendChild(span);
    });
  }

  /* Scroll-linked parallax (transform-only, scrub)
     ------------------------------------------------------------------------ */
  function bindScrollParallax(target, options) {
    if (!scrollTriggerAvailable || prefersReducedMotion) return;

    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;

    var trigger = options.trigger
      ? (typeof options.trigger === "string" ? document.querySelector(options.trigger) : options.trigger)
      : el;
    if (!trigger) return;

    var tweenVars = {
      ease: "none",
      scrollTrigger: {
        trigger: trigger,
        start: options.start || "top bottom",
        end: options.end || "bottom top",
        scrub: options.scrub !== undefined ? options.scrub : true
      }
    };

    if (options.yPercent !== undefined) tweenVars.yPercent = options.yPercent;
    if (options.y !== undefined) tweenVars.y = options.y;
    if (options.scale !== undefined) tweenVars.scale = options.scale;

    gsap.to(el, tweenVars);
  }

  function initScrollParallax() {
    if (!scrollTriggerAvailable || prefersReducedMotion) return;

    document.querySelectorAll("[data-parallax]").forEach(function (el) {
      var amount = parseFloat(el.dataset.parallax);
      if (isNaN(amount)) return;

      bindScrollParallax(el, {
        yPercent: amount,
        trigger: el.dataset.parallaxTrigger || el.closest("section") || el,
        start: el.dataset.parallaxStart || "top bottom",
        end: el.dataset.parallaxEnd || "bottom top",
        scrub: el.dataset.parallaxScrub !== undefined ? parseFloat(el.dataset.parallaxScrub) : true
      });
    });

    document.querySelectorAll("[data-divider-reveal]").forEach(function (divider) {
      if (divider.closest("[data-parallax]")) return;
      bindScrollParallax(divider, { yPercent: 10 });
    });

    document.querySelectorAll("[data-section-divider-reveal]").forEach(function (divider) {
      if (divider.closest("[data-parallax]")) return;
      bindScrollParallax(divider, { yPercent: 10 });
    });

    document.querySelectorAll(".section-header").forEach(function (header) {
      if (header.closest("[data-parallax], .register__inner")) return;

      bindScrollParallax(header, {
        yPercent: -14,
        trigger: header.closest("section") || header
      });
    });

    document.querySelectorAll(".prologue .container, .register__inner").forEach(function (block) {
      bindScrollParallax(block, {
        yPercent: -10,
        trigger: block.closest("section") || block
      });
    });

    bindScrollParallax(".overview__highlights", {
      yPercent: -12,
      trigger: ".overview"
    });

    bindScrollParallax(".details__grid", {
      yPercent: -14,
      trigger: ".details"
    });

    bindScrollParallax(".locations__layout", {
      yPercent: -16,
      trigger: ".locations"
    });

    document.querySelectorAll(".overview .container--text").forEach(function (block, index) {
      bindScrollParallax(block, {
        yPercent: index % 2 === 0 ? -10 : -14,
        trigger: ".overview"
      });
    });

    bindScrollParallax(".site-footer__art", {
      yPercent: 12,
      trigger: ".site-footer"
    });
  }

  function getSectionDividerFlip(divider) {
    var preFlipped = divider.classList.contains("section-divider--pre-flipped");
    var toneAbove = divider.getAttribute("data-tone-above");
    var toneBelow = divider.getAttribute("data-tone-below");
    var flipX = divider.getAttribute("data-flip-x") === "true";
    var scaleX = flipX ? -1 : 1;
    var scaleY = 1;

    if (toneAbove === "dark" && toneBelow === "light") {
      scaleY = preFlipped ? 1 : -1;
    }

    return { scaleX: scaleX, scaleY: scaleY };
  }

  function sectionDividerRestTransform(flip) {
    var parts = [];

    if (flip.scaleX === -1) {
      parts.push("scaleX(-1)");
    }
    if (flip.scaleY === -1) {
      parts.push("scaleY(-1)");
    }

    return parts.length ? parts.join(" ") : "none";
  }

  /* Split section title lines
     ------------------------------------------------------------------------ */
  function splitTitleLines(element) {
    var text = element.textContent.trim();
    var words = text.split(/\s+/);
    element.textContent = "";

    var line = document.createElement("span");
    line.className = "title-line";
    var inner = document.createElement("span");
    inner.className = "title-line-inner";
    inner.textContent = text;
    line.appendChild(inner);
    element.appendChild(line);

    return inner;
  }

  /* Main animation init (after preloader)
     ------------------------------------------------------------------------ */
  function initAnimations() {
    if (prefersReducedMotion || !gsapAvailable) {
      document.querySelectorAll("[data-fade-up], .schedule-day, .detail-card, .overview__highlights li, .locations__map-wrap, .locations__item, .locations__cycler").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      document.querySelectorAll(".divider__thick, .divider__thin").forEach(function (el) {
        el.style.transform = "scaleX(1)";
      });
      document.querySelectorAll(".section-divider__art").forEach(function (el) {
        var divider = el.closest("[data-section-divider-reveal]");
        el.style.opacity = "1";
        el.style.transform = divider ? sectionDividerRestTransform(getSectionDividerFlip(divider)) : "none";
      });
      initTextFillAnimations();
      return;
    }

    initLenis();

    /* Hero character animation */
    document.querySelectorAll("[data-split-chars]").forEach(splitChars);

    var heroChars = document.querySelectorAll(".hero__title-line .char");
    if (heroChars.length) {
      gsap.to(heroChars, {
        y: 0,
        opacity: 1,
        duration: 1.2,
        stagger: 0.03,
        ease: "power4.out",
        delay: 0.2
      });
    }

    gsap.to(".hero__eyebrow, .hero__subtitle, .hero__meta, .hero .btn", {
      y: 0,
      opacity: 1,
      duration: 1,
      stagger: 0.15,
      ease: "power3.out",
      delay: 0.6
    });

    /* Hero parallax — layered depth (bg faster, content slower) */
    if (scrollTriggerAvailable) {
      bindScrollParallax("#hero-bg", {
        yPercent: 38,
        trigger: ".hero",
        start: "top top",
        end: "bottom top"
      });

      bindScrollParallax(".hero__bg img", {
        scale: 1.24,
        trigger: ".hero",
        start: "top top",
        end: "bottom top"
      });

      bindScrollParallax(".hero__scrim", {
        yPercent: 14,
        trigger: ".hero",
        start: "top top",
        end: "bottom top"
      });

      bindScrollParallax(".hero__content", {
        yPercent: -22,
        trigger: ".hero",
        start: "top top",
        end: "bottom top"
      });

      bindScrollParallax(".hero__scroll", {
        yPercent: -32,
        trigger: ".hero",
        start: "top top",
        end: "bottom top"
      });
    }

    /* Section title line reveals */
    document.querySelectorAll("[data-split-lines]").forEach(function (el) {
      var inner = splitTitleLines(el);
      gsap.to(inner, {
        y: 0,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none reverse"
        }
      });
    });

    /* Text fill — each visual line fills independently on scroll */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(initTextFillAnimations);
    } else {
      initTextFillAnimations();
    }

    /* Divider line reveal */
    document.querySelectorAll("[data-divider-reveal]").forEach(function (divider) {
      var thick = divider.querySelector(".divider__thick");
      var thin = divider.querySelector(".divider__thin");

      gsap.to(thick, {
        scaleX: 1,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: {
          trigger: divider,
          start: "top 90%",
          toggleActions: "play none none reverse"
        }
      });

      gsap.to(thin, {
        scaleX: 1,
        duration: 1.2,
        delay: 0.15,
        ease: "power4.out",
        scrollTrigger: {
          trigger: divider,
          start: "top 90%",
          toggleActions: "play none none reverse"
        }
      });
    });

    /* Section treeline divider reveal */
    document.querySelectorAll("[data-section-divider-reveal]").forEach(function (divider) {
      var art = divider.querySelector(".section-divider__art");
      if (!art) return;

      var flip = getSectionDividerFlip(divider);

      gsap.fromTo(
        art,
        {
          scaleX: flip.scaleX,
          scaleY: 0,
          opacity: 0,
          transformOrigin: "center bottom"
        },
        {
          scaleX: flip.scaleX,
          scaleY: flip.scaleY,
          opacity: 1,
          duration: 1.4,
          ease: "power4.out",
          scrollTrigger: {
            trigger: divider,
            start: "top 92%",
            toggleActions: "play none none reverse"
          }
        }
      );
    });

    /* Fade up elements */
    document.querySelectorAll("[data-fade-up]").forEach(function (el) {
      gsap.to(el, {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none reverse"
        }
      });
    });

    /* Schedule slider enters on scroll */
    var scheduleSlider = document.getElementById("schedule-slider");
    if (scheduleSlider) {
      gsap.to(scheduleSlider, {
        y: 0,
        opacity: 1,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: scheduleSlider,
          start: "top 82%",
          toggleActions: "play none none reverse"
        }
      });
    }

    /* Detail cards stagger */
    var detailCards = document.querySelectorAll(".detail-card");
    if (detailCards.length) {
      gsap.to(detailCards, {
        y: 0,
        opacity: 1,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".details__grid",
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });
    }

    /* Overview highlights stagger */
    var highlights = document.querySelectorAll(".overview__highlights li");
    if (highlights.length) {
      gsap.to(highlights, {
        y: 0,
        opacity: 1,
        duration: 1,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".overview__highlights",
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });
    }

    /* Locations map and list stagger */
    var locationsMap = document.querySelector(".locations__map-wrap");
    if (locationsMap) {
      gsap.to(locationsMap, {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".locations__layout",
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });
    }

    var locationsCycler = document.querySelector(".locations__cycler");
    if (locationsCycler) {
      gsap.to(locationsCycler, {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".locations__list-wrap",
          start: "top 82%",
          toggleActions: "play none none reverse"
        }
      });
    }

    var locationItems = document.querySelectorAll(".locations__list--fallback .locations__item");
    if (locationItems.length) {
      gsap.to(locationItems, {
        y: 0,
        opacity: 1,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".locations__list--fallback",
          start: "top 82%",
          toggleActions: "play none none reverse"
        }
      });
    }

    /* Scroll parallax — data-parallax attrs + section layers */
    initScrollParallax();

    /* Register section */
    gsap.to(".register__actions, .register__contact", {
      y: 0,
      opacity: 1,
      duration: 1,
      stagger: 0.2,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".register__actions",
        start: "top 85%",
        toggleActions: "play none none reverse"
      }
    });

    ScrollTrigger.refresh();
  }

  /* Header hide on scroll down, show on scroll up
     ------------------------------------------------------------------------ */
  var header = document.querySelector(".site-header");
  var lastScroll = 0;

  if (header) {
    window.addEventListener("scroll", function () {
      var currentScroll = window.scrollY;
      header.classList.toggle("is-scrolled", currentScroll > 60);

      if (!prefersReducedMotion && currentScroll > 200) {
        header.classList.toggle("is-hidden", currentScroll > lastScroll && currentScroll > 400);
      } else {
        header.classList.remove("is-hidden");
      }

      lastScroll = currentScroll;
    }, { passive: true });
  }

  /* Mobile navigation
     ------------------------------------------------------------------------ */
  var navToggle = document.getElementById("nav-toggle");
  var siteNav = document.getElementById("site-nav");

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");

      if (lenis) {
        if (isOpen) lenis.stop();
        else lenis.start();
      }
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
        if (lenis) lenis.start();
      });
    });
  }

  /* Smooth anchor scrolling via Lenis
     ------------------------------------------------------------------------ */
  var headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-height"), 10) || 80;

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (event) {
      var targetId = anchor.getAttribute("href");
      if (!targetId || targetId === "#") return;

      var target = document.querySelector(targetId);
      if (!target) return;

      event.preventDefault();

      if (lenis) {
        lenis.scrollTo(target, { offset: -headerHeight, duration: 1.5 });
      } else {
        var top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ top: top, behavior: prefersReducedMotion ? "auto" : "smooth" });
      }
    });
  });

  /* Magnetic button hover
     ------------------------------------------------------------------------ */
  if (!prefersReducedMotion && gsapAvailable) {
    document.querySelectorAll(".btn--magnetic").forEach(function (btn) {
      btn.addEventListener("mousemove", function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        gsap.to(btn, {
          x: x * 0.15,
          y: y * 0.15,
          duration: 0.4,
          ease: "power2.out"
        });
      });

      btn.addEventListener("mouseleave", function () {
        gsap.to(btn, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: "elastic.out(1, 0.5)"
        });
      });
    });
  }

  /* Resize refresh
     ------------------------------------------------------------------------ */
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuildTextFillOnResize, 300);
  });
})();
