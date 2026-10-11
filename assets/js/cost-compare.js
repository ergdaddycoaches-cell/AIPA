(function () {
  var jobs = [
    { id: "bars", short: "Grab bars", name: "Grab bars, anchored in the wall", low: 200, high: 800 },
    { id: "lights", short: "Handles and lights", name: "Lever handles and brighter lights", low: 150, high: 900 },
    { id: "toilet", short: "Toilet", name: "A comfort-height toilet", low: 400, high: 1500 },
    { id: "seat", short: "Shower seat", name: "A shower seat and a handheld shower", low: 250, high: 1200 },
    { id: "curb", short: "Curbless shower", name: "A curbless shower", low: 8000, high: 25000 },
    { id: "entry", short: "Entry", name: "A zero-step entry, or a ramp", low: 1500, high: 15000 },
    { id: "lift", short: "Stairlift", name: "A stairlift", low: 3000, high: 15000 },
    { id: "suite", short: "Main floor", name: "A bedroom and bath on the main floor", low: 20000, high: 80000 }
  ];
  var root = document.getElementById("cost-app");
  if (!root) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var index = 0;
  var reached = 0;

  function money(n) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var raw = el.value.replace(/[^0-9.]/g, "");
    var v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  }

  var steps = [];
  jobs.forEach(function (job) {
    steps.push({
      id: job.id,
      kind: "job",
      short: job.short,
      kicker: "Home project",
      title: "Include " + job.name.charAt(0).toLowerCase() + job.name.slice(1) + "?",
      note: money(job.low) + " to " + money(job.high) + ". A planning spread, not a bid."
    });
  });
  steps.push({ id: "own", kind: "money", short: "Your price", kicker: "Your price", title: "A price you already have, if you have one" });
  steps.push({ id: "help", kind: "money", short: "Help at home", kicker: "Help at home", title: "Monthly help at home, if you want it in the sketch" });
  steps.push({ id: "care", kind: "money", short: "Assisted living", kicker: "Assisted living", title: "Monthly assisted living near you" });

  var total = steps.length;
  var segs = "";
  steps.forEach(function (step, i) {
    segs += '<button type="button" data-go="' + i + '" aria-label="Question ' + (i + 1) + ", " + esc(step.short) + '"><span></span></button>';
  });
  var slides = "";
  steps.forEach(function (step, i) {
    slides += '<article class="safety-slide"><fieldset class="safety-q"><legend><span class="safety-kicker">' + esc(step.kicker) + "</span>" + esc(step.title) + "</legend>";
    if (step.kind === "job") {
      slides += '<p class="muted">' + esc(step.note) + '</p><div class="picks">';
      slides += '<label><input type="radio" name="' + step.id + '" value="yes"> Yes</label>';
      slides += '<label><input type="radio" name="' + step.id + '" value="no"> No</label>';
      slides += "</div>";
    } else if (step.id === "own") {
      slides += '<div class="money-grid"><input id="own" inputmode="decimal" aria-label="A price you already have" placeholder="Leave blank to use the middle of the spreads"></div>';
      slides += '<p class="muted">A contractor\'s price replaces the spreads for the work you include.</p>';
    } else if (step.id === "help") {
      slides += '<div class="money-grid"><input id="help" inputmode="decimal" aria-label="Monthly help at home" value="0"></div>';
      slides += '<p class="muted">Use 0 if the sketch is only the one-time home project.</p>';
    } else {
      slides += '<div class="money-grid"><input id="care" inputmode="decimal" aria-label="Monthly assisted living" value="6200"></div>';
      slides += '<p class="muted">The box starts at $6,200 a month, the 2025 national median for a private one-bedroom in the <a href="https://www.genworth.com/aging-and-you/finances/cost-of-care">CareScout Cost of Care Survey</a>. A place near you may cost more or less.</p>';
      slides += '<p class="safety-restart"><button type="button" id="cost-restart">Start over</button></p>';
    }
    slides += "</fieldset></article>";
  });

  root.innerHTML = '<div class="safety-head no-print"><p id="cost-status">Question 1 of ' + total + '</p><p id="cost-count">No projects included yet</p></div>' +
    '<div class="safety-meter no-print" role="progressbar" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="1" aria-labelledby="cost-status">' + segs + "</div>" +
    '<div class="safety-stage no-print"><div class="safety-track" id="cost-track" tabindex="0" aria-label="Questions">' + slides + '</div><div class="safety-controls"><button type="button" class="safety-arrow" id="cost-prev">Back</button><button type="button" class="safety-arrow" id="cost-next">Next</button></div></div>' +
    '<div class="tool-summary" id="cost-out" aria-live="polite"></div>';

  var track = document.getElementById("cost-track");
  var prevBtn = document.getElementById("cost-prev");
  var nextBtn = document.getElementById("cost-next");
  var meter = root.querySelector(".safety-meter");

  function included() {
    var n = 0;
    jobs.forEach(function (job) {
      var yes = root.querySelector('input[name="' + job.id + '"][value="yes"]');
      if (yes && yes.checked) n += 1;
    });
    return n;
  }

  function paint() {
    meter.setAttribute("aria-valuenow", String(reached + 1));
    meter.setAttribute("aria-valuetext", "Through question " + (reached + 1) + " of " + total);
    document.getElementById("cost-status").textContent = "Question " + (index + 1) + " of " + total + " · " + steps[index].short;
    var n = included();
    document.getElementById("cost-count").textContent = n === 0 ? "No projects included yet" : (n === 1 ? "1 project included" : n + " projects included");
    var buttons = meter.querySelectorAll("button");
    steps.forEach(function (step, i) {
      buttons[i].className = (i <= reached ? "is-done" : "") + (i === index ? " is-current" : "");
    });
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === steps.length - 1 ? "Results" : "Next";
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
    var low = 0;
    var high = 0;
    var picked = 0;
    jobs.forEach(function (job) {
      var yes = root.querySelector('input[name="' + job.id + '"][value="yes"]');
      if (!yes || !yes.checked) return;
      picked += 1;
      low += job.low;
      high += job.high;
    });
    var mid = Math.round((low + high) / 2);
    var own = num("own");
    var homeOnce = own > 0 ? own : mid;
    var help = num("help");
    var care = num("care");
    var homeFive = homeOnce + help * 60;
    var careFive = care * 60;
    var out = document.getElementById("cost-out");
    paint();
    if (!picked && own <= 0) {
      out.innerHTML = "<h2>Five years, side by side</h2><p>Say yes to the work you are considering, or type a price you already have. The five-year sketch will show here.</p>";
      return;
    }
    var max = Math.max(homeFive, careFive, 1);
    var homePct = Math.max(4, Math.round(homeFive / max * 100));
    var carePct = Math.max(4, Math.round(careFive / max * 100));
    var line;
    if (careFive > homeFive) {
      line = "At these numbers, five years of assisted living costs more than adapting the home and the monthly help you entered. This leaves out meals, the value of the house, and care that may get heavier. It is a sketch, not a reason to stay or to move.";
    } else if (homeFive > careFive) {
      line = "At these numbers, adapting the home plus the monthly help you entered costs more over five years than assisted living. This leaves out meals, the value of the house, and care that may get heavier. It is a sketch, not a reason to stay or to move.";
    } else {
      line = "At these numbers the two sides match over five years. This leaves out meals, the value of the house, and care that may get heavier. It is a sketch, not a reason to stay or to move.";
    }
    var range = own > 0 ? "Using the price you typed." : (picked ? "Using the middle of the spreads, " + money(low) + " to " + money(high) + "." : "");
    out.innerHTML = "<h2>Five years, side by side</h2><p>" + esc(range) + "</p><div class=\"bars\"><div><p><b>Adapting the home</b> " + money(homeFive) + "</p><div class=\"track\"><div class=\"fill\" style=\"width:" + homePct + "%\"></div></div><p class=\"muted\">" + money(homeOnce) + " once, plus " + money(help) + " a month of help.</p></div><div><p><b>Assisted living</b> " + money(careFive) + "</p><div class=\"track\"><div class=\"fill alt\" style=\"width:" + carePct + "%\"></div></div><p class=\"muted\">" + money(care) + " a month, for five years.</p></div></div><p>" + esc(line) + "</p>";
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
      else document.getElementById("cost-out").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
  root.addEventListener("input", function (event) {
    if (event.target && event.target.type !== "radio") draw();
  });
  document.getElementById("cost-restart").addEventListener("click", function () {
    root.querySelectorAll('#cost-track input[type="radio"]').forEach(function (input) { input.checked = false; });
    document.getElementById("own").value = "";
    document.getElementById("help").value = "0";
    document.getElementById("care").value = "6200";
    reached = 0;
    draw();
    go(0);
  });
  prevBtn.addEventListener("click", function () { go(index - 1); });
  nextBtn.addEventListener("click", function () {
    if (index === steps.length - 1) {
      document.getElementById("cost-out").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
    if (event.target && event.target.tagName === "INPUT") return;
    if (event.key === "ArrowRight") { event.preventDefault(); go(index + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(index - 1); }
  });

  draw();
  go(0);
})();
