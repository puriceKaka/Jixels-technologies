(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  let state = { organizations: [], events: [], totals: {}, activity: [], health: {} };
  let monitoring = { organizations: [], totals: {}, activity: [], health: {} };
  const internalKey = new URLSearchParams(location.search).get("key") || sessionStorage.getItem("mapphex_internal_key") || "";
  if (internalKey) sessionStorage.setItem("mapphex_internal_key", internalKey);

  const fetchJson = async (url, opts = {}) => {
    const headers = new Headers(opts.headers || {});
    if (internalKey) headers.set("X-Super-Admin-Key", internalKey);
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Request failed");
    return data;
  };

  const num = (value) => Number(value || 0).toLocaleString();
  const orgRows = () => monitoring.organizations.map((row) => row.organization || row);

  const renderKpis = async () => {
    const totals = monitoring.totals || state.totals || {};
    $("#kpi-orgs").textContent = num(totals.organizations);
    $("#kpi-active").textContent = num(totals.active);
    $("#kpi-users").textContent = num(totals.users);
    $("#kpi-revenue").textContent = num(totals.revenue);
    $("#kpi-alerts").textContent = num(totals.securityAlerts || totals.suspended);
    $("#mon-active-users").textContent = num(totals.activeUsers);
    $("#mon-branches").textContent = num(totals.branches);
    $("#mon-queue").textContent = num(totals.queuedTasks);
    $("#mon-files").textContent = num(totals.files);
    $("#mon-audit").textContent = num(totals.auditEvents);
    $("#mon-modules").textContent = num(totals.modules);
    $("#mon-suspended").textContent = num(totals.suspended);
    try {
      const health = await fetchJson("/api/health");
      $("#kpi-sessions").textContent = num(health.realtimeClients);
      $("#kpi-health").textContent = monitoring.health?.api === "online" ? "Online" : "Online";
    } catch {
      $("#kpi-health").textContent = "Degraded";
    }
  };

  const tenantMetric = (orgId) => monitoring.organizations.find((row) => row.organization?.id === orgId)?.metrics || {};

  const renderOrgs = () => {
    const q = String($("#super-search")?.value || "").toLowerCase().trim();
    const rows = q ? orgRows().filter((org) => JSON.stringify(org).toLowerCase().includes(q)) : orgRows();
    $("#org-table").innerHTML = rows
      .map((org) => {
        const metrics = tenantMetric(org.id);
        return `
          <tr>
            <td><strong>${escapeHtml(org.name)}</strong><div class="muted">${escapeHtml(org.referenceCode || org.id)}</div></td>
            <td>${escapeHtml(org.organizationId)}</td>
            <td>${escapeHtml(org.businessType)}</td>
            <td>${escapeHtml(org.admin?.email || "")}</td>
            <td><span class="pill status-${escapeHtml(org.status)}">${escapeHtml(org.status)}</span></td>
            <td>${num(metrics.users || org.metrics?.users)}</td>
            <td>${escapeHtml(org.subscriptionStatus || "trial")}</td>
            <td class="report-buttons">
              <button class="btn" data-action="active" data-id="${escapeHtml(org.id)}" type="button">Activate</button>
              <button class="btn" data-action="verified" data-id="${escapeHtml(org.id)}" type="button">Verify</button>
              <button class="btn" data-action="restricted" data-id="${escapeHtml(org.id)}" type="button">Restrict</button>
              <button class="btn danger" data-action="suspended" data-id="${escapeHtml(org.id)}" type="button">Suspend</button>
              <button class="btn" data-action="backup" data-id="${escapeHtml(org.id)}" type="button">Backup</button>
              <button class="btn internal-action" data-support="${escapeHtml(org.id)}" type="button">Support switch</button>
              <a class="btn" href="organization-admin.html?tenant=${encodeURIComponent(org.id)}&support=1">Dashboard</a>
            </td>
          </tr>`;
      })
      .join("");
  };

  const renderUsers = () => {
    const users = monitoring.organizations.flatMap((row) =>
      (row.users || []).map((user) => ({ ...user, organization: row.organization?.name, tenantId: row.organization?.id })),
    );
    $("#global-users-table").innerHTML = users
      .map(
        (user) => `
          <tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.role)}</td>
            <td>${escapeHtml(user.organization)}</td>
            <td>${escapeHtml(user.status || "active")}</td>
          </tr>`,
      )
      .join("");
  };

  const renderActivity = () => {
    const activity = monitoring.activity?.length ? monitoring.activity : state.events || [];
    $("#activity-table").innerHTML = activity
      .slice(0, 100)
      .map(
        (event) => `
          <tr>
            <td>${escapeHtml(new Date(event.at || event.createdAt || Date.now()).toLocaleString())}</td>
            <td>${escapeHtml(event.type || event.action || "event")}</td>
            <td>${escapeHtml(event.organizationName || event.payload?.tenantId || event.payload?.organizationId || event.tenantId)}</td>
            <td>${escapeHtml(JSON.stringify(event.payload || event.detail || {}))}</td>
          </tr>`,
      )
      .join("");
  };

  const renderSearch = () => {
    const target = $("#global-search-results");
    if (!target) return;
    const rows = monitoring.globalSearch || [];
    target.innerHTML = rows.length
      ? rows
          .map(
            (item) => `
              <div class="search-result">
                <span>${escapeHtml(item.type)}</span>
                <strong>${escapeHtml(item.label)}</strong>
                <span class="muted">${escapeHtml(item.detail)}</span>
              </div>`,
          )
          .join("")
      : "";
  };

  const renderHeatmap = () => {
    const target = $("#heatmap");
    if (!target) return;
    const max = Math.max(1, ...(monitoring.heatmap || []).map((row) => Number(row.activity || 0)));
    target.innerHTML = (monitoring.heatmap || [])
      .slice(0, 12)
      .map(
        (row) => `
          <div class="heatmap-row">
            <span>${escapeHtml(row.name)}</span>
            <div class="heatbar"><span style="width:${Math.max(8, Math.round((Number(row.activity || 0) / max) * 100))}%"></span></div>
            <span>${Number(row.activity || 0)} events</span>
          </div>`,
      )
      .join("");
  };

  const load = async () => {
    const q = encodeURIComponent(String($("#global-search-input")?.value || "").trim());
    const [orgs, monitor] = await Promise.all([fetchJson("/api/organizations"), fetchJson(`/api/platform-monitoring${q ? `?q=${q}` : ""}`)]);
    state = orgs;
    monitoring = monitor;
    renderOrgs();
    renderUsers();
    renderActivity();
    renderSearch();
    renderHeatmap();
    await renderKpis();
  };

  const setStatus = async (id, status) => {
    await fetchJson("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-status", id, status }),
    });
    await load();
  };

  const supportSwitch = (tenantId) => {
    const org = orgRows().find((row) => row.id === tenantId);
    window.EnterpriseCore?.setTenant?.(tenantId);
    window.EnterpriseCore?.setSession?.(
      {
        role: "super_admin",
        name: "Super Admin",
        tenantId,
        supportMode: true,
        permissions: ["*"],
      },
      true,
    );
    window.EnterpriseCore?.audit?.("super.support.switch", { tenantId, organization: org?.name });
    location.href = `organization-admin.html?tenant=${encodeURIComponent(tenantId)}&support=1`;
  };

  const broadcast = async (form) => {
    const data = new FormData(form);
    await fetchJson("/api/platform-monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "broadcast", title: data.get("title"), message: data.get("body") }),
    });
    window.EnterpriseCore?.notify?.(data.get("title"), data.get("body"));
    form.reset();
    await load();
  };

  const backupOrganization = async (tenantId) => {
    await fetchJson("/api/platform-monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "backup-organization", tenantId }),
    });
    await load();
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.EnterpriseCore?.setSession?.({ role: "super_admin", name: "Super Admin", tenantId: "platform", permissions: ["*"] }, true);
    $("#super-refresh")?.addEventListener("click", () => load().catch((err) => window.EnterpriseCore?.notify?.("Super Admin", err.message, "error")));
    $("#super-search")?.addEventListener("input", renderOrgs);
    $("#global-search-input")?.addEventListener("input", () => load().catch(() => null));
    $("#org-table")?.addEventListener("click", (event) => {
      const support = event.target.closest("button[data-support]");
      if (support) return supportSwitch(support.dataset.support);
      const btn = event.target.closest("button[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "backup") return backupOrganization(btn.dataset.id).catch((err) => window.EnterpriseCore?.notify?.("Backup failed", err.message, "error"));
      setStatus(btn.dataset.id, btn.dataset.action).catch((err) => window.EnterpriseCore?.notify?.("Organization update failed", err.message, "error"));
    });
    $("#broadcast-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      broadcast(event.currentTarget).catch((err) => window.EnterpriseCore?.notify?.("Broadcast failed", err.message, "error"));
    });
    window.addEventListener("enterprise:realtime", () => load().catch(() => null));
    load().catch((err) => window.EnterpriseCore?.notify?.("Super Admin load failed", err.message, "error"));
  });
})();
