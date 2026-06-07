(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CONTACT_EMAIL = "noxubeenews@gmail.com";
  var CONTACT_SUBJECT = "Workshop Inquiry — Noxubee Lodge";
  var DEFAULT_MESSAGE =
    "I'd like to inquire about the Noxubee Lodge photography workshop led by Betty Press (August 28–30, 2026).";

  var modal = document.getElementById("contact-modal");
  if (!modal) return;

  var dialog = modal.querySelector(".contact-modal__dialog");
  var form = document.getElementById("contact-form");
  var nameInput = document.getElementById("contact-name");
  var emailInput = document.getElementById("contact-email");
  var messageInput = document.getElementById("contact-message");
  var closeTriggers = modal.querySelectorAll("[data-contact-close]");
  var lastFocused = null;

  var openTriggers = document.querySelectorAll(
    '[data-contact-open], a[href^="mailto:' + CONTACT_EMAIL + '"]'
  );

  if (!openTriggers.length) return;

  function getFocusableElements() {
    if (!dialog) return [];

    return Array.prototype.slice.call(
      dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function buildMailtoUrl() {
    var message = messageInput ? messageInput.value.trim() : DEFAULT_MESSAGE;
    var name = nameInput ? nameInput.value.trim() : "";
    var email = emailInput ? emailInput.value.trim() : "";
    var bodyParts = [message];

    if (name) bodyParts.push("", "Name: " + name);
    if (email) bodyParts.push("Email: " + email);

    var params = [
      "subject=" + encodeURIComponent(CONTACT_SUBJECT),
      "body=" + encodeURIComponent(bodyParts.join("\n"))
    ];

    return "mailto:" + CONTACT_EMAIL + "?" + params.join("&");
  }

  function openModal(trigger) {
    lastFocused = trigger || document.activeElement;

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("lenis-stopped");
    document.body.classList.add("contact-modal-open");

    requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });

    var focusables = getFocusableElements();
    var firstFocus = messageInput || (focusables.length ? focusables[0] : dialog);
    if (firstFocus && firstFocus.focus) firstFocus.focus();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("lenis-stopped");
    document.body.classList.remove("contact-modal-open");

    if (prefersReducedMotion) {
      modal.hidden = true;
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      return;
    }

    window.setTimeout(function () {
      if (!modal.classList.contains("is-open")) {
        modal.hidden = true;
        if (lastFocused && lastFocused.focus) lastFocused.focus();
      }
    }, 400);
  }

  openTriggers.forEach(function (trigger) {
    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      openModal(trigger);
    });
  });

  closeTriggers.forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      closeModal();
    });
  });

  document.addEventListener("keydown", function (event) {
    if (modal.hidden || !modal.classList.contains("is-open")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== "Tab") return;

    var focusables = getFocusableElements();
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      window.location.href = buildMailtoUrl();
    });
  }

  if (messageInput && !messageInput.value.trim()) {
    messageInput.value = DEFAULT_MESSAGE;
  }
})();
