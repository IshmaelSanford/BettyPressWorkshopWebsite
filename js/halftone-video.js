(function () {
  "use strict";

  var section = document.getElementById("halftone");
  if (!section) return;

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Grid geometry — keep in sync with scripts/bake-halftone.py */
  var CELL_W = 6;
  var CELL_H = 7;
  var ROW_OVERLAP = 2;
  var DARKNESS_THRESHOLD = 0.07;
  var DARKNESS_FULL = 0.30;

  var FG = "#2a2622";

  var BG_LUMINANCE = 0.72;
  var BG_MIN_CHANNEL = 188;
  var BG_COLOR_DISTANCE = 58;
  var CELL_BG_RATIO = 0.34;
  var CELL_AVG_LUMINANCE = 0.68;

  /* Reference viewport — match bake-halftone.py for consistent grid density */
  var MAX_STAGE_W = 0.96;
  var MAX_STAGE_H = 0.92;
  var REF_VIEWPORT_W = 1200;
  var REF_VIEWPORT_H = 900;

  var bakedMq = window.matchMedia("(min-width: 901px)");
  var lowEndDevice =
    (navigator.hardwareConcurrency || 4) <= 4 ||
    (navigator.connection && navigator.connection.saveData);

  var liveModeActive = false;
  var bakedModeActive = false;
  var liveStopFn = null;

  function shouldUseBaked() {
    return bakedMq.matches;
  }

  function initBakedMode(bakedVideo) {
    if (bakedModeActive) return;
    bakedModeActive = true;
    section.classList.add("halftone-section--baked");

    function setPlaying(playing) {
      if (document.hidden) {
        bakedVideo.pause();
        return;
      }

      if (prefersReducedMotion) {
        bakedVideo.pause();
        if (bakedVideo.readyState >= 2) bakedVideo.currentTime = 0;
        return;
      }

      if (playing) bakedVideo.play().catch(function () {});
      else bakedVideo.pause();
    }

    if (typeof IntersectionObserver !== "undefined") {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            setPlaying(entry.isIntersecting);
          });
        },
        { threshold: 0.05 }
      );
      observer.observe(section);
    } else if (!prefersReducedMotion) {
      setPlaying(true);
    }

    if (prefersReducedMotion && bakedVideo.readyState >= 2) {
      bakedVideo.currentTime = 0;
      bakedVideo.pause();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) bakedVideo.pause();
    });
  }

  function initLiveMode() {
    if (liveModeActive || bakedModeActive) return;
    liveModeActive = true;
    section.classList.remove("halftone-section--baked");

    var video = section.querySelector(".halftone-video__source");
    var canvas = section.querySelector(".halftone-video__canvas");
    if (!video || !canvas) return;

    var ctx = canvas.getContext("2d");
    var offscreen = document.createElement("canvas");
    var offCtx = offscreen.getContext("2d", { willReadFrequently: true });

    var cols = 0;
    var rows = 0;
    var cellDisplayW = CELL_W;
    var cellDisplayH = CELL_H;
    var dpr = Math.min(window.devicePixelRatio || 1, lowEndDevice ? 1.25 : 2);
    var maxLiveWidth = lowEndDevice ? 880 : 1152;
    var targetFrameMs = lowEndDevice ? 1000 / 20 : 1000 / 30;
    var rafId = null;
    var isActive = false;
    var sourceLoaded = false;
    var lastFrameTime = 0;

    function luminance(r, g, b) {
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    function readPixel(data, stride, x, y) {
      var i = y * stride + x * 4;
      return { r: data[i], g: data[i + 1], b: data[i + 2] };
    }

    function detectBackgroundColor(data, stride, width, height) {
      var points = [
        [2, 2],
        [width - 3, 2],
        [2, height - 3],
        [width - 3, height - 3],
        [Math.floor(width * 0.5), 2],
        [Math.floor(width * 0.5), height - 3],
        [2, Math.floor(height * 0.5)],
        [width - 3, Math.floor(height * 0.5)]
      ];

      var rSum = 0;
      var gSum = 0;
      var bSum = 0;

      points.forEach(function (pt) {
        var p = readPixel(data, stride, pt[0], pt[1]);
        rSum += p.r;
        gSum += p.g;
        bSum += p.b;
      });

      var n = points.length;
      return { r: rSum / n, g: gSum / n, b: bSum / n };
    }

    function colorDistance(r, g, b, ref) {
      var dr = r - ref.r;
      var dg = g - ref.g;
      var db = b - ref.b;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    function isBackground(r, g, b, bgRef) {
      var lum = luminance(r, g, b);
      var minCh = Math.min(r, g, b);

      if (lum >= BG_LUMINANCE) return true;
      if (minCh >= BG_MIN_CHANNEL) return true;

      if (bgRef && colorDistance(r, g, b, bgRef) <= BG_COLOR_DISTANCE && lum >= 0.58) {
        return true;
      }

      return false;
    }

    function barHeight(darkness, cellH) {
      var h = cellH || CELL_H;
      var overlap = ROW_OVERLAP * (h / CELL_H);

      if (darkness < DARKNESS_THRESHOLD) return 0;
      if (darkness >= DARKNESS_FULL) return h + overlap * 2;

      var t = (darkness - DARKNESS_THRESHOLD) / (DARKNESS_FULL - DARKNESS_THRESHOLD);
      t = Math.pow(t, 0.4);
      return h * (0.15 + t * 0.85) + overlap;
    }

    function computeRefDisplaySize(vw, vh) {
      var maxW = REF_VIEWPORT_W * MAX_STAGE_W;
      var maxH = REF_VIEWPORT_H * MAX_STAGE_H;
      var w = maxW;
      var h = w * (vh / vw);

      if (h > maxH) {
        h = maxH;
        w = h * (vw / vh);
      }

      return {
        width: Math.max(1, Math.floor(w)),
        height: Math.max(1, Math.floor(h))
      };
    }

    function analyzeCell(data, stride, cellX, cellY, cellW, cellH, width, height, bgRef) {
      var bgHits = 0;
      var lumSum = 0;
      var count = 0;
      var maxLum = 0;
      var minLum = 1;

      for (var py = cellY; py < cellY + cellH && py < height; py++) {
        for (var px = cellX; px < cellX + cellW && px < width; px++) {
          var p = readPixel(data, stride, px, py);
          var lum = luminance(p.r, p.g, p.b);
          lumSum += lum;
          count++;
          if (lum > maxLum) maxLum = lum;
          if (lum < minLum) minLum = lum;
          if (isBackground(p.r, p.g, p.b, bgRef)) bgHits++;
        }
      }

      if (!count) return { skip: true, darkness: 0 };

      var avgLum = lumSum / count;
      var bgRatio = bgHits / count;
      var skip = bgRatio >= CELL_BG_RATIO || avgLum >= CELL_AVG_LUMINANCE || maxLum >= 0.9;

      return {
        skip: skip,
        darkness: 1 - (minLum * 0.8 + avgLum * 0.2)
      };
    }

    function computeDisplaySize() {
      var stage = section.querySelector(".halftone-section__stage");
      var bounds = stage ? stage.getBoundingClientRect() : section.getBoundingClientRect();
      var vw = video.videoWidth;
      var vh = video.videoHeight;

      if (!vw || !vh || !bounds.width || !bounds.height) return null;

      var maxW = bounds.width;
      var maxH = bounds.height;
      var w = maxW;
      var h = w * (vh / vw);

      if (h > maxH) {
        h = maxH;
        w = h * (vw / vh);
      }

      w = Math.max(1, Math.floor(w));
      h = Math.max(1, Math.floor(h));

      if (w > maxLiveWidth) {
        h = Math.round(h * (maxLiveWidth / w));
        w = maxLiveWidth;
      }

      return { width: w, height: h };
    }

    function resize() {
      var size = computeDisplaySize();
      if (!size) return;

      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var refSize = vw && vh ? computeRefDisplaySize(vw, vh) : size;

      cols = Math.floor(refSize.width / CELL_W);
      rows = Math.floor(refSize.height / CELL_H);
      cellDisplayW = size.width / cols;
      cellDisplayH = size.height / rows;

      canvas.style.width = size.width + "px";
      canvas.style.height = size.height + "px";
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      offscreen.width = size.width;
      offscreen.height = size.height;
    }

    function drawFrame() {
      if (video.readyState < 2 || !cols || !rows) return;

      offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      var imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      var data = imageData.data;
      var stride = offscreen.width * 4;
      var bgRef = detectBackgroundColor(data, stride, offscreen.width, offscreen.height);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, offscreen.width, offscreen.height);
      ctx.fillStyle = FG;

      var rowOverlap = ROW_OVERLAP * (cellDisplayH / CELL_H);

      for (var row = 0; row < rows; row++) {
        var cellY = Math.floor(row * cellDisplayH);
        var cellYEnd = Math.floor((row + 1) * cellDisplayH);

        for (var col = 0; col < cols; col++) {
          var cellX = Math.floor(col * cellDisplayW);
          var cellXEnd = Math.floor((col + 1) * cellDisplayW);
          var cellW = Math.max(1, cellXEnd - cellX);
          var cellH = Math.max(1, cellYEnd - cellY);
          var cell = analyzeCell(
            data,
            stride,
            cellX,
            cellY,
            cellW,
            cellH,
            offscreen.width,
            offscreen.height,
            bgRef
          );

          if (cell.skip) continue;

          var barH = barHeight(cell.darkness, cellH);
          if (barH <= 0) continue;

          var barX = cellX;
          var barY = Math.max(0, cellY - rowOverlap);

          ctx.fillRect(barX, barY, cellDisplayW, barH);
        }
      }
    }

    function tick(now) {
      if (!isActive) return;

      var time = typeof now === "number" ? now : performance.now();
      if (time - lastFrameTime >= targetFrameMs) {
        drawFrame();
        lastFrameTime = time;
      }

      rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (isActive) return;
      isActive = true;
      lastFrameTime = 0;
      rafId = requestAnimationFrame(tick);
    }

    function stop() {
      isActive = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    liveStopFn = stop;

    function ensureSourceLoaded() {
      if (sourceLoaded) return;
      var deferredSrc = video.getAttribute("data-src");
      if (deferredSrc && !video.getAttribute("src")) {
        video.setAttribute("src", deferredSrc);
        video.load();
      }
      sourceLoaded = true;
    }

    function initPlayback() {
      resize();
      drawFrame();

      if (prefersReducedMotion) {
        video.pause();
      }
    }

    video.addEventListener("loadedmetadata", function () {
      resize();
      initPlayback();
    });

    video.addEventListener("loadeddata", drawFrame);

    if (typeof IntersectionObserver !== "undefined") {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              ensureSourceLoaded();
              if (!prefersReducedMotion && !document.hidden) {
                video.play().catch(function () {});
                start();
              } else {
                initPlayback();
              }
            } else {
              stop();
              if (!prefersReducedMotion) video.pause();
            }
          });
        },
        { threshold: 0.05, rootMargin: "80px 0px" }
      );
      observer.observe(section);
    } else {
      ensureSourceLoaded();
      start();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stop();
        video.pause();
      }
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        drawFrame();
      }, 150);
    });
  }

  function activateBaked(bakedVideo) {
    if (bakedVideo.readyState >= 2) {
      initBakedMode(bakedVideo);
      return;
    }

    bakedVideo.addEventListener(
      "loadeddata",
      function () {
        initBakedMode(bakedVideo);
      },
      { once: true }
    );
  }

  function startHalftone() {
    var bakedVideo = section.querySelector(".halftone-video__baked");
    var bakedSrc =
      bakedVideo &&
      (bakedVideo.getAttribute("data-src") ||
        bakedVideo.getAttribute("src") ||
        section.getAttribute("data-baked-src"));

    if (bakedVideo && bakedSrc && shouldUseBaked()) {
      section.classList.add("halftone-section--baked");

      function ensureBakedSrc() {
        if (!bakedVideo.getAttribute("src")) {
          bakedVideo.setAttribute("src", bakedSrc);
          bakedVideo.load();
        }
        activateBaked(bakedVideo);
      }

      bakedVideo.addEventListener(
        "error",
        function () {
          bakedModeActive = false;
          section.classList.remove("halftone-section--baked");
          initLiveMode();
        },
        { once: true }
      );

      if (bakedVideo.getAttribute("src")) {
        ensureBakedSrc();
      } else if (typeof IntersectionObserver !== "undefined") {
        var loadObserver = new IntersectionObserver(
          function (entries) {
            if (entries[0].isIntersecting) {
              loadObserver.disconnect();
              ensureBakedSrc();
            }
          },
          { rootMargin: "320px 0px", threshold: 0 }
        );
        loadObserver.observe(section);
      } else {
        ensureBakedSrc();
      }

      return;
    }

    initLiveMode();
  }

  startHalftone();

  if (typeof bakedMq.addEventListener === "function") {
    bakedMq.addEventListener("change", function () {
      if (liveStopFn) liveStopFn();
      liveStopFn = null;
      liveModeActive = false;
      bakedModeActive = false;
      section.classList.remove("halftone-section--baked");
      startHalftone();
    });
  }
})();
