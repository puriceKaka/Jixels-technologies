(() => {
  "use strict";

  let deferredPrompt = null;
  let installed = false;
  const installButtons = new Set();

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true ||
    installed;

  const setButtonState = (label, muted = false) => {
    installButtons.forEach((btn) => {
      btn.textContent = label;
      btn.classList.toggle("is-muted", !!muted);
    });
  };

  const hideButtonIfInstalled = () => {
    installButtons.forEach((button) => {
      button.disabled = isStandalone();
      if (isStandalone()) button.textContent = "App Installed";
    });
  };

  const promptInstall = async () => {
    if (isStandalone()) {
      setButtonState("App Installed", true);
      window.setTimeout(hideButtonIfInstalled, 800);
      return { ok: true, installed: true };
    }

    if (!deferredPrompt) {
      setButtonState("Use Browser Menu", true);
      window.setTimeout(() => setButtonState("Install selected as PWA app", false), 2400);
      return { ok: false, reason: "prompt-unavailable" };
    }

    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    setButtonState("Installing...", true);
    promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      installed = true;
      setButtonState("App Installed", true);
      window.setTimeout(hideButtonIfInstalled, 900);
      return { ok: true, installed: true };
    }
    setButtonState("Install selected as PWA app", false);
    return { ok: false, reason: "dismissed" };
  };

  const createPoweredFooter = () => {
    if (document.getElementById("site-powered-footer")) return;
    const footer = document.createElement("footer");
    footer.id = "site-powered-footer";
    footer.className = "site-powered-footer";
    footer.textContent = "Powered by © Teams Technology";
    document.body.appendChild(footer);
  };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => null);
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setButtonState("Install selected as PWA app", false);
    hideButtonIfInstalled();
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    setButtonState("Installed", true);
    window.setTimeout(hideButtonIfInstalled, 900);
  });

  window.addEventListener("DOMContentLoaded", () => {
    createPoweredFooter();
    document.querySelectorAll("[data-pwa-install]").forEach((button) => {
      installButtons.add(button);
      button.addEventListener("click", () => promptInstall());
    });
    setButtonState(isStandalone() ? "App Installed" : "Install selected as PWA app", isStandalone());
  });

  window.MapphexPWA = Object.freeze({
    promptInstall,
    isStandalone,
  });
})();
