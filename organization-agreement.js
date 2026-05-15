(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  const setResult = (message, color = "var(--muted)") => {
    const result = $("#agreement-result");
    if (!result) return;
    result.style.color = color;
    result.textContent = message;
  };

  const resolveTenant = () => {
    const queryTenant = new URLSearchParams(location.search).get("tenant");
    const session = window.EnterpriseCore?.getSession?.();
    const tenant = session?.tenantId || queryTenant || window.EnterpriseCore?.currentTenantId?.();
    if (tenant) window.EnterpriseCore?.setTenant?.(tenant);
    return { tenant, session };
  };

  document.addEventListener("DOMContentLoaded", () => {
    const { tenant, session } = resolveTenant();
    if (!session?.tenantId) {
      location.href = tenant ? `organization-login.html?tenant=${encodeURIComponent(tenant)}` : "organization-login.html";
      return;
    }

    const form = $("#agreement-form");
    const accepted = $("#agreement-accepted");
    const submit = $("#agreement-submit");

    const syncSubmit = () => {
      const ready = accepted?.checked === true;
      if (!submit) return;
      submit.disabled = false;
      submit.classList.toggle("is-disabled", !ready);
      submit.setAttribute("aria-disabled", String(!ready));
    };

    accepted?.addEventListener("change", syncSubmit);
    accepted?.addEventListener("input", syncSubmit);
    form?.addEventListener("click", syncSubmit);
    syncSubmit();

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      syncSubmit();
      if (!accepted?.checked) {
        setResult("Please tick the agreement checkbox before continuing.", "var(--danger)");
        accepted?.focus();
        return;
      }

      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      submit.disabled = true;
      setResult("Saving agreement...");
      try {
        const res = await fetch("/api/org-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "accept-agreement",
            accepted: true,
            subscriptionPlan: data.subscriptionPlan,
            supportPackage: data.supportPackage,
          }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) throw new Error(body?.error || "Agreement failed");
        setResult("Agreement accepted. Opening portal manager...", "var(--ok)");
        setTimeout(() => {
          location.href = `portal-selection.html?tenant=${encodeURIComponent(window.EnterpriseCore?.currentTenantId?.() || tenant)}`;
        }, 450);
      } catch (err) {
        submit.disabled = false;
        syncSubmit();
        setResult(err.message, "var(--danger)");
      }
    });
  });
})();
