(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var price = null;
  var prices = [];
  var contracts = [];
  var contractors = [];
  var pricesComplete = false;

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function rows(value){
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }
  function showLogin(on){
    loginView.hidden = !on;
    desk.hidden = on;
    signout.hidden = on;
  }
  function api(path, options){
    options = options || {};
    var headers = {'Accept':'application/json'};
    if (options.body) headers['Content-Type'] = 'application/json';
    if (options.auth !== false) headers.Authorization = 'Bearer ' + token();
    return fetch(base + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data){
        if (r.status === 401) { sessionStorage.removeItem(KEY); showLogin(true); }
        if (!r.ok) throw new Error(data.message || data.error || 'Something went wrong.');
        return data;
      });
    });
  }
  function dollars(cents){
    var n = Number(cents) || 0;
    var abs = Math.abs(n);
    var whole = Math.floor(abs / 100);
    var c = abs % 100;
    return (n < 0 ? '-' : '') + whole + (c ? '.' + (c < 10 ? '0' : '') + c : '');
  }
  function money(cents){
    var n = Number(cents) || 0;
    var abs = Math.abs(n);
    var whole = Math.floor(abs / 100);
    var c = abs % 100;
    var s = String(whole);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ',';
      out += s.charAt(i);
    }
    return (n < 0 ? '-' : '') + '$' + out + '.' + (c < 10 ? '0' : '') + c;
  }
  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function sameMoney(row, set){
    return Number(row.first_lead_cents) === Number(set.first_lead_cents)
      && Number(row.later_lead_cents) === Number(set.later_lead_cents)
      && Number(row.percent) === Number(set.percent)
      && Number(row.threshold_cents) === Number(set.threshold_cents);
  }
  function contractorsOn(set){
    return contracts.filter(function(row){
      return Number(row.price_version_id) === Number(set.id) && sameMoney(row, set);
    }).length;
  }
  function contractorWord(n){
    return n === 1 ? '1 contractor' : n + ' contractors';
  }
  function setLine(set){
    return 'First lead ' + money(set.first_lead_cents) + ' · Later leads ' + money(set.later_lead_cents) + ' · ' + set.percent + '% above ' + money(set.threshold_cents);
  }
  function contractPeople(){
    return contracts.map(function(row){
      var person = contractors.filter(function(item){ return Number(item.id) === Number(row.contractor_id); })[0];
      return {
        contractor_id: Number(row.contractor_id),
        name: person && person.name ? person.name : 'Contractor ' + row.contractor_id,
        price_version_id: Number(row.price_version_id) || 0,
        contract: row
      };
    }).sort(function(a, b){ return a.name.localeCompare(b.name); });
  }
  function destinations(person){
    return prices.filter(function(set){
      var current = Number(set.id) === Number(person.price_version_id);
      return !current || !sameMoney(person.contract, set);
    });
  }
  function setsSummary(){
    if (!prices.length) return 'Price sets · 0';
    var total = prices.length === 1 ? '1 price set' : prices.length + ' price sets';
    var counts = prices.map(function(set){ return contractorWord(contractorsOn(set)); }).join(', ');
    var changed = contracts.filter(function(row){
      var set = prices.filter(function(item){ return Number(item.id) === Number(row.price_version_id); })[0];
      return !set || !sameMoney(row, set);
    }).length;
    var extra = pricesComplete && changed ? ' · ' + contractorWord(changed) + ' changed' : '';
    return total + ' · ' + counts + extra;
  }
  function paintMove(){
    var form = document.getElementById('move-form');
    var hint = document.getElementById('move-hint');
    var contractor = document.getElementById('move-contractor');
    var setBox = document.getElementById('move-set');
    var button = form ? form.querySelector('button') : null;
    if (!form || !contractor || !setBox) return;
    var people = contractPeople();
    if (!prices.length || !people.length) {
      form.hidden = true;
      return;
    }
    form.hidden = false;
    var previous = contractor.value;
    contractor.innerHTML = people.map(function(person){
      return '<option value="' + person.contractor_id + '">' + esc(person.name) + '</option>';
    }).join('');
    if (people.some(function(person){ return String(person.contractor_id) === previous; })) contractor.value = previous;
    paintDestinations();
    if (button) button.disabled = !setBox.options.length;
    if (hint) {
      hint.textContent = setBox.options.length
        ? 'Leads and completed jobs from here on use the new set. Charges that are already open stay at the old amount.'
        : 'There is no other price set to move them to.';
    }
  }
  function paintDestinations(){
    var contractor = document.getElementById('move-contractor');
    var setBox = document.getElementById('move-set');
    var button = document.querySelector('#move-form button');
    var hint = document.getElementById('move-hint');
    if (!contractor || !setBox) return;
    var person = contractPeople().filter(function(item){ return item.contractor_id === Number(contractor.value); })[0];
    var choices = person ? destinations(person) : [];
    var previous = setBox.value;
    setBox.innerHTML = choices.map(function(set){
      var restore = person && Number(set.id) === Number(person.price_version_id) ? ' · Their starting set' : '';
      return '<option value="' + set.id + '">' + esc(setLine(set) + restore) + '</option>';
    }).join('');
    if (choices.some(function(set){ return String(set.id) === previous; })) setBox.value = previous;
    setBox.disabled = !choices.length;
    if (button) button.disabled = !choices.length;
    if (hint && person) {
      hint.textContent = choices.length
        ? 'Leads and completed jobs from here on use the new set. Charges that are already open stay at the old amount.'
        : 'There is no other price set to move them to.';
    }
  }
  function paintSets(){
    var title = document.getElementById('price-sets-title');
    var list = document.getElementById('price-sets');
    if (title) title.textContent = setsSummary();
    if (!list) return;
    if (!prices.length) {
      list.innerHTML = '<li>No price sets yet.</li>';
      paintMove();
      return;
    }
    var currentId = price ? Number(price.id) : 0;
    var html = prices.map(function(set){
      var note = contractorWord(contractorsOn(set));
      if (Number(set.id) === currentId) note += ' · New contracts use this';
      return '<li>First lead ' + money(set.first_lead_cents) + ' · Later leads ' + money(set.later_lead_cents) + ' · ' + esc(set.percent) + '% above ' + money(set.threshold_cents) +
        '<span class="meta">' + esc(note) + '</span></li>';
    }).join('');
    var changed = contracts.filter(function(row){
      var set = prices.filter(function(item){ return Number(item.id) === Number(row.price_version_id); })[0];
      return !set || !sameMoney(row, set);
    }).length;
    if (pricesComplete && changed) html += '<li><span class="meta">' + esc(contractorWord(changed)) + ' with prices changed from their set</span></li>';
    list.innerHTML = html;
    paintMove();
  }
  function paint(){
    var form = document.getElementById('price-form');
    var current = document.getElementById('price-current');
    if (!form.contains(document.activeElement)) {
      form.first_lead.value = price ? dollars(price.first_lead_cents) : '';
      form.later_lead.value = price ? dollars(price.later_lead_cents) : '';
      form.percent.value = price ? String(price.percent || '') : '';
      form.threshold.value = price ? dollars(price.threshold_cents) : '';
    }
    current.hidden = !price;
    current.textContent = price
      ? 'A new contract today uses ' + money(price.first_lead_cents) + ' for the first lead, ' + money(price.later_lead_cents) + ' for each later lead, and ' + price.percent + '% of the job amount above ' + money(price.threshold_cents) + '.'
      : '';
    paintSets();
  }
  function load(){
    var status = document.getElementById('price-status');
    return Promise.all([
      api('/office/billing'),
      api('/office/contractor-pipeline').catch(function(){ return {}; })
    ]).then(function(result){
      var data = result[0] || {};
      price = data && data.price ? data.price : null;
      pricesComplete = Array.isArray(data && data.prices);
      prices = pricesComplete ? data.prices : [];
      if (!prices.length && price) prices = [price];
      contracts = rows(data && data.contracts);
      contractors = rows((result[1] || {}).contractors);
      paint();
      if (status.textContent === 'Loading…') status.textContent = '';
    }).catch(function(err){
      status.textContent = err.message;
    });
  }

  document.getElementById('move-contractor').addEventListener('change', paintDestinations);
  document.getElementById('move-form').addEventListener('submit', function(event){
    event.preventDefault();
    var form = event.target;
    var status = document.getElementById('move-status');
    var person = contractPeople().filter(function(item){ return item.contractor_id === Number(form.contractor.value); })[0];
    var set = prices.filter(function(item){ return Number(item.id) === Number(form.set.value); })[0];
    if (!person || !set) return;
    var warn = 'Moving ' + person.name + ' onto this price set changes only their contract. Leads and completed jobs from here on use these prices. Charges that are already open stay at the old amount.';
    if (!window.confirm(warn)) return;
    status.textContent = 'Moving…';
    api('/office/contract-set', {method:'POST', body:{
      contractor_id: person.contractor_id,
      price_version_id: Number(set.id)
    }}).then(function(){
      document.getElementById('price-sets-panel').open = true;
      return load();
    }).then(function(){
      var next = document.getElementById('move-status');
      if (next) next.textContent = person.name + ' is on the selected price set.';
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('price-form').addEventListener('submit', function(event){
    event.preventDefault();
    var form = event.target;
    var status = document.getElementById('price-status');
    status.textContent = 'Saving…';
    api('/office/price', {method:'POST', body:{
      first_lead: form.first_lead.value,
      later_lead: form.later_lead.value,
      percent: form.percent.value,
      threshold: form.threshold.value
    }}).then(function(){
      status.textContent = 'Saved. New contracts use these prices.';
      return load();
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('login-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('login-status');
    status.textContent = 'Signing in…';
    api('/auth/login', {method:'POST', auth:false, body:{password:document.getElementById('password').value}})
      .then(function(data){
        sessionStorage.setItem(KEY, data.authToken);
        document.getElementById('password').value = '';
        status.textContent = '';
        showLogin(false);
        document.getElementById('price-status').textContent = 'Loading…';
        load();
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(event){
    event.preventDefault();
    sessionStorage.removeItem(KEY);
    showLogin(true);
  });
  if (token()) {
    showLogin(false);
    document.getElementById('price-status').textContent = 'Loading…';
    load();
  } else showLogin(true);
})();
