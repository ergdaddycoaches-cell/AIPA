(function () {
  var states = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"];
  var root = document.getElementById("funding-app");
  if (!root) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var index = 0;
  var reached = 0;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function val(name) {
    var picked = root.querySelector('input[name="' + name + '"]:checked');
    return picked ? picked.value : "";
  }

  var steps = [
    { id: "state", kind: "state", short: "State", kicker: "Where you live", title: "Which state is the house in?" },
    { id: "pay", kind: "choice", short: "Paying", kicker: "Paying for the work", title: "Would you need help paying for the work?", options: [["yes", "Yes"], ["no", "No"]] },
    { id: "age", kind: "choice", short: "Age", kicker: "Who lives there", title: "Is anyone in the home 62 or older?", options: [["yes", "Yes"], ["no", "No"]] },
    { id: "rural", kind: "choice", short: "Rural", kicker: "Where the house is", title: "Is the house in a rural area, outside a city?", options: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] },
    { id: "vet", kind: "choice", short: "Veteran", kicker: "Military service", title: "Is anyone in the home a veteran, or a surviving spouse?", options: [["yes", "Yes"], ["no", "No"]] },
    { id: "cover", kind: "choice", short: "Coverage", kicker: "Health coverage", title: "Which health coverage is in the house?", options: [["advantage", "Medicare Advantage"], ["original", "Original Medicare"], ["other", "Other, or not sure"]] }
  ];
  var total = steps.length;

  var stateOpts = '<option value="">Choose a state</option>';
  states.forEach(function (name) { stateOpts += "<option>" + esc(name) + "</option>"; });

  var segs = "";
  steps.forEach(function (step, i) {
    segs += '<button type="button" data-go="' + i + '" aria-label="Question ' + (i + 1) + ", " + esc(step.short) + '"><span></span></button>';
  });
  var slides = "";
  steps.forEach(function (step, i) {
    slides += '<article class="safety-slide"><fieldset class="safety-q"><legend><span class="safety-kicker">' + esc(step.kicker) + "</span>" + esc(step.title) + "</legend>";
    if (step.kind === "state") {
      slides += '<div class="money-grid"><select id="state" aria-label="State">' + stateOpts + "</select></div>";
    } else {
      slides += '<div class="picks">';
      step.options.forEach(function (opt) {
        slides += '<label><input type="radio" name="' + step.id + '" value="' + opt[0] + '"> ' + esc(opt[1]) + "</label>";
      });
      slides += "</div>";
    }
    if (i === steps.length - 1) slides += '<p class="safety-restart"><button type="button" id="funding-restart">Start over</button></p>';
    slides += "</fieldset></article>";
  });

  root.innerHTML = '<div class="safety-head no-print"><p id="funding-status">Question 1 of ' + total + '</p><p id="funding-count">0 of ' + total + ' answered</p></div>' +
    '<div class="safety-meter no-print" role="progressbar" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="1" aria-labelledby="funding-status">' + segs + "</div>" +
    '<div class="safety-stage no-print"><div class="safety-track" id="funding-track" tabindex="0" aria-label="Questions">' + slides + '</div><div class="safety-controls"><button type="button" class="safety-arrow" id="funding-prev">Back</button><button type="button" class="safety-arrow" id="funding-next">Next</button></div></div>' +
    '<div class="tool-summary" id="funding-out" aria-live="polite"></div>';

  var track = document.getElementById("funding-track");
  var prevBtn = document.getElementById("funding-prev");
  var nextBtn = document.getElementById("funding-next");
  var meter = root.querySelector(".safety-meter");

  function answered() {
    var n = document.getElementById("state").value ? 1 : 0;
    steps.forEach(function (step) {
      if (step.kind === "choice" && val(step.id)) n += 1;
    });
    return n;
  }

  function paint() {
    meter.setAttribute("aria-valuenow", String(reached + 1));
    meter.setAttribute("aria-valuetext", "Through question " + (reached + 1) + " of " + total);
    document.getElementById("funding-status").textContent = "Question " + (index + 1) + " of " + total + " · " + steps[index].short;
    document.getElementById("funding-count").textContent = answered() + " of " + total + " answered";
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
    var state = document.getElementById("state").value || "your state";
    var items = [];
    items.push("<li><b>Area Agency on Aging.</b> In " + esc(state) + ', this is the office that knows which local grants are open. Start at the <a href="https://eldercare.acl.gov/">Eldercare Locator</a> and ask about home repair or home modification.</li>');
    if (val("pay") === "yes") {
      items.push("<li><b>A Medicaid waiver.</b> Some home and community-based waivers pay for changes that keep a person out of a nursing home. " + esc(state) + ' sets the rules, and many have a wait list. Ask the Area Agency on Aging which waiver, if any, covers a home. <a href="https://www.medicaid.gov/medicaid/home-community-based-services">Medicaid explains the waivers here.</a></li>');
    }
    if (val("vet") === "yes") {
      items.push('<li><b>VA housing grants and HISA.</b> Specially Adapted Housing and Special Housing Adaptation grants are for some service-connected disabilities. HISA is a separate benefit for medically necessary changes, such as a way in the door or a roll-in shower. HISA does not pay for a stairlift. Start with the <a href="https://www.va.gov/housing-assistance/disability-housing-grants/">VA housing grants page</a> and the <a href="https://www.rehab.va.gov/psas/HISA2.asp">HISA page</a>.</li>');
    }
    if (val("age") === "yes" && val("pay") === "yes" && (val("rural") === "yes" || val("rural") === "unsure")) {
      items.push('<li><b>USDA Section 504 repair loans and grants.</b> For very-low-income homeowners in an eligible rural area. Grants are for people 62 or older and are for health and safety hazards. The program\'s own caps are a $40,000 loan and a $10,000 grant, and those caps can change. <a href="https://www.rd.usda.gov/programs-services/single-family-housing-programs/single-family-housing-repair-loans-grants">See the USDA program</a> and call the office for ' + esc(state) + ".</li>");
    }
    if (val("cover") === "advantage" || val("cover") === "other") {
      items.push("<li><b>Medicare Advantage, maybe.</b> Original Medicare does not pay for grab bars, ramps, or remodeling. Some Advantage plans include a small benefit for safety items. Call the number on the plan card and ask about home modification.</li>");
    } else if (val("cover") === "original") {
      items.push("<li><b>Original Medicare.</b> It does not pay for grab bars, ramps, or remodeling. A Medicare Advantage plan is a different product, and only some of those include a safety benefit.</li>");
    }
    items.push('<li><b>A medical expense on a tax return.</b> If a doctor says the change is for a medical condition, the part of the cost that does not raise the home\'s value may qualify. See <a href="https://www.irs.gov/publications/p502">IRS Publication 502</a>, or a tax preparer. This tool is not tax advice.</li>');
    var list = items.map(function (item) {
      return "<li><p>" + item.slice(4, -5) + "</p></li>";
    }).join("");
    document.getElementById("funding-out").innerHTML = "<h2>What may apply in " + esc(state) + "</h2><p>These are places to ask. The program decides, not this page. Names, amounts, and wait lists change.</p><ul class=\"result-list\">" + list + "</ul>" +
      '<p class="no-print" style="margin-top:1.25rem"><button type="button" class="btn" id="funding-print">Print this list</button></p>';
    document.getElementById("funding-print").addEventListener("click", function () {
      var goPrint = function () { window.print(); };
      if (document.fonts && document.fonts.load) document.fonts.load('28pt "VI Phong Lan Hoa"').then(goPrint, goPrint);
      else goPrint();
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
      else document.getElementById("funding-out").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
    if (!event.target) return;
    if (event.target.id === "state") {
      draw();
      if (event.target.value) setTimeout(function () { go(1); }, 0);
      return;
    }
    if (event.target.type === "radio") answer(event.target);
  });
  document.getElementById("funding-restart").addEventListener("click", function () {
    root.querySelectorAll('#funding-track input[type="radio"]').forEach(function (input) { input.checked = false; });
    document.getElementById("state").value = "";
    reached = 0;
    draw();
    go(0);
  });
  prevBtn.addEventListener("click", function () { go(index - 1); });
  nextBtn.addEventListener("click", function () {
    if (index === steps.length - 1) {
      document.getElementById("funding-out").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
    if (event.target && (event.target.tagName === "SELECT" || event.target.tagName === "INPUT")) return;
    if (event.key === "ArrowRight") { event.preventDefault(); go(index + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(index - 1); }
  });

  draw();
  go(0);
})();
