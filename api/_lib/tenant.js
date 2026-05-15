const cleanTenantId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const getTenantId = (req, body = null) =>
  cleanTenantId(req?.headers?.["x-tenant-id"] || req?.query?.tenant || body?.tenantId) || "default-company";

const scopeTenantKey = (tenantId, key) => {
  const k = String(key || "").trim();
  if (!k || k.startsWith("tenant:")) return k;
  return `tenant:${cleanTenantId(tenantId) || "default-company"}:${k}`;
};

module.exports = {
  cleanTenantId,
  getTenantId,
  scopeTenantKey,
};
