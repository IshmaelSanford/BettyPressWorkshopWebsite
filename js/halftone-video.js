(function () {
  "use strict";

  var section = document.getElementById("halftone");
  if (!section) return;

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Grid geometry — keep in sync with scripts/bake-halftone.py */
  var CELL_W = 6;
  var CELL_H = 7;
  var BAR_W = 6;
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

  /* Baked video is fixed ~1152px wide — use live canvas on phones for matching density. */
  var bakedMq = window.matchMedia("(min-width: 901px)");

  function shouldUseBaked() {
    return bakedMq.matches;
  }

  function initBakedMode(bakedVideo) {
    section.classList.add("halftone-section--baked");

    function setPlaying(playing) {
      if (prefersReducedMotion) {
        bakedVideo.pause();
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
        { threshold: 0.15 }
      );
      observer.observe(section);
    } else {
      setPlaying(true);
    }
  }

  function initLiveMode() {
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
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rafId = null;
    var isActive = false;
    var sourceLoaded = false;

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

      return {
        width: Math.max(1, Math.floor(w)),
        height: Math.max(1, Math.floor(h))
      };
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

    function tick() {
      drawFrame();
      if (isActive) rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (isActive) return;
      isActive = true;
      tick();
    }

    function stop() {
      isActive = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function ensureSourceLoaded() {
      if (sourceLoaded) return;
      var deferredSrc = video.getAttribute("data-src");
      if (deferredSrc && !video.getAttribute("src")) {
        video.setAttribute("src", deferredSrc);
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
              if (!prefersReducedMotion) {
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
        { threshold: 0.15, rootMargin: "120px 0px" }
      );
      observer.observe(section);
    } else {
      ensureSourceLoaded();
      start();
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        drawFrame();
      }, 150);
    });
  }

  var bakedVideo = section.querySelector(".halftone-video__baked");
  var bakedSrc = bakedVideo && (bakedVideo.getAttribute("src") || section.getAttribute("data-baked-src"));

  function startHalftone() {
    if (bakedVideo && bakedSrc && shouldUseBaked()) {
      if (!bakedVideo.getAttribute("src")) {
        bakedVideo.setAttribute("src", bakedSrc);
      }

      bakedVideo.addEventListener(
        "loadeddata",
        function () {
          initBakedMode(bakedVideo);
        },
        { once: true }
      );

      bakedVideo.addEventListener(
        "error",
        function () {
          section.classList.remove("halftone-section--baked");
          initLiveMode();
        },
        { once: true }
      );
    } else {
      initLiveMode();
    }
  }

  startHalftone();

  if (typeof bakedMq.addEventListener === "function") {
    bakedMq.addEventListener("change", function () {
      section.classList.remove("halftone-section--baked");
      startHalftone();
    });
  }
})();
