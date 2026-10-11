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

  function pinBars() {
    var bar = document.querySelector("body > .util");
    if (!bar) return;
    var nav = document.querySelector("body > .mast > .primary");
    function place() {
      document.documentElement.style.setProperty("--util-h", bar.offsetHeight + "px");
      if (nav) document.documentElement.style.setProperty("--nav-h", nav.offsetHeight + "px");
    }
    place();
    if (window.ResizeObserver) {
      var watch = new ResizeObserver(place);
      watch.observe(bar);
      if (nav) watch.observe(nav);
    } else {
      window.addEventListener("resize", place);
    }
  }

  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function zoneStamp(timeZone) {
    var bag = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date()).forEach(function (part) { bag[part.type] = part.value; });
    var hour = bag.hour === "24" ? "00" : bag.hour;
    return bag.year + "-" + bag.month + "-" + bag.day + "T" + hour + ":" + bag.minute;
  }

  function dayPhrase(slot) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(slot.occurrence_at || ""));
    if (!match) return "";
    var year = +match[1], month = +match[2], day = +match[3];
    var weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    var when = weekday + ", " + MONTHS[month - 1] + " " + day;
    if (String(year) !== zoneStamp(slot.timezone).slice(0, 4)) when += ", " + year;
    return when;
  }

  var nextDay = "";
  var nextShort = "";

  function paintQaDays() {
    var nodes, i;
    if (nextDay) {
      nodes = document.querySelectorAll("[data-qa-day]");
      for (i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent !== nextDay) nodes[i].textContent = nextDay;
      }
    }
    if (nextShort) {
      nodes = document.querySelectorAll("[data-qa-next]");
      for (i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent !== nextShort) nodes[i].textContent = nextShort;
      }
    }
  }

  function dateLabel(startsAt, timeZone) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(startsAt || "");
    if (!match) return "";
    var label = MONTHS[+match[2] - 1] + " " + (+match[3]);
    if (match[1] !== zoneStamp(timeZone).slice(0, 4)) label += ", " + match[1];
    return label;
  }

  var ZONES = {
    "America/Honolulu": "Hawaii",
    "America/Los_Angeles": "Pacific",
    "America/Denver": "Mountain",
    "America/Chicago": "Central",
    "America/New_York": "Eastern"
  };
  var WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  function fillSessionLine(lead, slot) {
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(slot.occurrence_at || ""));
    if (!match) return;
    var year = +match[1], month = +match[2], day = +match[3], hour = +match[4], minute = +match[5];
    var weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    var clock = (hour % 12 || 12) + ":" + (minute < 10 ? "0" : "") + minute + " " + (hour < 12 ? "AM" : "PM");
    var zone = ZONES[slot.timezone] || "";
    var when = weekday + ", " + MONTHS[month - 1] + " " + day;
    if (String(year) !== zoneStamp(slot.timezone).slice(0, 4)) when += ", " + year;
    var length = slot.duration_minutes ? slot.duration_minutes + " minutes" : "about 45 minutes";
    var mark = document.createElement("span");
    mark.className = "qa-clock";
    mark.textContent = when + ", at " + clock + (zone ? " " + zone : "");
    lead.textContent = "";
    lead.appendChild(document.createTextNode("Next session: "));
    lead.appendChild(mark);
    lead.appendChild(document.createTextNode(". " + length + ", with no camera. You can join from a phone or a computer, and someone else can join with you."));
  }

  function nextLiveQa() {
    var buttons = document.querySelectorAll(".primary .nav-cta a");
    var cfg = window.AIPA_CONFIG || {};
    if ((!buttons.length && !document.querySelector("[data-qa-day], [data-qa-next], #qa-when")) || !cfg.apiBase) return;
    fetch(cfg.apiBase.replace(/\/$/, "") + "/live-qa", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var next = null;
        ((data && data.months) || []).forEach(function (month) {
          (month.slots || []).forEach(function (slot) {
            var when = String(slot.occurrence_at || "");
            if (!when || when < zoneStamp(slot.timezone)) return;
            if (!next || when < next.occurrence_at) next = slot;
          });
        });
        if (!next) return;
        nextDay = dayPhrase(next);
        var label = dateLabel(next.occurrence_at, next.timezone);
        nextShort = label;
        paintQaDays();
        if (label) {
          for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].querySelector(".cta-when")) continue;
            var line = document.createElement("span");
            line.className = "cta-when";
            line.textContent = "Next: " + label;
            buttons[i].appendChild(line);
          }
        }
        var lead = document.getElementById("qa-when");
        if (lead) fillSessionLine(lead, next);
      })
      .catch(function () {});
  }

  function boot() {
    pinBars();
    nextLiveQa();
    if (document.body.classList.contains("tool-page") && document.fonts && document.fonts.load) {
      document.fonts.load('28pt "VI Phong Lan Hoa"');
    }
    scan(document);
    new MutationObserver(function (records) {
      for (var r = 0; r < records.length; r++) {
        var nodes = records[r].addedNodes;
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === 1) {
            scan(nodes[i]);
            paintQaDays();
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
