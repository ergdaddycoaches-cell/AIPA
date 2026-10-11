(function () {
  var questions = [
    { id: "door", room: "Getting in", priority: "now", text: "Can you get in the door you use most without stepping up?", fix: "That step is worth solving before a fall. A graded path, or a short ramp, is the usual answer.", href: "/library/entries-stairs/" },
    { id: "doorlight", room: "Getting in", priority: "soon", text: "Is the way to that door lit well enough to see at night?", fix: "Add a light you can switch on from inside, aimed so it does not glare in your eyes.", href: "/library/materials-lighting/" },
    { id: "rails", room: "Stairs", priority: "now", text: "Can you hold a rail on both sides of the stairs you use?", fix: "A second rail gives the other hand something to hold.", href: "/library/entries-stairs/" },
    { id: "railheight", room: "Stairs", priority: "later", text: "Can you hold those rails without reaching up or stooping?", fix: "A rail is most useful with its top about 34 to 38 inches off the stair.", href: "/standards/" },
    { id: "bar", room: "Bathroom", priority: "now", text: "Is there a grab bar beside the toilet, screwed into the wall framing, not a suction cup?", fix: "A bar in the studs is what holds a person. A suction cup pulls off a wet wall.", href: "/library/bathrooms/" },
    { id: "curb", room: "Bathroom", priority: "now", text: "Can you get into the shower without stepping over a curb?", fix: "A curb is a trip. A seat helps right away. Taking the curb out is a bigger project.", href: "/library/bathrooms/" },
    { id: "seat", room: "Bathroom", priority: "soon", text: "Is there a solid place to sit in the shower?", fix: "A chair, or a bench built in, means you do not have to stand the whole time.", href: "/library/bathrooms/" },
    { id: "toilet", room: "Bathroom", priority: "soon", text: "Can you get up from the toilet without pushing off the sink?", fix: "A seat about 17 to 19 inches high is easier to stand up from.", href: "/library/bathrooms/" },
    { id: "rugs", room: "Floors", priority: "now", text: "Are the paths you walk every day free of loose rugs and raised thresholds?", fix: "A loose rug, or a lip over about a quarter inch, catches a foot and a walker.", href: "/library/materials-lighting/" },
    { id: "turn", room: "Bathroom", priority: "soon", text: "Is there room to turn around with a walker without moving furniture?", fix: "If a walker is in the picture, one clear spot in the bathroom matters more than a wide hall.", href: "/library/bathrooms/" },
    { id: "night", room: "Night", priority: "now", text: "Can you see the floor from the bed to the bathroom without a bright overhead light?", fix: "A low light on that path prevents the stumble that happens half asleep.", href: "/library/kitchens-bedrooms/" },
    { id: "stove", room: "Kitchen", priority: "soon", text: "If a burner is left on, will the stove shut itself off?", fix: "An induction cooktop, or an auto shut-off, is the usual fix. A loud timer helps until then.", href: "/library/kitchens-bedrooms/" },
    { id: "reach", room: "Reach", priority: "later", text: "Are the things you use every day, including switches, within a comfortable reach?", fix: "Everyday things belong between about 15 and 48 inches off the floor.", href: "/standards/" },
    { id: "doors", room: "Doors", priority: "soon", text: "Do the doorways you pass through every day open wide enough for a walker?", fix: "A clear opening of 32 inches is the minimum a walker needs. 36 feels less tight.", href: "/standards/" },
    { id: "main", room: "If the stairs are out", priority: "soon", text: "If you could not use the stairs for a month, could you sleep and bathe on the main floor?", fix: "A place to sleep downstairs is the backup when a stairlift is still a maybe.", href: "/library/kitchens-bedrooms/" }
  ];
  var choices = [
    { value: "ok", label: "Yes" },
    { value: "not", label: "No" },
    { value: "na", label: "Doesn't apply" }
  ];
  var chipName = { now: "Fix first", soon: "Plan next", later: "Can wait" };
  var chipClass = { now: "tone-red", soon: "tone-orange", later: "tone-green" };
  var root = document.getElementById("safety-app");
  if (!root) return;
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem("aipa-safety-v1") || "{}"); } catch (e) { saved = {}; }
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var index = 0;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var segs = "";
  questions.forEach(function (q, i) {
    segs += '<button type="button" data-go="' + i + '" aria-label="Question ' + (i + 1) + ", " + esc(q.room) + '"><span></span></button>';
  });
  var slides = "";
  questions.forEach(function (q, i) {
    slides += '<article class="safety-slide"><fieldset class="safety-q"><legend><span class="safety-kicker">' + esc(q.room) + "</span>" + esc(q.text) + '</legend><div class="picks">';
    choices.forEach(function (c) {
      var on = saved[q.id] === c.value ? " checked" : "";
      slides += '<label><input type="radio" name="' + q.id + '" value="' + c.value + '"' + on + "> " + esc(c.label) + "</label>";
    });
    slides += "</div></fieldset>";
    if (i === questions.length - 1) slides += '<p class="safety-restart"><button type="button" id="safety-restart">Start over</button></p>';
    slides += "</article>";
  });
  root.innerHTML = '<div class="safety-head no-print"><p id="safety-status">Question 1 of 15</p><p id="safety-count">0 of 15 answered</p></div>' +
    '<div class="safety-meter no-print" role="progressbar" aria-valuemin="0" aria-valuemax="15" aria-valuenow="0" aria-labelledby="safety-count">' + segs + "</div>" +
    '<div class="safety-stage no-print"><div class="safety-track" id="safety-track" tabindex="0" aria-label="Questions">' + slides + '</div><div class="safety-controls"><button type="button" class="safety-arrow" id="safety-prev">Back</button><button type="button" class="safety-arrow" id="safety-next">Next</button></div></div>' +
    '<div class="tool-summary" id="safety-summary" aria-live="polite"></div>';

  var track = document.getElementById("safety-track");
  var prevBtn = document.getElementById("safety-prev");
  var nextBtn = document.getElementById("safety-next");
  var meter = root.querySelector(".safety-meter");

  function answers() {
    var out = {};
    questions.forEach(function (q) {
      var picked = root.querySelector('input[name="' + q.id + '"]:checked');
      if (picked) out[q.id] = picked.value;
    });
    return out;
  }

  var reached = 0;

  function paint(got) {
    var n = Object.keys(got).length;
    meter.setAttribute("aria-valuenow", String(reached + 1));
    meter.setAttribute("aria-valuetext", "Through question " + (reached + 1) + " of 15");
    document.getElementById("safety-count").textContent = n + " of 15 answered";
    document.getElementById("safety-status").textContent = "Question " + (index + 1) + " of 15 · " + questions[index].room;
    var buttons = meter.querySelectorAll("button");
    questions.forEach(function (q, i) {
      buttons[i].className = (i <= reached ? "is-done" : "") + (i === index ? " is-current" : "");
    });
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === questions.length - 1 ? "Results" : "Next";
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
    paint(answers());
  }

  function answer(input) {
    if (!input || !input.name) return;
    var which = -1;
    questions.forEach(function (q, i) { if (q.id === input.name) which = i; });
    if (which < 0) return;
    input.checked = true;
    draw();
    setTimeout(function () {
      if (which < questions.length - 1) go(which + 1);
      else {
        go(which);
        document.getElementById("safety-summary").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    }, 0);
  }

  function draw() {
    var got = answers();
    try { localStorage.setItem("aipa-safety-v1", JSON.stringify(got)); } catch (e) {}
    paint(got);
    var groups = { now: [], soon: [], later: [] };
    questions.forEach(function (q) {
      if (got[q.id] === "not") groups[q.priority].push(q);
    });
    var n = Object.keys(got).length;
    var body = "<h2>What to fix first</h2>";
    var waiting = groups.now.length + groups.soon.length + groups.later.length;
    if (!waiting) {
      body += n ? '<p><span class="tone tone-green">Nothing is waiting</span></p><p>The items you marked fine can stay as they are.</p>' : "<p>As you answer, anything still to do shows up here. Red is first. Orange is next. Light green can wait.</p>";
    } else {
      body += '<p class="safety-legend">';
      if (groups.now.length) body += '<span class="tone tone-red">' + groups.now.length + " to fix first</span>";
      if (groups.soon.length) body += '<span class="tone tone-orange">' + groups.soon.length + " to plan next</span>";
      if (groups.later.length) body += '<span class="tone tone-green">' + groups.later.length + " that can wait</span>";
      body += "</p>";
    }
    if (waiting) {
      body += '<ul class="result-list">';
      ["now", "soon", "later"].forEach(function (key) {
        groups[key].forEach(function (q) {
          body += '<li><span class="tone ' + chipClass[key] + '">' + chipName[key] + "</span><p>" + esc(q.fix) + '</p><a href="' + q.href + '">Read the guide</a></li>';
        });
      });
      body += "</ul>";
    }
    body += '<p class="no-print" style="margin-top:1.25rem"><button type="button" class="btn" id="safety-print">Print this summary</button></p>';
    document.getElementById("safety-summary").innerHTML = body;
    document.getElementById("safety-print").addEventListener("click", function () {
      var go = function () { window.print(); };
      if (document.fonts && document.fonts.load) document.fonts.load('28pt "VI Phong Lan Hoa"').then(go, go);
      else go();
    });
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
  document.getElementById("safety-restart").addEventListener("click", function () {
    root.querySelectorAll("#safety-track input").forEach(function (input) { input.checked = false; });
    try { localStorage.removeItem("aipa-safety-v1"); } catch (e) {}
    reached = 0;
    draw();
    go(0);
  });
  prevBtn.addEventListener("click", function () { go(index - 1); });
  nextBtn.addEventListener("click", function () {
    if (index === questions.length - 1) {
      document.getElementById("safety-summary").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
    if (event.key === "ArrowRight") { event.preventDefault(); go(index + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(index - 1); }
  });

  draw();
  var start = 0;
  questions.some(function (q, i) {
    if (!saved[q.id]) { start = i; return true; }
    return false;
  });
  go(start);
})();
