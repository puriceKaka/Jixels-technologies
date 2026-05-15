(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const moduleId = String(params.get("portal") || params.get("module") || "").trim().toLowerCase();
    const tenant = params.get("tenant") || window.EnterpriseCore?.currentTenantId?.();
    if (tenant) window.EnterpriseCore?.setTenant?.(tenant);

    const session = window.EnterpriseCore?.getSession?.();
    if (!session?.tenantId) {
      location.href = "organization-login.html";
      return;
    }
    window.EnterpriseCore?.setTenant?.(session.tenantId);

    try {
      const [admin, mine] = await Promise.all([
        fetch("/api/org-admin").then((r) => r.json()),
        fetch("/api/organizations?scope=mine").then((r) => r.json()).catch(() => null),
      ]);
      if (!admin.ok) throw new Error(admin.error || "Unable to load module");
      const settings = admin.settings || {};
      if (settings.agreementAccepted !== true) {
        location.href = `organization-agreement.html?tenant=${encodeURIComponent(session.tenantId)}`;
        return;
      }
      const installed = new Set(settings.installedPortals || []);
      if (!moduleId || !installed.has(moduleId)) {
        location.href = `portal-selection.html?tenant=${encodeURIComponent(session.tenantId)}`;
        return;
      }

      const moduleDef = (admin.portalCatalog || []).find((item) => item.id === moduleId);
      if (!moduleDef) throw new Error("Module not found");
      const org = mine?.organization || {};
      const permissions = settings.modulePermissions?.[moduleId] || [];
      const moduleCode = (moduleDef.title || "M").slice(0, 2).toUpperCase();

      document.title = `${moduleDef.title} • MAPPHEX`;
      $("#module-title").textContent = moduleDef.title;
      $("#module-subtitle").textContent = `${org.organizationId || session.tenantId} • shared organization module`;
      $("#module-heading").textContent = moduleDef.title;
      $("#module-description").textContent = `${moduleDef.description} This module is enabled inside the same ${org.name || "organization"} workspace and uses the shared database context.`;
      $("#module-icon").textContent = moduleCode;
      $("#module-org-name").textContent = org.name || "Organization";
      $("#module-org-id").textContent = org.organizationId || session.tenantId;
      $("#module-kpi-users").textContent = Array.isArray(admin.users) ? admin.users.length : 0;
      $("#module-kpi-branches").textContent = settings.branches?.length || org.metrics?.branches || 0;
      $("#module-kpi-modules").textContent = installed.size;
      $("#module-kpi-tenant").textContent = session.tenantId;
      $("#hub-link").href = `organization-workspace.html?tenant=${encodeURIComponent(session.tenantId)}`;
      $("#settings-link").href = `organization-admin.html?tenant=${encodeURIComponent(session.tenantId)}`;
      $("#module-permissions").textContent = permissions.length
        ? permissions.map(escapeHtml).join(", ")
        : "Uses inherited organization permissions.";

      if (moduleDef.externalUrl) {
        $("#assetwise-connected-panel").hidden = false;
        const url = new URL(moduleDef.externalUrl);
        url.searchParams.set("tenant", session.tenantId);
        if (org.organizationId) url.searchParams.set("org", org.organizationId);
        $("#assetwise-link").href = url.href;
      }
    } catch (err) {
      window.EnterpriseCore?.notify?.("Module", err.message, "error");
    }
  });
})();
