(() => {
  "use strict";

  const PAGE = document.body?.dataset?.page || "";
  const TEAMLEADER_ACCOUNTS_KEY = "jixels_teamleader_accounts_v1";
  const BRANCH_ACCOUNTS_KEY = "jixels_branch_accounts_v1";
  const AGENT_ACCOUNTS_KEY = "jixels_agent_accounts_v1";
  const DEPT_ACCOUNTS_KEY = "jixels_departments_accounts_v1";
  const DIRECTOR_ACCOUNT_KEY = "jixels_director_account_v1";
  const ERP_KEY = "jixels_erp_v1";
  const BRANCH_COUNT = 47;

  const $ = (selector, root = document) => root.querySelector(selector);

  const safeJsonParse = (raw, fallback) => {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const loadJson = (key, fallback) => {
    const store = window.JixelsStore || null;
    if (store?.getJson) {
      const value = store.getJson(key, undefined);
      if (typeof value !== "undefined" && value !== null) return value;
    }
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return safeJsonParse(raw, fallback);
  };

  const saveJson = (key, value) => {
    const store = window.JixelsStore || null;
    if (store?.setJson) {
      store.setJson(key, value);
      localStorage.setItem(key, JSON.stringify(value));
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  };

  const bufToHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const weakHashHex = (text) => {
    let h1 = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h1 ^= text.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }
    const hex = (h1 >>> 0).toString(16).padStart(8, "0");
    return `${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}`.slice(0, 64);
  };

  const hashHex = async (text) => {
    try {
      if (crypto?.subtle?.digest) {
        const enc = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest("SHA-256", enc);
        return bufToHex(digest);
      }
    } catch {
      // Fall through.
    }
    return weakHashHex(text);
  };

  const isoNow = () => new Date().toISOString();
  const makeId = (prefix, index) => `${prefix}${String(index).padStart(2, "0")}`;
  const normalized = (value) => String(value || "").trim().toLowerCase();
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

  const ensureERP = () => {
    const existing = loadJson(ERP_KEY, null);
    if (existing && typeof existing === "object" && Array.isArray(existing.branches) && existing.branches.length === BRANCH_COUNT) {
      return existing;
    }
    const branches = Array.from({ length: BRANCH_COUNT }, (_, idx) => {
      const i = idx + 1;
      return {
        id: makeId("b", i),
        name: `Branch ${String(i).padStart(2, "0")}`,
        city: "",
        area: "",
        employees: 0,
        inventory: [],
        phones: [],
        soldPhones: [],
        transactions: [],
        txLog: [],
        damageLoss: [],
        financeSummary: { mpesaIn: 0, bankIn: 0, txCount: 0, lastTxAt: "" },
        ledger: { head: "GENESIS" },
        updatedAt: isoNow(),
      };
    });
    const seeded = { version: 1, lastUpdated: isoNow(), branches, departments: {} };
    saveJson(ERP_KEY, seeded);
    return seeded;
  };

  const accountIdentityTaken = (email, username) => {
    const e = normalized(email);
    const u = normalized(username);
    const buckets = [
      loadJson(TEAMLEADER_ACCOUNTS_KEY, []),
      loadJson(BRANCH_ACCOUNTS_KEY, []),
      loadJson(AGENT_ACCOUNTS_KEY, []),
      loadJson(DEPT_ACCOUNTS_KEY, []),
    ];
    const director = loadJson(DIRECTOR_ACCOUNT_KEY, null);
    if (director) buckets.push([director]);
    return buckets.some((list) =>
      (Array.isArray(list) ? list : []).some(
        (acc) => normalized(acc.email) === e || normalized(acc.username) === u,
      ),
    );
  };

  const init = async () => {
    if (PAGE !== "teamleader-register") return;

    await window.JixelsStore?.bootstrap?.([
      TEAMLEADER_ACCOUNTS_KEY,
      BRANCH_ACCOUNTS_KEY,
      AGENT_ACCOUNTS_KEY,
      DEPT_ACCOUNTS_KEY,
      DIRECTOR_ACCOUNT_KEY,
      ERP_KEY,
    ]);

    const erp = ensureERP();
    const form = $("#teamleader-register-form");
    const branchSelect = $("#branchId");
    const username = $("#username");
    const email = $("#email");
    const password = $("#password");
    const confirmPassword = $("#confirmPassword");
    const error = $("#teamleader-register-error");
    if (!form || !branchSelect || !username || !email || !password || !confirmPassword || !error) return;

    branchSelect.textContent = "";
    for (const b of (erp.branches || []).slice().sort((a, z) => String(a.name || "").localeCompare(String(z.name || "")))) {
      const opt = document.createElement("option");
      opt.value = String(b.id || "");
      opt.textContent = String(b.name || b.id || "");
      branchSelect.appendChild(opt);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.textContent = "";

      const branchId = String(branchSelect.value || "").trim();
      const u = String(username.value || "").trim();
      const m = String(email.value || "").trim().toLowerCase();
      const p1 = String(password.value || "");
      const p2 = String(confirmPassword.value || "");

      if (!branchId) return (error.textContent = "Branch is required.");
      if (u.length < 2) return (error.textContent = "Username is required.");
      if (!validEmail(m)) return (error.textContent = "Enter a valid email address.");
      if (p1.length < 8) return (error.textContent = "Password must be at least 8 characters.");
      if (p1 !== p2) return (error.textContent = "Passwords do not match.");
      if (accountIdentityTaken(m, u)) return (error.textContent = "Email or username already exists in another portal.");

      const accounts = loadJson(TEAMLEADER_ACCOUNTS_KEY, []);
      const rows = Array.isArray(accounts) ? accounts : [];
      const salt = crypto.getRandomValues(new Uint32Array(4)).join("-");
      const passwordHash = await hashHex(`${salt}:${p1}`);
      rows.push({
        id: `teamleader-${crypto.getRandomValues(new Uint32Array(1))[0]}`,
        role: "teamleader",
        status: "pending",
        branchId,
        username: u,
        email: m,
        salt,
        passwordHash,
        createdAt: isoNow(),
      });
      saveJson(TEAMLEADER_ACCOUNTS_KEY, rows);
      error.textContent = "Registration submitted. Admin must approve this team leader before login.";
      form.reset();
    });
  };

  init();
})();
