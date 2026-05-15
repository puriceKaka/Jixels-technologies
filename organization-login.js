(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  const nextUrlFor = async (tenantId) => {
    window.EnterpriseCore?.setTenant?.(tenantId);
    const res = await fetch("/api/org-admin", { method: "GET" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Unable to load organization workspace");
    const settings = data.settings || {};
    const tenant = encodeURIComponent(tenantId);
    if (settings.agreementAccepted !== true) return `organization-agreement.html?tenant=${tenant}`;
    if (Array.isArray(settings.installedPortals) && settings.installedPortals.length) return `organization-workspace.html?tenant=${tenant}`;
    return `portal-selection.html?tenant=${tenant}`;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const existing = window.EnterpriseCore?.getSession?.();
    if (existing?.tenantId) {
      nextUrlFor(existing.tenantId).then((url) => location.replace(url)).catch(() => null);
    }

    $("#organization-login-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = $("#organization-login-result");
      result.style.color = "var(--muted)";
      result.textContent = "Verifying credentials...";
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "organization-login",
            role: "org_admin",
            identifier: body.identifier,
            email: body.identifier,
            password: body.password,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Login failed");
        window.EnterpriseCore?.setTenant?.(data.session.tenantId);
        window.EnterpriseCore?.setSession?.(
          {
            role: "org_admin",
            email: data.session.sub,
            tenantId: data.session.tenantId,
            token: data.token,
            organizationId: data.organization?.organizationId,
            expiresAt: new Date(data.session.exp).toISOString(),
          },
          body.remember === "on",
        );
        result.style.color = "var(--ok)";
        result.textContent = "Login successful. Opening workspace...";
        location.replace(await nextUrlFor(data.session.tenantId));
      } catch (err) {
        result.style.color = "var(--danger)";
        result.textContent = `${err.message}. If your organization is not registered, use the Register Organization button below.`;
      }
    });
  });
})();
