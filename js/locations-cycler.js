(function () {
  "use strict";

  var cycler = document.getElementById("locations-cycler");
  if (!cycler) return;

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  /* Travel times are estimates for on-farm driving/walking from Noxubee Lodge.
     Update travelMinutes below when exact drive times are known. */
  var LOCATIONS = [
    {
      name: "Noxubee Lodge",
      description: "Arrivals, meals, emulsion lift sessions, and evening talks",
      area: "Sumter Farm · Geiger, Alabama",
      travelMinutes: 0
    },
    {
      name: "Wild Horse Prairie",
      description: "Saturday pre-breakfast walk — <em>The Art of Seeing</em>",
      area: "Sumter Farm prairie tract",
      travelMinutes: 3
    },
    {
      name: "Betty and Bob Prairie",
      description: "Late afternoon field session on Saturday",
      area: "Sumter Farm prairie tract",
      travelMinutes: 5
    },
    {
      name: "Henley Pond",
      description: "Saturday afternoon walk alongside Betty and Bob Prairie",
      area: "Sumter Farm",
      travelMinutes: 4
    },
    {
      name: "#2 Prairie",
      description: "Sunday morning walk — light, pattern, and mood",
      area: "Sumter Farm prairie tract",
      travelMinutes: 7
    }
  ];

  /* 1 minute of travel time = 1 second of ring animation (5 min → 5 sec). */
  var MS_PER_TRAVEL_MINUTE = 1000;
  var MIN_CYCLE_MS = 3000;

  var progressRing = cycler.querySelector(".locations__ring-progress");
  var travelValue = document.getElementById("locations-travel-value");
  var travelLabel = document.getElementById("locations-travel-label");
  var nameEl = document.getElementById("locations-cycler-name");
  var descEl = document.getElementById("locations-cycler-desc");
  var areaEl = document.getElementById("locations-cycler-area");
  var indexEl = document.getElementById("locations-index");

  var activeIndex = 0;
  var rafId = null;
  var cycleStart = 0;
  var cycleDuration = MIN_CYCLE_MS;
  var circumference = 0;

  function padNum(index) {
    return String(index + 1).padStart(2, "0");
  }

  function getCycleDuration(minutes) {
    if (minutes <= 0) return MIN_CYCLE_MS;
    return minutes * MS_PER_TRAVEL_MINUTE;
  }

  function getTravelLabel(minutes) {
    if (minutes <= 0) return "Home";
    return minutes + " min";
  }

  function getTravelSubLabel(minutes) {
    if (minutes <= 0) return "base";
    return "from lodge";
  }

  function setRingProgress(progress) {
    if (!progressRing || !circumference) return;
    var clamped = Math.min(Math.max(progress, 0), 1);
    progressRing.style.strokeDashoffset = String(circumference * (1 - clamped));
  }

  function updateContent(index) {
    var location = LOCATIONS[index];

    if (travelValue) travelValue.textContent = getTravelLabel(location.travelMinutes);
    if (travelLabel) travelLabel.textContent = getTravelSubLabel(location.travelMinutes);
    if (nameEl) nameEl.textContent = location.name;
    if (descEl) descEl.innerHTML = location.description;
    if (areaEl) areaEl.textContent = location.area;

    if (indexEl) {
      var buttons = indexEl.querySelectorAll(".locations__index-btn");
      buttons.forEach(function (btn, i) {
        var isActive = i === index;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
      });
    }
  }

  function stopCycle() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function tick(now) {
    var elapsed = now - cycleStart;
    var progress = elapsed / cycleDuration;

    if (progress >= 1) {
      goToLocation((activeIndex + 1) % LOCATIONS.length);
      return;
    }

    setRingProgress(progress);
    rafId = requestAnimationFrame(tick);
  }

  function startCycle() {
    stopCycle();
    cycleDuration = getCycleDuration(LOCATIONS[activeIndex].travelMinutes);
    cycleStart = performance.now();
    setRingProgress(0);
    rafId = requestAnimationFrame(tick);
  }

  function goToLocation(index) {
    activeIndex = index;
    updateContent(activeIndex);
    startCycle();
  }

  function buildIndex() {
    if (!indexEl) return;

    LOCATIONS.forEach(function (location, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "locations__index-btn";
      btn.textContent = padNum(index);
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-label", location.name);
      btn.setAttribute("aria-selected", "false");

      btn.addEventListener("click", function () {
        goToLocation(index);
      });

      indexEl.appendChild(btn);
    });
  }

  function initRing() {
    if (!progressRing) return;

    var radius = progressRing.r.baseVal.value;
    circumference = 2 * Math.PI * radius;
    progressRing.style.strokeDasharray = String(circumference);
    progressRing.style.strokeDashoffset = String(circumference);
  }

  buildIndex();
  initRing();
  updateContent(activeIndex);
  startCycle();

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopCycle();
    } else {
      startCycle();
    }
  });
})();
