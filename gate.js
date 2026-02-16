(function () {
  "use strict";

  var cfg = window.__VB_GATE_CONFIG__ || {};
  var configPath = cfg.configPath || "./firebase.config.js";
  var redirectOnLock = !!cfg.redirectOnLock;
  var redirectTo = cfg.redirectTo || "./index.html";
  var pollMs = Number(cfg.pollMs || 2000);
  var failThreshold = Number(cfg.failThreshold || 3);
  var apiBaseOverride = String(cfg.gateApiBase || "").trim();

  if (!Number.isFinite(pollMs) || pollMs < 500) pollMs = 2000;
  if (!Number.isFinite(failThreshold) || failThreshold < 1) failThreshold = 3;

  var lastGateOpen = null;
  var pollTimer = null;
  var consecutiveFails = 0;
  var gateUrl = "";

  window.__VB_GATE_IS_OPEN__ = false;
  window.__VB_GATE_READY__ = false;

  function emitGateEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {
      // no-op
    }
  }

  function ensureGateStyle() {
    if (document.getElementById("vbGateStyle")) return;
    var style = document.createElement("style");
    style.id = "vbGateStyle";
    style.textContent = [
      "#vbGateOverlay {",
      "  position: fixed; inset: 0; z-index: 2147483647;",
      "  display: flex; align-items: center; justify-content: center;",
      "  background: rgba(15, 23, 42, 0.84); color: #fff;",
      "  padding: 24px; text-align: center; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;",
      "}",
      "#vbGateOverlay .card { max-width: 520px; width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 14px; padding: 20px; }",
      "#vbGateOverlay h2 { margin: 0 0 10px; font-size: 22px; font-weight: 900; }",
      "#vbGateOverlay p { margin: 0; line-height: 1.5; font-size: 14px; opacity: 0.92; }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function setPending(on) {
    if (on) document.documentElement.classList.add("vb-gate-pending");
    else document.documentElement.classList.remove("vb-gate-pending");
  }

  function showOverlay(title, message) {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", function () {
        showOverlay(title, message);
      }, { once: true });
      return;
    }

    var root = document.getElementById("vbGateOverlay");
    if (!root) {
      root = document.createElement("div");
      root.id = "vbGateOverlay";
      document.body.appendChild(root);
    }

    root.innerHTML = '<div class="card"><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(message) + '</p></div>';
  }

  function showPendingOverlay() {
    showOverlay("수업 상태 확인 중", "관리자 게이트 상태를 확인하고 있습니다. 잠시만 기다려 주세요.");
  }

  function hideOverlay() {
    var root = document.getElementById("vbGateOverlay");
    if (root) root.remove();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>\"']/g, function (m) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m];
    });
  }

  function lockPage(reason) {
    window.__VB_GATE_IS_OPEN__ = false;
    window.__VB_GATE_READY__ = true;
    setPending(false);
    showOverlay("수업이 잠겨 있어요", reason || "관리자가 수업을 열 때까지 기다려 주세요.");
    emitGateEvent("vb-gate-change", { open: false, reason: reason || "locked" });
    emitGateEvent("vb-gate-locked", { reason: reason || "locked" });

    if (redirectOnLock) {
      var target = new URL(redirectTo, location.href).toString();
      if (location.href !== target) {
        setTimeout(function () { location.replace(target); }, 80);
      }
    }
  }

  function openPage() {
    window.__VB_GATE_IS_OPEN__ = true;
    window.__VB_GATE_READY__ = true;
    setPending(false);
    hideOverlay();
    emitGateEvent("vb-gate-change", { open: true });
    emitGateEvent("vb-gate-open", { open: true });
  }

  function applyGateState(isOpen, reason) {
    var open = isOpen === true;
    if (lastGateOpen === open) return;
    lastGateOpen = open;
    if (open) openPage();
    else lockPage(reason || "현재 수업이 닫혀 있습니다.");
  }

  function sanitizeBase(base) {
    return String(base || "").replace(/\/+$/, "");
  }

  function buildGateUrl() {
    var base = sanitizeBase(apiBaseOverride || window.GATE_API_BASE || "");
    var classId = String(window.CLASS_ID || "public-class-1").trim() || "public-class-1";
    if (!base) throw new Error("GATE_API_BASE missing");
    return base + "/gate?classId=" + encodeURIComponent(classId);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = Array.prototype.find.call(document.scripts, function (s) {
        return s.src === src || s.src === new URL(src, location.href).toString();
      });

      if (existing) {
        if (existing.dataset.loaded === "1") return resolve();
        existing.addEventListener("load", function () { resolve(); }, { once: true });
        existing.addEventListener("error", function () { reject(new Error("script load failed: " + src)); }, { once: true });
        return;
      }

      var el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.addEventListener("load", function () {
        el.dataset.loaded = "1";
        resolve();
      }, { once: true });
      el.addEventListener("error", function () { reject(new Error("script load failed: " + src)); }, { once: true });
      document.head.appendChild(el);
    });
  }

  function gateMetaSuffix(data) {
    var parts = [];
    if (typeof data.updatedAt === "number" && data.updatedAt > 0) {
      try {
        parts.push(new Date(data.updatedAt).toLocaleString("ko-KR"));
      } catch (_) {
        // no-op
      }
    }
    if (data.note) parts.push("메모: " + String(data.note));
    return parts.length ? " (" + parts.join(" / ") + ")" : "";
  }

  async function fetchGateState() {
    var res = await fetch(gateUrl, {
      method: "GET",
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) {
      throw new Error("GET /gate failed: HTTP " + res.status);
    }
    var data = await res.json();
    if (!data || typeof data.open !== "boolean") {
      throw new Error("invalid gate response");
    }
    return data;
  }

  async function checkGate(initial) {
    try {
      var data = await fetchGateState();
      consecutiveFails = 0;
      if (data.open === true) {
        applyGateState(true);
      } else {
        applyGateState(false, "현재 수업이 닫혀 있습니다." + gateMetaSuffix(data));
      }
      return true;
    } catch (err) {
      consecutiveFails += 1;
      console.warn("[gate] poll failed:", err);
      if (initial || consecutiveFails >= failThreshold) {
        applyGateState(false, "서버 상태를 확인할 수 없어 접근이 잠겨 있습니다.");
      }
      return false;
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      void checkGate(false);
    }, pollMs);
  }

  async function initGate() {
    ensureGateStyle();
    setPending(true);
    showPendingOverlay();

    try {
      if (!window.GATE_API_BASE) {
        await loadScript(configPath);
      }
      gateUrl = buildGateUrl();
      console.info("[gate] using api:", gateUrl);
      await checkGate(true);
      startPolling();
    } catch (err) {
      console.warn("[gate] init failed:", err);
      applyGateState(false, "게이트 확인에 실패해 접근이 차단되었습니다.");
    }
  }

  window.addEventListener("beforeunload", function () {
    if (pollTimer) clearInterval(pollTimer);
  });

  initGate();
})();
