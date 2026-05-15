(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  let catalog = [];
  let settings = {};
  let org = null;

  const portalUrl = (portal) => {
    const tenant = window.EnterpriseCore?.currentTenantId?.() || "";
    const href = String(portal?.href || "organization-workspace.html");
    try {
      const url = new URL(href, location.origin);
      url.searchParams.set("tenant", tenant);
      url.searchParams.set("portal", portal.id);
      if (org?.organizationId) url.searchParams.set("org", org.organizationId);
      return url.href;
    } catch {
      return `${href}${href.includes("?") ? "&" : "?"}tenant=${encodeURIComponent(tenant)}&portal=${encodeURIComponent(portal.id)}`;
    }
  };

  const load = async () => {
    const tenant = new URLSearchParams(location.search).get("tenant") || window.EnterpriseCore?.currentTenantId?.();
    if (tenant) window.EnterpriseCore?.setTenant?.(tenant);
    const session = window.EnterpriseCore?.getSession?.();
    if (!session?.tenantId) {
      location.href = "organization-login.html";
      return;
    }
    window.EnterpriseCore?.setTenant?.(session.tenantId);
    const [admin, mine] = await Promise.all([
      fetch("/api/org-admin").then((r) => r.json()),
      fetch("/api/organizations?scope=mine").then((r) => r.json()).catch(() => null),
    ]);
    if (!admin.ok) throw new Error(admin.error || "Unable to load portals");
    catalog = admin.portalCatalog || [];
    settings = admin.settings || {};
    org = mine?.organization || null;
    if (settings.agreementAccepted !== true) {
      location.href = `organization-agreement.html?tenant=${encodeURIComponent(window.EnterpriseCore?.currentTenantId?.() || "")}`;
      return;
    }
    $("#portal-org-name").textContent = `MAPPHEX Workspace — ${org?.name || "Organization"}`;
    $("#portal-workspace-link").href = `organization-workspace.html?tenant=${encodeURIComponent(window.EnterpriseCore?.currentTenantId?.() || tenant || "")}`;
    render();
  };

  const render = () => {
    const installed = new Set(settings.installedPortals || []);
    $("#portal-grid").innerHTML = catalog
      .map(
        (portal) => `
          <article class="portal-install-card">
            <h3>${escapeHtml(portal.title)}</h3>
            <p>${escapeHtml(portal.description)}</p>
            <ul class="portal-feature-list">
              ${(portal.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
            </ul>
            <span class="portal-status">${installed.has(portal.id) ? "Installed" : "Not Installed"}</span>
            <div class="portal-card-actions">
              ${
                installed.has(portal.id)
                  ? `<a class="btn primary" href="${escapeHtml(portalUrl(portal))}" ${portal.external ? 'target="_blank" rel="noopener noreferrer"' : ""}>Open Portal</a>`
                  : `<button class="btn primary" data-portal="${escapeHtml(portal.id)}" type="button">Install</button>`
              }
            </div>
          </article>`,
      )
      .join("");
  };

  const install = async (portalId) => {
    const progress = $("#portal-progress");
    if (progress) progress.textContent = "Installing portal and configuring workspace...";
    const res = await fetch("/api/org-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "install-portal", portalId }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Install failed");
    settings = data.settings;
    render();
    window.EnterpriseCore?.notify?.("Portal installed", data.portal?.title || portalId);
    if (progress) progress.textContent = "Installation complete. You can open it now or install another portal.";
  };

  document.addEventListener("DOMContentLoaded", () => {
    $("#portal-grid")?.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-portal]");
      if (!btn || btn.textContent.trim() === "Installed") return;
      btn.disabled = true;
      btn.textContent = "Installing...";
      install(btn.dataset.portal).catch((err) => {
        btn.disabled = false;
        btn.textContent = "Install";
        const progress = $("#portal-progress");
        if (progress) progress.textContent = "Installation failed. Try again.";
        window.EnterpriseCore?.notify?.("Install failed", err.message, "error");
      });
    });
    load().catch((err) => window.EnterpriseCore?.notify?.("Portal manager", err.message, "error"));
  });
})();
