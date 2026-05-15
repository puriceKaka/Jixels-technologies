(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  let tenantId = "";
  let state = { users: [], settings: {}, organization: null, events: [] };

  const csv = (value) => String(value || "").split(",").map((x) => x.trim()).filter(Boolean);

  const fetchJson = async (url, opts = {}) => {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Request failed");
    return data;
  };

  const setTenant = (id) => {
    tenantId = window.EnterpriseCore?.setTenant?.(id) || id || "default-company";
    $("#tenant-input").value = tenantId;
  };

  const render = () => {
    const session = window.EnterpriseCore?.getSession?.() || {};
    const support = session.role === "super_admin" || new URLSearchParams(location.search).get("support") === "1";
    const badge = $("#internal-mode-badge");
    if (badge) badge.hidden = !support;
    $("#org-admin-title").textContent = state.organization?.name || "Organization Admin";
    $("#org-admin-sub").textContent = state.organization?.organizationId || tenantId;
    $("#org-kpi-users").textContent = state.users.length;
    $("#org-kpi-branches").textContent = (state.settings.branches || []).length;
    $("#org-kpi-modules").textContent = (state.settings.modules || []).length;
    $("#org-kpi-status").textContent = state.organization?.status || "Active";
    $("#org-branches").value = (state.settings.branches || []).join(", ");
    $("#org-departments").value = (state.settings.departments || []).join(", ");
    $("#org-modules").value = (state.settings.modules || []).join(", ");
    $("#org-users-table").innerHTML = state.users
      .map((user) => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.role)}</td><td>${escapeHtml(user.status)}</td></tr>`)
      .join("");
    $("#org-activity-table").innerHTML = state.events
      .slice(-40)
      .reverse()
      .map((event) => `<tr><td>${escapeHtml(new Date(event.at).toLocaleString())}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(JSON.stringify(event.payload || {}))}</td></tr>`)
      .join("");
  };

  const load = async () => {
    const [org, admin, realtime] = await Promise.all([
      fetchJson("/api/organizations?scope=mine"),
      fetchJson("/api/org-admin"),
      fetchJson("/api/realtime?after=0"),
    ]);
    if (admin.settings?.agreementAccepted !== true) {
      location.href = `organization-agreement.html?tenant=${encodeURIComponent(tenantId)}`;
      return;
    }
    state = { organization: org.organization, users: admin.users || [], settings: admin.settings || {}, events: realtime.events || [] };
    render();
  };

  document.addEventListener("DOMContentLoaded", () => {
    const fromQuery = new URLSearchParams(location.search).get("tenant");
    setTenant(fromQuery || window.EnterpriseCore?.currentTenantId?.() || "default-company");
    const session = window.EnterpriseCore?.getSession?.();
    if (!session?.tenantId) {
      location.href = "organization-login.html";
      return;
    }
    setTenant(session.tenantId);
    $("#workspace-link").href = `organization-workspace.html?tenant=${encodeURIComponent(tenantId)}`;
    $("#load-org")?.addEventListener("click", () => {
      setTenant($("#tenant-input").value);
      load().catch((err) => window.EnterpriseCore?.notify?.("Organization load failed", err.message, "error"));
    });
    $("#org-user-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      body.action = "add-user";
      await fetchJson("/api/org-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      event.currentTarget.reset();
      await load();
    });
    $("#save-org-settings")?.addEventListener("click", async () => {
      await fetchJson("/api/org-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-settings",
          branches: csv($("#org-branches").value),
          departments: csv($("#org-departments").value),
          modules: csv($("#org-modules").value),
        }),
      });
      await load();
    });
    window.addEventListener("enterprise:realtime", () => load().catch(() => null));
    load().catch((err) => window.EnterpriseCore?.notify?.("Organization Admin", err.message, "error"));
  });
})();
