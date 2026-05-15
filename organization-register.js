(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  document.addEventListener("DOMContentLoaded", () => {
    $("#org-register-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = $("#org-register-result");
      result.textContent = "Creating organization...";
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      body.action = "register";
      try {
        const res = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Registration failed");
        window.EnterpriseCore?.setTenant?.(data.tenantId);
        const sessionRes = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "organization-login",
            role: "org_admin",
            tenantId: data.tenantId,
            email: body.adminEmail,
            password: body.adminPassword,
          }),
        });
        const sessionData = await sessionRes.json().catch(() => null);
        if (sessionRes.ok && sessionData?.ok) {
          window.EnterpriseCore?.setSession?.(
            {
              role: "org_admin",
              email: body.adminEmail,
              tenantId: data.tenantId,
              token: sessionData.token,
              organizationId: data.organizationId,
              expiresAt: new Date(sessionData.session.exp).toISOString(),
            },
            true,
          );
        } else {
          window.EnterpriseCore?.setSession?.({ role: "org_admin", email: body.adminEmail, tenantId: data.tenantId }, true);
        }
        result.style.color = "var(--ok)";
        result.textContent = `Created ${data.organization.name}. ID: ${data.organizationId}`;
        setTimeout(() => {
          location.href = `organization-agreement.html?tenant=${encodeURIComponent(data.tenantId)}`;
        }, 900);
      } catch (err) {
        result.style.color = "var(--danger)";
        result.textContent = err.message;
      }
    });
  });
})();
