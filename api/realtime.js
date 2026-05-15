const { sendJson, readJsonBody } = require("./_lib/http");
const { getStore } = require("./_lib/kv-store");
const { getTenantId } = require("./_lib/tenant");
const { appendEvent, listEvents } = require("./_lib/events");
const { assertObject, rateLimit, safeString } = require("./_lib/security");

module.exports = async (req, res) => {
  try {
    rateLimit(req, { scope: "realtime", limit: 300, windowMs: 60_000 });
    const store = getStore();

    if (req.method === "GET") {
      const tenantId = getTenantId(req);
      const after = Number(req.query?.after || 0) || 0;
      const events = await listEvents(store, tenantId, after);
      return sendJson(res, 200, { ok: true, tenantId, events });
    }

    if (req.method === "POST") {
      const body = assertObject(await readJsonBody(req));
      const tenantId = getTenantId(req, body);
      const event = await appendEvent(store, tenantId, safeString(body.type || "notification", 80), body.payload || {});
      return sendJson(res, 200, { ok: true, event });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (err) {
    return sendJson(res, Number(err?.statusCode || 500), { ok: false, error: err?.message || "Server error" });
  }
};
