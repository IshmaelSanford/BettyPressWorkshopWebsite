(function () {
  "use strict";

  var REGISTER_FORM_URL = "https://forms.gle/AAbNNmPmxQ4Amyt6A";
  var POPOUT_NAME = "betty-workshop-register";
  var POPOUT_FEATURES = "noopener,noreferrer,width=640,height=800";

  var openTriggers = document.querySelectorAll("[data-register-open]");
  if (!openTriggers.length) return;

  function closeMobileNav() {
    var siteNav = document.getElementById("site-nav");
    var navToggle = document.getElementById("nav-toggle");

    if (siteNav && siteNav.classList.contains("is-open")) {
      siteNav.classList.remove("is-open");
      if (navToggle) {
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
      }
    }
  }

  function openRegisterForm() {
    closeMobileNav();

    var popup = window.open(REGISTER_FORM_URL, POPOUT_NAME, POPOUT_FEATURES);

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      window.open(REGISTER_FORM_URL, "_blank", "noopener,noreferrer");
    }
  }

  openTriggers.forEach(function (trigger) {
    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      openRegisterForm();
    });
  });
})();
