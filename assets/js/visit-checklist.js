(function () {
  var groups = [
    { name: "Bathroom", items: [
      "Did they measure the center of the toilet from the side wall, and the height of the seat?",
      "Did they show where a grab bar would go, and whether the wall behind it can hold one?",
      "Did they measure the inside of the shower, and the height of any curb?",
      "Did they plan a place to sit in the shower, and a handheld shower if you want one?",
      "Did they look at knee space under the sink, and a cover for the pipes?",
      "Did they check how the floor feels underfoot when it is wet?"
    ]},
    { name: "Doors and floors", items: [
      "Did they measure the clear width of each doorway on the route you actually walk?",
      "Did they measure the height of each threshold on that route?",
      "Did they find one spot to turn, if a wheelchair is part of the plan?"
    ]},
    { name: "Entry and stairs", items: [
      "Did they measure the rise at the door you use most?",
      "If they propose a ramp, did they give the slope, the length, and where you would rest?",
      "Did they check the handrail height, and a rail for each hand?"
    ]},
    { name: "Kitchen, bedroom, and light", items: [
      "Did they check the reach to the controls you use every day?",
      "Did they look at the path from the bed to the bathroom, and a light on that path?",
      "Did they say whether a place to sleep on the main floor is possible, if stairs are the problem?"
    ]},
    { name: "Before they leave", items: [
      "Did they say what is included in the price, and what would cost extra?",
      "Did they say whether the work needs a permit, and who pulls it?",
      "Did they say how long the work takes, and where you will bathe or cook meanwhile?",
      "Did they say what the wall is made of where a bar would be mounted?"
    ]}
  ];
  var root = document.getElementById("visit-app");
  if (!root) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saved = { checks: {}, notes: "" };
  try { saved = JSON.parse(localStorage.getItem("aipa-visit-v1") || "") || saved; } catch (e) {}
  if (!saved.checks) saved.checks = {};
  var index = 0;
  var reached = 0;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function prior(id) {
    var mark = saved.checks[id];
    if (mark === true || mark === "yes") return "yes";
    if (mark === "no") return "no";
    return "";
  }

  var steps = [];
  var n = 0;
  groups.forEach(function (group) {
    group.items.forEach(function (text) {
      steps.push({ id: "v" + n, kind: "ask", group: group.name, short: group.name, text: text });
      n += 1;
    });
  });
  var askCount = steps.length;
  steps.push({ id: "notes", kind: "notes", group: "Notes", short: "Notes", text: "Anything you want to remember from the visit" });
  var total = steps.length;

  var segs = "";
  steps.forEach(function (step, i) {
    segs += '<button type="button" data-go="' + i + '" aria-label="Question ' + (i + 1) + ", " + esc(step.short) + '"><span></span></button>';
  });
  var slides = "";
  steps.forEach(function (step, i) {
    slides += '<article class="safety-slide"><fieldset class="safety-q"><legend><span class="safety-kicker">' + esc(step.group) + "</span>" + esc(step.text) + "</legend>";
    if (step.kind === "ask") {
      var yesOn = prior(step.id) === "yes" ? " checked" : "";
      var noOn = prior(step.id) === "no" ? " checked" : "";
      slides += '<div class="picks">';
      slides += '<label><input type="radio" name="' + step.id + '" value="yes"' + yesOn + "> Yes</label>";
      slides += '<label><input type="radio" name="' + step.id + '" value="no"' + noOn + "> No</label>";
      slides += "</div>";
    } else {
      slides += '<textarea id="visit-notes" class="tool-notes" aria-label="Notes from the visit">' + esc(saved.notes || "") + "</textarea>";
      slides += '<p class="safety-restart"><button type="button" id="visit-restart">Start over</button></p>';
    }
    slides += "</fieldset></article>";
  });

  root.innerHTML = '<div class="safety-head no-print"><p id="visit-status">Question 1 of ' + total + '</p><p id="visit-count">0 of ' + askCount + ' covered</p></div>' +
    '<div class="safety-meter no-print" role="progressbar" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="1" aria-labelledby="visit-status">' + segs + "</div>" +
    '<div class="safety-stage no-print"><div class="safety-track" id="visit-track" tabindex="0" aria-label="Questions">' + slides + '</div><div class="safety-controls"><button type="button" class="safety-arrow" id="visit-prev">Back</button><button type="button" class="safety-arrow" id="visit-next">Next</button></div></div>' +
    '<div class="tool-summary" id="visit-summary" aria-live="polite"></div>';

  var track = document.getElementById("visit-track");
  var prevBtn = document.getElementById("visit-prev");
  var nextBtn = document.getElementById("visit-next");
  var meter = root.querySelector(".safety-meter");

  function choice(id) {
    var picked = root.querySelector('input[name="' + id + '"]:checked');
    return picked ? picked.value : "";
  }

  function paint() {
    meter.setAttribute("aria-valuenow", String(reached + 1));
    meter.setAttribute("aria-valuetext", "Through question " + (reached + 1) + " of " + total);
    document.getElementById("visit-status").textContent = "Question " + (index + 1) + " of " + total + " · " + steps[index].short;
    var covered = 0;
    steps.forEach(function (step) {
      if (step.kind === "ask" && choice(step.id) === "yes") covered += 1;
    });
    document.getElementById("visit-count").textContent = covered + " of " + askCount + " covered";
    var buttons = meter.querySelectorAll("button");
    steps.forEach(function (step, i) {
      buttons[i].className = (i <= reached ? "is-done" : "") + (i === index ? " is-current" : "");
    });
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === steps.length - 1 ? "The list" : "Next";
  }

  function go(i) {
    var cards = track.querySelectorAll(".safety-slide");
    index = Math.max(0, Math.min(cards.length - 1, i));
    if (index > reached) reached = index;
    cards.forEach(function (card, n) {
      var on = n === index;
      card.classList.toggle("is-on", on);
      card.inert = !on;
      if (on) card.removeAttribute("aria-hidden");
      else card.setAttribute("aria-hidden", "true");
    });
    paint();
  }

  function draw() {
    var checks = {};
    var covered = 0;
    steps.forEach(function (step) {
      if (step.kind !== "ask") return;
      var mark = choice(step.id);
      if (mark) checks[step.id] = mark;
      if (mark === "yes") covered += 1;
    });
    var notes = document.getElementById("visit-notes").value;
    try { localStorage.setItem("aipa-visit-v1", JSON.stringify({ checks: checks, notes: notes })); } catch (e) {}
    var body = "<h2>The list for the visit</h2>";
    body += "<p>" + covered + " of " + askCount + " covered. What is still open is worth asking before they leave.</p>";
    var cursor = 0;
    groups.forEach(function (group) {
      body += '<h3>' + esc(group.name) + '</h3><ul class="result-list">';
      group.items.forEach(function () {
        var step = steps[cursor];
        cursor += 1;
        var mark = choice(step.id);
        var chip = mark === "yes" ? '<span class="tone tone-green">Covered</span>' : '<span class="tone">Still to ask</span>';
        var tick = mark === "yes" ? '<path d="M3.2 8.1 6.4 11.2 12.6 4.4" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' : "";
        var box = '<svg class="visit-box" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.2" y="1.2" width="13.6" height="13.6" fill="#fff" stroke="#000" stroke-width="1.4"/>' + tick + "</svg>";
        body += "<li>" + box + chip + "<p>" + esc(step.text) + "</p></li>";
      });
      body += "</ul>";
    });
    if (notes.trim()) body += "<h3>Notes</h3><p>" + esc(notes) + "</p>";
    body += '<p class="no-print" style="margin-top:1.25rem"><button type="button" class="btn" id="visit-print">Print this list</button></p>';
    document.getElementById("visit-summary").innerHTML = body;
    document.getElementById("visit-print").addEventListener("click", function () {
      var go = function () { window.print(); };
      if (document.fonts && document.fonts.load) document.fonts.load('28pt "VI Phong Lan Hoa"').then(go, go);
      else go();
    });
    paint();
  }

  function answer(input) {
    if (!input || !input.name) return;
    var which = -1;
    steps.forEach(function (step, i) { if (step.id === input.name) which = i; });
    if (which < 0) return;
    input.checked = true;
    draw();
    setTimeout(function () {
      if (which < steps.length - 1) go(which + 1);
      else document.getElementById("visit-summary").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }, 0);
  }

  var already = false;
  root.addEventListener("pointerdown", function (event) {
    var label = event.target.closest(".picks label");
    var input = label && label.querySelector("input");
    already = !!(input && input.checked);
  });
  root.addEventListener("click", function (event) {
    var label = event.target.closest(".picks label");
    if (!label || !already) return;
    already = false;
    answer(label.querySelector("input"));
  });
  root.addEventListener("change", function (event) {
    if (!event.target || event.target.type !== "radio") return;
    answer(event.target);
  });
  document.getElementById("visit-notes").addEventListener("input", draw);
  document.getElementById("visit-restart").addEventListener("click", function () {
    root.querySelectorAll('#visit-track input[type="radio"]').forEach(function (input) { input.checked = false; });
    document.getElementById("visit-notes").value = "";
    reached = 0;
    try { localStorage.removeItem("aipa-visit-v1"); } catch (e) {}
    draw();
    go(0);
  });
  prevBtn.addEventListener("click", function () { go(index - 1); });
  nextBtn.addEventListener("click", function () {
    if (index === steps.length - 1) {
      document.getElementById("visit-summary").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    } else {
      go(index + 1);
    }
  });
  meter.addEventListener("click", function (event) {
    var btn = event.target.closest("button");
    if (!btn) return;
    go(Number(btn.getAttribute("data-go")));
  });
  track.addEventListener("keydown", function (event) {
    if (event.target && event.target.tagName === "TEXTAREA") return;
    if (event.key === "ArrowRight") { event.preventDefault(); go(index + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(index - 1); }
  });

  draw();
  var start = steps.length - 1;
  steps.some(function (step, i) {
    if (step.kind !== "ask") return false;
    if (!choice(step.id)) { start = i; return true; }
    return false;
  });
  go(start);
})();
