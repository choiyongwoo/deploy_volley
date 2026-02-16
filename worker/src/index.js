const ALLOWED_ORIGIN = "https://choiyongwoo.github.io";
const CLASS_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function corsHeaders(origin) {
  if (!origin || origin !== ALLOWED_ORIGIN) {
    return {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    };
  }
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

function parseClassId(classId) {
  const v = String(classId || "").trim();
  if (!CLASS_ID_RE.test(v)) return null;
  return v;
}

function gateKey(classId) {
  return `gate:${classId}`;
}

function normalizeGate(input) {
  return {
    open: input?.open === true,
    updatedAt: Number.isFinite(Number(input?.updatedAt)) ? Number(input.updatedAt) : 0,
    updatedBy: String(input?.updatedBy || ""),
    note: String(input?.note || "")
  };
}

async function handleGet(url, env, origin) {
  const classId = parseClassId(url.searchParams.get("classId"));
  if (!classId) return json({ error: "invalid classId" }, 400, origin);

  const raw = await env.GATE_KV.get(gateKey(classId), "json");
  const state = normalizeGate(raw || { open: false, updatedAt: 0, updatedBy: "", note: "" });

  return json({
    open: state.open,
    updatedAt: state.updatedAt,
    note: state.note
  }, 200, origin);
}

async function handlePost(request, env, origin) {
  if (origin && origin !== ALLOWED_ORIGIN) {
    return json({ error: "origin not allowed" }, 403, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid json" }, 400, origin);
  }

  const classId = parseClassId(body.classId);
  if (!classId) return json({ error: "invalid classId" }, 400, origin);
  if (typeof body.open !== "boolean") return json({ error: "open must be boolean" }, 400, origin);
  if (!env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD is not configured" }, 500, origin);

  const password = String(body.password || "");
  if (!password || password !== env.ADMIN_PASSWORD) {
    return json({ error: "invalid password" }, 401, origin);
  }

  const note = String(body.note || "").trim().slice(0, 200);
  const next = {
    open: body.open === true,
    updatedAt: Date.now(),
    updatedBy: "admin-password",
    note
  };

  await env.GATE_KV.put(gateKey(classId), JSON.stringify(next));

  return json({ ok: true, state: next }, 200, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) {
        return json({ error: "origin not allowed" }, 403, origin);
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (url.pathname !== "/gate") {
      return json({ error: "not found" }, 404, origin);
    }

    if (request.method === "GET") {
      return handleGet(url, env, origin);
    }

    if (request.method === "POST") {
      return handlePost(request, env, origin);
    }

    return json({ error: "method not allowed" }, 405, origin);
  }
};
