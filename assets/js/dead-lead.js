(function(){
  var ask = document.getElementById('roi-ask');
  var cost = document.getElementById('roi-cost');
  var worth = document.getElementById('roi-worth');
  if (!ask || !cost || !worth) return;

  var questions = [
    {key:'leads', title:'How many new leads do you get in a typical month?', help:'Count every inquiry, from any source', value:15, min:1, max:200, step:1, kind:'count'},
    {key:'cost', title:'About how much does each lead cost you?', help:'Ad spend, referral fees, or lead service charges, per lead', value:200, min:25, max:1000, step:5, kind:'money'},
    {key:'close', title:'What percent of your leads become signed jobs?', help:'Your close rate on all leads, not just estimates', value:30, min:5, max:80, step:1, kind:'percent'},
    {key:'job', title:'What’s your average aging-in-place job worth?', help:'Total contract value', value:15000, min:3000, max:75000, step:500, kind:'money'},
    {key:'margin', title:'What’s your gross margin on a typical job?', help:'Revenue minus materials, labor, and subcontractors', value:35, min:10, max:60, step:1, kind:'percent'}
  ];
  var index = 0;
  var recovery = 0.02;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tweens = {};
  var house = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2V21H3z"/></svg>';

  function track(name, extra){
    var detail = {event:name};
    if (extra) Object.keys(extra).forEach(function(key){ detail[key] = extra[key]; });
    document.dispatchEvent(new CustomEvent('aipa-roi', {detail:detail}));
    if (window.dataLayer && window.dataLayer.push) window.dataLayer.push(detail);
  }
  function clamp(n, min, max){
    if (isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }
  function parseNum(raw){
    var n = parseFloat(String(raw || '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? NaN : n;
  }
  function money(n){
    var sign = n < 0 ? '-' : '';
    var v = Math.abs(n);
    if (v >= 1000000) {
      var m = v / 1000000;
      var ms = m >= 10 ? String(Math.round(m)) : String(Math.round(m * 10) / 10);
      if (ms.slice(-2) === '.0') ms = ms.slice(0, -2);
      return sign + '$' + ms + 'M';
    }
    if (v >= 100000) {
      var k = v / 1000;
      var ks = k >= 100 ? String(Math.round(k)) : String(Math.round(k * 10) / 10);
      if (ks.slice(-2) === '.0') ks = ks.slice(0, -2);
      return sign + '$' + ks + 'K';
    }
    return sign + '$' + Math.round(v).toLocaleString('en-US');
  }
  function grouped(n){
    return Math.round(n).toLocaleString('en-US');
  }
  function answers(){
    var map = {};
    questions.forEach(function(q){ map[q.key] = q.value; });
    return map;
  }
  function model(rate){
    var a = answers();
    var close = a.close / 100;
    var totalLeads = a.leads * 24;
    var deadLeads = totalLeads * (1 - close);
    var recoveredJobs = deadLeads * rate;
    var recoveredRevenue = recoveredJobs * a.job;
    var recoveredProfit = recoveredRevenue * (a.margin / 100);
    var booked = close > 0 ? recoveredJobs / close : 0;
    var fees = Math.max(0, Math.ceil(booked) - 1) * 1200;
    return {
      totalLeads: totalLeads,
      deadLeads: deadLeads,
      moneySpentDead: deadLeads * a.cost,
      moneySpentAll: totalLeads * a.cost,
      recoveredJobs: recoveredJobs,
      recoveredRevenue: recoveredRevenue,
      recoveredProfit: recoveredProfit,
      fees: fees,
      net: recoveredProfit - fees,
      closeSquares: Math.round(a.close)
    };
  }
  function show(name){
    ask.hidden = name !== 'ask';
    cost.hidden = name !== 'cost';
    worth.hidden = name !== 'worth';
  }
  function paintQuestion(){
    var q = questions[index];
    document.getElementById('roi-step').textContent = (index + 1) + ' of 5';
    document.getElementById('roi-meter').setAttribute('aria-valuenow', String(index + 1));
    document.getElementById('roi-meter-fill').style.width = ((index + 1) / 5 * 100) + '%';
    document.getElementById('roi-q').textContent = q.title;
    document.getElementById('roi-help').textContent = q.help;
    document.getElementById('roi-prefix').textContent = q.kind === 'money' ? '$' : '';
    document.getElementById('roi-suffix').textContent = q.kind === 'percent' ? '%' : '';
    var num = document.getElementById('roi-num');
    var range = document.getElementById('roi-range');
    num.value = q.kind === 'count' ? String(q.value) : grouped(q.value);
    range.min = String(q.min);
    range.max = String(q.max);
    range.step = String(q.step);
    range.value = String(q.value);
    range.setAttribute('aria-valuemin', String(q.min));
    range.setAttribute('aria-valuemax', String(q.max));
    range.setAttribute('aria-valuenow', String(q.value));
    range.setAttribute('aria-valuetext', q.kind === 'money' ? money(q.value) : (q.kind === 'percent' ? q.value + '%' : String(q.value)));
    document.getElementById('roi-back').hidden = index === 0;
  }
  function readQuestion(){
    var q = questions[index];
    var n = clamp(parseNum(document.getElementById('roi-num').value), q.min, q.max);
    q.value = n;
    return n;
  }
  function tween(el, to, ms, format){
    var token = (tweens[el.id] || 0) + 1;
    tweens[el.id] = token;
    if (reduce || ms <= 0) {
      el.textContent = format(to);
      return;
    }
    var start = performance.now();
    function frame(now){
      if (tweens[el.id] !== token) return;
      var t = Math.min(1, (now - start) / ms);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(to * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function paintCost(){
    var m = model(recovery);
    var spent = document.getElementById('roi-spent');
    tween(spent, m.moneySpentDead, 1500, money);
    window.setTimeout(function(){
      document.getElementById('roi-spent-live').textContent = money(m.moneySpentDead) + ' spent on leads that never bought, in the last 2 years.';
    }, reduce ? 0 : 1500);
    var deadShown = Math.round(m.deadLeads);
    var squares = '';
    var firstQuiet = Math.floor(m.closeSquares / 10);
    for (var i = 0; i < 100; i++) {
      var row = Math.floor(i / 10);
      var job = i < m.closeSquares;
      var delay = job || reduce ? '' : ' style="animation-delay:' + ((row - firstQuiet) * 0.12) + 's"';
      squares += '<i class="' + (job ? 'job' : 'quiet') + '"' + delay + '></i>';
    }
    document.getElementById('roi-waffle').innerHTML = squares;
    document.getElementById('roi-quiet-label').textContent = 'Went quiet, ' + deadShown.toLocaleString('en-US') + ' leads';
    document.getElementById('roi-waffle-sr').textContent = 'Waffle chart: ' + m.closeSquares + ' of 100 squares became jobs, ' + (100 - m.closeSquares) + ' went quiet. ' + deadShown.toLocaleString('en-US') + ' leads went quiet.';
    document.getElementById('roi-spent-line').textContent = 'Of the ' + money(m.moneySpentAll) + ' you spent on leads, ' + money(m.moneySpentDead) + ' went to people who never bought, and most of them still haven’t solved the problem they called you about.';
    track('roi_results_cost', {spent_dead: Math.round(m.moneySpentDead)});
  }
  function paintWorth(){
    var m = model(recovery);
    var pct = Math.round(recovery * 1000) / 10;
    var pctLabel = (pct % 1 === 0 ? String(pct) : pct.toFixed(1)) + '%';
    document.getElementById('roi-pct').textContent = pctLabel;
    var slider = document.getElementById('roi-recover');
    slider.value = String(pct);
    slider.setAttribute('aria-valuenow', String(pct));
    slider.setAttribute('aria-valuetext', pctLabel);
    var jobsShown = Math.round(m.recoveredJobs);
    tween(document.getElementById('roi-jobs'), jobsShown, 300, function(n){ return String(Math.round(n)); });
    tween(document.getElementById('roi-revenue'), m.recoveredRevenue, 300, money);
    tween(document.getElementById('roi-net'), m.net, 300, money);
    var icons = Math.min(30, Math.max(0, jobsShown));
    var extra = jobsShown - icons;
    var houses = '';
    for (var i = 0; i < icons; i++) houses += house;
    if (extra > 0) houses += '<span>+' + extra + '</span>';
    document.getElementById('roi-houses').innerHTML = houses;
    var loss = m.net < 0;
    document.getElementById('roi-net-card').classList.toggle('is-loss', loss);
    document.getElementById('roi-loss').hidden = !loss;
    var max = Math.max(m.recoveredRevenue, m.recoveredProfit, m.fees, Math.abs(m.net), 1);
    function row(cls, label, value){
      return '<li class="' + cls + '"><span>' + label + '</span><b>' + money(value) + '</b><i style="--h:' + (Math.abs(value) / max) + '"></i></li>';
    }
    document.getElementById('roi-fall').innerHTML =
      row('', 'Recovered revenue', m.recoveredRevenue) +
      row('', 'Gross profit', m.recoveredProfit) +
      row('fee', 'Our fees ($1,200 per booked estimate, first one free)', m.fees) +
      row('end' + (loss ? ' is-loss' : ''), 'Net found margin', m.net);
    document.getElementById('roi-fall-sr').textContent = 'Waterfall: recovered revenue ' + money(m.recoveredRevenue) + ', gross profit ' + money(m.recoveredProfit) + ', our fees ' + money(m.fees) + ', net found margin ' + money(m.net) + '.';
    paintLine();
  }
  function paintLine(){
    var pts = [];
    var min = 0;
    var max = 0;
    for (var p = 1; p <= 10.001; p += 0.5) {
      var rate = Math.round(p * 10) / 10;
      var y = model(rate / 100).net;
      pts.push({x: rate, y: y});
      if (y < min) min = y;
      if (y > max) max = y;
    }
    if (min === max) max = min + 1;
    var svg = document.getElementById('roi-line');
    var w = 320;
    var h = 150;
    var pad = 16;
    function X(x){ return pad + ((x - 1) / 9) * (w - pad * 2); }
    function Y(y){ return pad + (1 - (y - min) / (max - min)) * (h - pad * 2); }
    var d = pts.map(function(pt, i){ return (i ? 'L' : 'M') + X(pt.x).toFixed(1) + ' ' + Y(pt.y).toFixed(1); }).join(' ');
    var current = pts.filter(function(pt){ return Math.abs(pt.x - recovery * 100) < 0.01; })[0] || pts[0];
    var low = pts[0].y;
    svg.innerHTML = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2"></path><circle cx="' + X(current.x).toFixed(1) + '" cy="' + Y(current.y).toFixed(1) + '" r="5" fill="currentColor"></circle>';
    svg.style.color = 'var(--roi-teal)';
    document.getElementById('roi-line-sr').textContent = 'Line chart of net found margin from a 1% recovery rate to 10%. At ' + document.getElementById('roi-pct').textContent + ' the net found margin is ' + money(current.y) + '.';
    document.getElementById('roi-caption').hidden = low <= 0;
  }
  document.getElementById('roi-back').addEventListener('click', function(){
    if (index === 0) return;
    index -= 1;
    paintQuestion();
  });
  document.getElementById('roi-next').addEventListener('click', function(){
    var value = readQuestion();
    track('roi_question', {step: index + 1, key: questions[index].key, value: value});
    if (index === questions.length - 1) {
      show('cost');
      paintCost();
    } else {
      index += 1;
      paintQuestion();
      document.getElementById('roi-num').focus();
    }
  });
  document.getElementById('roi-num').addEventListener('input', function(){
    var q = questions[index];
    var n = parseNum(this.value);
    if (isNaN(n)) return;
    var range = document.getElementById('roi-range');
    range.value = String(clamp(n, q.min, q.max));
  });
  document.getElementById('roi-num').addEventListener('blur', function(){
    readQuestion();
    paintQuestion();
  });
  document.getElementById('roi-range').addEventListener('input', function(){
    questions[index].value = Number(this.value);
    paintQuestion();
  });
  document.getElementById('roi-cost-back').addEventListener('click', function(){
    index = questions.length - 1;
    show('ask');
    paintQuestion();
  });
  document.getElementById('roi-worth-go').addEventListener('click', function(){
    show('worth');
    paintWorth();
    track('roi_results_worth', {recovery: recovery});
  });
  document.getElementById('roi-worth-back').addEventListener('click', function(){
    show('cost');
    paintCost();
  });
  document.getElementById('roi-recover').addEventListener('input', function(){
    recovery = Number(this.value) / 100;
    paintWorth();
  });
  document.getElementById('roi-recover').addEventListener('change', function(){
    track('roi_slider', {recovery: recovery});
  });
  document.getElementById('roi-cta').addEventListener('click', function(event){
    var m = model(recovery);
    var a = answers();
    var params = new URLSearchParams(location.search);
    params.set('leads', String(a.leads));
    params.set('lead_cost', String(a.cost));
    params.set('close_rate', String(a.close));
    params.set('job_value', String(a.job));
    params.set('margin', String(a.margin));
    params.set('recovery', String(Math.round(recovery * 1000) / 10));
    params.set('spent_dead', String(Math.round(m.moneySpentDead)));
    params.set('net_margin', String(Math.round(m.net)));
    history.replaceState(null, '', location.pathname + '?' + params.toString() + '#screening');
    track('roi_cta', {recovery: recovery, net_margin: Math.round(m.net)});
    var target = document.getElementById('screening');
    if (target) {
      event.preventDefault();
      target.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
    }
  });
  show('ask');
  paintQuestion();
  track('roi_start');
})();
