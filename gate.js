(function () {
  "use strict";

  var cfg = window.__VB_GATE_CONFIG__ || {};
  var firebaseAppUrl = "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js";
  var firebaseFirestoreUrl = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js";
  var configPath = cfg.configPath || "./firebase.config.js";
  var redirectOnLock = !!cfg.redirectOnLock;
  var redirectTo = cfg.redirectTo || "./index.html";
  var prefetchRequired = !!cfg.prefetchRequired;
  var lastGateOpen = null;

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

  function showPendingOverlay() {
    showOverlay("수업 상태 확인 중", "관리자 게이트 상태를 확인하고 있습니다. 잠시만 기다려 주세요.");
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

  async function prefetchGate(gateRef) {
    try {
      var snap = await gateRef.get({ source: "server" });
      var open = !!(snap.exists && snap.data() && snap.data().open === true);
      console.info("[gate] prefetch ok/open=" + open);
      if (open) applyGateState(true);
      else if (!snap.exists) applyGateState(false, "관리자가 아직 수업을 열지 않았습니다.");
      else applyGateState(false, "현재 수업이 닫혀 있습니다.");
      return true;
    } catch (err) {
      console.warn("[gate] prefetch failed:", err);
      if (prefetchRequired) {
        applyGateState(false, "서버 상태를 확인할 수 없어 접근이 잠겨 있습니다.");
      }
      return false;
    }
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

  async function initGate() {
    ensureGateStyle();
    setPending(true);
    showPendingOverlay();

    try {
      var bootTasks = [];
      if (!window.firebase || !firebase.firestore) {
        bootTasks.push((async function () {
          await loadScript(firebaseAppUrl);
          await loadScript(firebaseFirestoreUrl);
        })());
      }
      if (!window.FB_CONFIG) {
        bootTasks.push(loadScript(configPath));
      }
      if (bootTasks.length) {
        await Promise.all(bootTasks);
      }

      if (!window.firebase || !window.FB_CONFIG) {
        throw new Error("firebase config missing");
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(window.FB_CONFIG);
      }

      var db = firebase.firestore();
      var classId = String(window.CLASS_ID || "public-class-1").trim() || "public-class-1";
      var gateRef = db.collection("classes").doc(classId).collection("control").doc("gate");
      var prefetchOk = await prefetchGate(gateRef);
      if (!prefetchOk && prefetchRequired) return;

      gateRef.onSnapshot(function (snap) {
        if (!snap.exists) applyGateState(false, "관리자가 아직 수업을 열지 않았습니다.");
        else applyGateState(snap.data() && snap.data().open === true, "현재 수업이 닫혀 있습니다.");
      }, function (err) {
        console.warn("[gate] snapshot failed:", err);
        if (!prefetchOk || lastGateOpen === null) {
          applyGateState(false, "서버 상태를 확인할 수 없어 접근이 잠겨 있습니다.");
          return;
        }
        var msg = "서버 상태를 확인할 수 없어 접근이 잠겨 있습니다.";
        if (err && err.message) msg += " (" + err.message + ")";
        applyGateState(false, msg);
      });
    } catch (err) {
      console.warn("[gate] init failed:", err);
      applyGateState(false, "게이트 확인에 실패해 접근이 차단되었습니다.");
    }
  }

  initGate();
})();
