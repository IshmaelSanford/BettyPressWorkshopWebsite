(function () {
  "use strict";

  var slider = document.getElementById("schedule-slider");
  if (!slider) return;

  var tabs = slider.querySelectorAll(".schedule-tab");
  var panels = slider.querySelectorAll(".schedule-panel");
  var indicatorFill = slider.querySelector(".schedule-slider__indicator-fill");
  var viewport = slider.querySelector(".schedule-slider__viewport");
  var prevBtn = slider.querySelector(".schedule-slider__arrow--prev");
  var nextBtn = slider.querySelector(".schedule-slider__arrow--next");
  var counterCurrent = slider.querySelector(".schedule-slider__counter-current");

  var activeIndex = 0;
  var isAnimating = false;
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsapAvailable = typeof gsap !== "undefined";

  function padNum(index) {
    return String(index + 1).padStart(2, "0");
  }

  function getPanelHeight(panel) {
    panel.hidden = false;
    panel.style.visibility = "hidden";
    panel.style.position = "absolute";
    panel.style.pointerEvents = "none";
    var height = panel.offsetHeight;
    panel.style.visibility = "";
    panel.style.position = "";
    panel.style.pointerEvents = "";
    if (!panel.classList.contains("is-active")) {
      panel.hidden = true;
    }
    return height;
  }

  function updateIndicator(index, animate) {
    if (!indicatorFill || !tabs.length) return;

    var tab = tabs[index];
    var tabRect = tab.getBoundingClientRect();
    var trackRect = tab.parentElement.getBoundingClientRect();
    var left = tabRect.left - trackRect.left;
    var width = tabRect.width;

    if (gsapAvailable && animate && !prefersReducedMotion) {
      gsap.to(indicatorFill, {
        x: left,
        width: width,
        duration: 0.7,
        ease: "power3.inOut"
      });
    } else {
      indicatorFill.style.transform = "translateX(" + left + "px)";
      indicatorFill.style.width = width + "px";
    }
  }

  function updateControls(index) {
    if (counterCurrent) counterCurrent.textContent = padNum(index);
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === panels.length - 1;
  }

  function setActiveTab(index) {
    tabs.forEach(function (tab, i) {
      var isActive = i === index;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
  }

  function animatePanelItems(panel) {
    var items = panel.querySelectorAll(".schedule-day__events li");
    if (!items.length || !gsapAvailable || prefersReducedMotion) return;

    gsap.fromTo(
      items,
      { opacity: 0, y: 28, clipPath: "inset(0 0 100% 0)" },
      {
        opacity: 1,
        y: 0,
        clipPath: "inset(0 0 0% 0)",
        duration: 0.65,
        stagger: 0.08,
        ease: "power3.out"
      }
    );
  }

  function switchDay(index, options) {
    options = options || {};
    if (index === activeIndex || isAnimating) return;
    if (index < 0 || index >= panels.length) return;

    var direction = index > activeIndex ? 1 : -1;
    var outgoing = panels[activeIndex];
    var incoming = panels[index];

    isAnimating = true;
    setActiveTab(index);
    updateIndicator(index, true);
    updateControls(index);

    if (!gsapAvailable || prefersReducedMotion) {
      outgoing.classList.remove("is-active");
      outgoing.hidden = true;
      incoming.hidden = false;
      incoming.classList.add("is-active");
      if (viewport) viewport.style.height = incoming.offsetHeight + "px";
      activeIndex = index;
      isAnimating = false;
      return;
    }

    incoming.hidden = false;
    incoming.classList.add("is-active");
    var incomingHeight = getPanelHeight(incoming);

    gsap.set(incoming, {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      opacity: 0,
      x: direction * 48,
      filter: "blur(6px)"
    });

    var tl = gsap.timeline({
      onComplete: function () {
        outgoing.classList.remove("is-active");
        outgoing.hidden = true;
        gsap.set(outgoing, { clearProps: "opacity,transform,filter,position,top,left,width" });
        gsap.set(incoming, { clearProps: "position,top,left,width,filter" });
        activeIndex = index;
        isAnimating = false;
        if (scrollTriggerAvailable) ScrollTrigger.refresh();
      }
    });

    tl.to(outgoing, {
      opacity: 0,
      x: direction * -48,
      filter: "blur(4px)",
      duration: 0.45,
      ease: "power2.in"
    });

    tl.to(
      viewport,
      {
        height: incomingHeight,
        duration: 0.65,
        ease: "power3.inOut"
      },
      "-=0.2"
    );

    tl.to(
      incoming,
      {
        opacity: 1,
        x: 0,
        filter: "blur(0px)",
        duration: 0.65,
        ease: "power3.out"
      },
      "-=0.45"
    );

    tl.add(function () {
      animatePanelItems(incoming);
    }, "-=0.35");

    if (options.pulseTab !== false) {
      tl.to(
        tabs[index].querySelector(".schedule-tab__num"),
        {
          scale: 1.08,
          duration: 0.25,
          yoyo: true,
          repeat: 1,
          ease: "power2.out"
        },
        "-=0.5"
      );
    }
  }

  var scrollTriggerAvailable = gsapAvailable && typeof ScrollTrigger !== "undefined";

  function init() {
    if (viewport && panels[0]) {
      viewport.style.height = panels[0].offsetHeight + "px";
    }

    updateIndicator(0, false);
    updateControls(0);
    animatePanelItems(panels[0]);

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchDay(parseInt(tab.dataset.index, 10));
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        switchDay(activeIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        switchDay(activeIndex + 1);
      });
    }

    slider.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        switchDay(activeIndex - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        switchDay(activeIndex + 1);
      }
    });

    var touchStartX = 0;
    viewport.addEventListener(
      "touchstart",
      function (event) {
        touchStartX = event.changedTouches[0].screenX;
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchend",
      function (event) {
        var deltaX = event.changedTouches[0].screenX - touchStartX;
        if (Math.abs(deltaX) < 50) return;
        if (deltaX < 0) switchDay(activeIndex + 1);
        else switchDay(activeIndex - 1);
      },
      { passive: true }
    );

    window.addEventListener("resize", function () {
      var panel = panels[activeIndex];
      if (viewport && panel && !panel.hidden) {
        viewport.style.height = panel.offsetHeight + "px";
      }
      updateIndicator(activeIndex, false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ScheduleSlider = {
    switchDay: switchDay,
    getActiveIndex: function () {
      return activeIndex;
    }
  };
})();
