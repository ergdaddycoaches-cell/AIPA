(function () {
  function leaves(a) {
    var href = a.getAttribute("href");
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return false;
    var url;
    try { url = new URL(a.href, location.href); } catch (e) { return false; }
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.origin !== location.origin;
  }

  function arm(a) {
    if (!a || a.tagName !== "A" || !leaves(a) || a.getAttribute("target") === "_blank") return;
    a.setAttribute("target", "_blank");
    var rel = a.getAttribute("rel") || "";
    if (!/\bnoopener\b/.test(rel)) rel = (rel + " noopener").trim();
    if (!/\bnoreferrer\b/.test(rel)) rel = (rel + " noreferrer").trim();
    a.setAttribute("rel", rel);
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches("a[href]")) arm(root);
    var list = root.querySelectorAll("a[href]");
    for (var i = 0; i < list.length; i++) arm(list[i]);
  }

  function boot() {
    if (document.body.classList.contains("tool-page") && document.fonts && document.fonts.load) {
      document.fonts.load('28pt "VI Phong Lan Hoa"');
    }
    scan(document);
    new MutationObserver(function (records) {
      for (var r = 0; r < records.length; r++) {
        var nodes = records[r].addedNodes;
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === 1) scan(nodes[i]);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
