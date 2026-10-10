(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var dash = document.getElementById('dash');
  var signout = document.getElementById('signout');
  var contractors = [];
  var stages = [];
  var places = {};
  var families = [];
  var territories = [];
  var ageFilter = 'all';
  var stageDraft = [];
  var selectedId = 0;
  var openedFromLink = false;
  var focusFromLink = false;

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function rows(value){
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }
  function showLogin(on){
    loginView.hidden = !on;
    dash.hidden = on;
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
  function zonedToday(){
    try {
      var fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit'
      });
      return fmt.format(new Date());
    } catch (err) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function daysHere(entered){
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(entered || ''));
    var today = /^(\d{4})-(\d{2})-(\d{2})/.exec(zonedToday());
    if (!match || !today) return 0;
    var start = Date.UTC(+match[1], +match[2] - 1, +match[3]);
    var end = Date.UTC(+today[1], +today[2] - 1, +today[3]);
    return Math.max(0, Math.round((end - start) / 86400000));
  }
  function hereLine(days){
    if (days <= 0) return 'Today';
    if (days === 1) return '1 day here';
    return days + ' days here';
  }
  function familyLine(count){
    if (!count) return '';
    return count === 1 ? '1 family' : count + ' families';
  }
  function stageFor(contractor){
    var id = places[contractor.id] && places[contractor.id].stage_id;
    if (stages.some(function(stage){ return stage.id === id; })) return id;
    return stages.length ? stages[0].id : 0;
  }
  function stageName(id){
    var stage = stages.filter(function(item){ return item.id === id; })[0];
    return stage ? stage.name : '';
  }
  function isLost(contractor){
    return stageName(stageFor(contractor)).toLowerCase() === 'deal lost';
  }
  function familiesOf(id){
    var want = Number(id);
    return families.filter(function(family){ return Number(family.contractor_id) === want; });
  }
  function callbackOffset(row){
    if (!wantsCallback(row)) return null;
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(row.callback_requested_at || ''));
    var today = /^(\d{4})-(\d{2})-(\d{2})/.exec(zonedToday());
    if (!match || !today) return null;
    var target = Date.UTC(+match[1], +match[2] - 1, +match[3]);
    var now = Date.UTC(+today[1], +today[2] - 1, +today[3]);
    return Math.round((target - now) / 86400000);
  }
  function offsetLabel(days){
    return days > 0 ? '+' + days : String(days);
  }
  function decorate(row){
    var place = places[row.id] || {};
    var days = daysHere(place.entered_at);
    return {
      id: row.id, name: row.name, days: days, stageId: stageFor(row), lost: isLost(row),
      callback: wantsCallback(row), offset: callbackOffset(row)
    };
  }
  function visible(){
    var list = contractors.map(decorate);
    if (ageFilter !== 'all') list = list.filter(function(row){ return row.days >= Number(ageFilter); });
    list.sort(function(a, b){ return b.days - a.days || a.name.localeCompare(b.name); });
    return list;
  }
  function callbackChip(row){
    if (!row.callback) return '';
    var number = row.offset == null ? '' : '<b class="callback-offset' + (row.offset < 0 ? ' late' : '') + '">' + esc(offsetLabel(row.offset)) + '</b>';
    var label = row.offset == null ? 'Call back' : 'Call back ' + offsetLabel(row.offset);
    return '<span class="callback-chip" role="img" aria-label="' + esc(label) + '">' +
      '<span class="callback-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v2.2a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 1h2.2a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.1 8.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2.1z"/></svg></span>' +
      number + '</span>';
  }
  function card(row){
    var count = familyLine(familiesOf(row.id).length);
    return '<li><button type="button" draggable="true" class="family' + (row.lost ? ' lost' : '') + '" data-id="' + row.id + '" aria-current="' + (row.id === selectedId) + '">' +
      '<span class="who"><span class="name-line"><strong>' + esc(row.name) + '</strong>' + callbackChip(row) + '</span>' +
      '<span class="since">' + esc(hereLine(row.days)) + (count ? ' · ' + esc(count) : '') + '</span></span></button></li>';
  }
  function pipelineHtml(list){
    if (!stages.length) return '<p class="empty-queue">No stages yet. Use Edit stages to add the columns.</p>';
    return stages.map(function(stage){
      var cards = list.filter(function(row){ return row.stageId === stage.id; });
      var body = cards.length ? '<ol class="family-list">' + cards.map(card).join('') + '</ol>' : '<p class="column-empty">No one here.</p>';
      return '<section class="stage-col" data-stage="' + stage.id + '"><h2><span>' + esc(stage.name) + '</span><b>' + cards.length + '</b></h2>' + body + '</section>';
    }).join('');
  }
  function selected(){
    return contractors.filter(function(row){ return row.id === selectedId; })[0] || null;
  }
  function zipsOf(id){
    return territories.filter(function(row){ return Number(row.contractor_id) === Number(id); })
      .map(function(row){ return String(row.zip || ''); })
      .filter(Boolean)
      .sort();
  }
  function contactLine(row){
    var bits = [];
    if (row.contact_name) bits.push(esc(row.contact_name));
    if (row.phone) {
      var tel = String(row.phone).replace(/[^\d+]/g, '');
      bits.push('<a href="tel:' + esc(tel) + '">' + esc(row.phone) + '</a>');
    }
    if (row.email) bits.push('<a href="mailto:' + esc(row.email) + '">' + esc(row.email) + '</a>');
    return bits.length ? '<p class="contractor-meta">' + bits.join(' · ') + '</p>' : '';
  }
  function utmLine(row){
    var bits = [
      ['Source', row.utm_source],
      ['Medium', row.utm_medium],
      ['Campaign', row.utm_campaign],
      ['Term', row.utm_term],
      ['Content', row.utm_content]
    ].filter(function(pair){ return pair[1]; });
    if (!bits.length) return '';
    return '<p class="contractor-meta">' + bits.map(function(pair){
      return esc(pair[0]) + ' ' + esc(pair[1]);
    }).join(' · ') + '</p>';
  }
  function detail(row){
    var box = document.getElementById('detail');
    if (!row) {
      box.innerHTML = '<p class="waiting">' + (contractors.length ? 'Choose a contractor.' : 'No contractors yet.') + '</p>';
      return;
    }
    var view = decorate(row);
    var people = familiesOf(row.id);
    var stage = '<label class="stage-pick">Stage <select id="stage-select">' + stages.map(function(item){
      return '<option value="' + item.id + '"' + (item.id === view.stageId ? ' selected' : '') + '>' + esc(item.name) + '</option>';
    }).join('') + '</select></label>';
    var list = people.length
      ? '<ul class="contractor-families">' + people.map(function(person){ return '<li>' + esc(person.name) + '</li>'; }).join('') + '</ul>'
      : '<p class="contractor-meta">No families yet.</p>';
    var on = wantsCallback(row);
    var when = callbackDate(row.callback_requested_at);
    box.innerHTML = '<h2>' + esc(row.name) + '</h2>' +
      contactLine(row) +
      utmLine(row) +
      '<p class="contractor-meta">Id ' + row.id + ' · ' + esc(hereLine(view.days)) + '</p>' +
      stage +
      '<div class="contractor-callback">' +
      '<span id="callback-label">Wants a call back</span>' +
      '<div class="send-channels" role="group" aria-labelledby="callback-label">' +
      '<button type="button" id="callback-no" aria-pressed="' + (on ? 'false' : 'true') + '">No</button>' +
      '<button type="button" id="callback-yes" aria-pressed="' + (on ? 'true' : 'false') + '">Yes</button>' +
      '</div>' +
      '<label for="callback-date">Date</label>' +
      '<input id="callback-date" type="date"' + (on ? '' : ' disabled') + (when ? ' value="' + esc(when) + '"' : '') + '>' +
      '</div>' +
      '<div class="contractor-territory">' +
      '<label for="territory">ZIP codes</label>' +
      '<textarea id="territory" rows="5" spellcheck="false">' + esc(zipsOf(row.id).join('\n')) + '</textarea>' +
      '<p class="contractor-meta">One ZIP per line. A house in that ZIP is assigned here.</p>' +
      '<button type="button" id="territory-save">Save ZIP codes</button>' +
      '<p class="status-line" id="territory-status" role="status"></p>' +
      '</div>' +
      list;
  }
  function wantsCallback(row){
    return !!(row && (row.callback_requested === true || row.callback_requested === 1));
  }
  function callbackDate(value){
    var match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ''));
    return match ? match[1] : '';
  }
  function paintCallback(on){
    var yes = document.getElementById('callback-yes');
    var no = document.getElementById('callback-no');
    var box = document.getElementById('callback-date');
    if (!yes || !no || !box) return;
    yes.setAttribute('aria-pressed', on ? 'true' : 'false');
    no.setAttribute('aria-pressed', on ? 'false' : 'true');
    box.disabled = !on;
    if (!on) box.value = '';
  }
  function saveCallback(on){
    var row = selected();
    var box = document.getElementById('callback-date');
    if (!row || !box) return;
    var date = on ? box.value : '';
    var note = document.getElementById('dash-status');
    if (note) note.textContent = '';
    api('/office/contractor-callback', {method:'POST', body:{
      contractor_id: row.id,
      requested: !!on,
      callback_at: date
    }}).then(function(){
      row.callback_requested = !!on;
      row.callback_requested_at = date;
      render();
    }).catch(function(err){
      if (note) note.textContent = err.message;
    });
  }
  function counts(list){
    var all = contractors.map(decorate);
    document.getElementById('count-all').textContent = all.length;
    document.getElementById('count-7').textContent = all.filter(function(row){ return row.days >= 7; }).length;
    document.getElementById('count-14').textContent = all.filter(function(row){ return row.days >= 14; }).length;
    document.getElementById('count-30').textContent = all.filter(function(row){ return row.days >= 30; }).length;
  }
  function render(){
    var list = visible();
    if (selectedId && !contractors.some(function(row){ return row.id === selectedId; })) selectedId = 0;
    counts(list);
    detail(selected());
    document.getElementById('pipeline').innerHTML = pipelineHtml(list);
    bindPipeline();
  }
  function bindPipeline(){
    document.querySelectorAll('#pipeline .family').forEach(function(button){
      button.addEventListener('dragstart', function(event){
        button.dataset.dragged = 'yes';
        event.dataTransfer.setData('text/plain', button.dataset.id);
        event.dataTransfer.effectAllowed = 'move';
      });
      button.addEventListener('dragend', function(){
        document.querySelectorAll('.stage-col').forEach(function(col){ col.classList.remove('drop'); });
      });
      button.addEventListener('click', function(){
        if (button.dataset.dragged === 'yes') { button.dataset.dragged = ''; return; }
        selectedId = Number(button.dataset.id);
        render();
      });
    });
    document.querySelectorAll('#pipeline .stage-col').forEach(function(col){
      col.addEventListener('dragover', function(event){
        event.preventDefault();
        col.classList.add('drop');
      });
      col.addEventListener('dragleave', function(event){
        if (!col.contains(event.relatedTarget)) col.classList.remove('drop');
      });
      col.addEventListener('drop', function(event){
        event.preventDefault();
        col.classList.remove('drop');
        moveContractor(Number(event.dataTransfer.getData('text/plain')), Number(col.dataset.stage));
      });
    });
  }
  function moveContractor(id, stageId){
    if (!id || !stageId) return;
    var row = contractors.filter(function(item){ return item.id === id; })[0];
    if (row && stageFor(row) === stageId) return;
    var note = document.getElementById('dash-status');
    note.textContent = 'Moving…';
    api('/office/contractor-pipeline-move', {method:'POST', body:{contractor_id: id, stage_id: stageId}})
      .then(function(){ note.textContent = ''; return load(); })
      .catch(function(err){ note.textContent = err.message; });
  }
  function saveTerritory(){
    var row = selected();
    var box = document.getElementById('territory');
    var note = document.getElementById('territory-status');
    if (!row || !box || !note) return;
    note.textContent = 'Saving ZIP codes…';
    api('/office/contractor-zips', {method:'POST', body:{contractor_id: row.id, zips: box.value}})
      .then(function(){ return load(); })
      .then(function(){
        var next = document.getElementById('territory-status');
        if (next) next.textContent = 'ZIP codes saved.';
      })
      .catch(function(err){ note.textContent = err.message; });
  }
  function callbackWhen(value){
    var parsed = new Date(String(value || '').replace(' ', 'T'));
    if (isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
  }
  function renderCallbacks(list){
    var box = document.getElementById('callback-list');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<li>No callback requests yet.</li>';
      return;
    }
    box.innerHTML = list.map(function(row){
      var phone = String(row.phone || '');
      var tel = phone.replace(/[^\d+]/g, '');
      var when = callbackWhen(row.created_at);
      return '<li><b>' + esc(row.name) + '</b> · ' + esc(row.company) +
        '<span class="meta"><a href="tel:' + esc(tel) + '">' + esc(phone) + '</a> · ' + esc(row.email) +
        (when ? ' · ' + esc(when) : '') + '</span></li>';
    }).join('');
  }
  function load(){
    return Promise.all([
      api('/office/contractor-pipeline'),
      api('/office/households').catch(function(){ return {profiles:[]}; }),
      api('/office/signups').catch(function(){ return []; }),
      api('/office/contractor-zips').catch(function(){ return {zips:[]}; }),
      api('/office/contractor-callbacks').catch(function(){ return []; })
    ]).then(function(result){
      var data = result[0] || {};
      var household = result[1] || {};
      stages = rows(data.stages).slice().sort(function(a, b){ return (a.sort || 0) - (b.sort || 0) || a.id - b.id; });
      places = {};
      rows(data.places).forEach(function(place){
        places[place.contractor_id] = {stage_id: place.stage_id, entered_at: place.entered_at || ''};
      });
      contractors = rows(data.contractors);
      if (!openedFromLink) {
        openedFromLink = true;
        var wanted = Number(new URLSearchParams(location.search).get('id')) || 0;
        if (wanted) {
          selectedId = wanted;
          ageFilter = 'all';
          focusFromLink = true;
        }
      }
      var signupName = {};
      rows(result[2]).forEach(function(row){ signupName[row.id] = String(row.name || '').trim(); });
      territories = rows((result[3] || {}).zips);
      renderCallbacks(rows(result[4]));
      document.querySelectorAll('.pulse button').forEach(function(button){
        button.setAttribute('aria-pressed', button.dataset.age === ageFilter ? 'true' : 'false');
      });
      families = rows(household.profiles).filter(function(profile){
        return Number(profile.contractor_id) > 0;
      }).map(function(profile){
        var profileName = [profile.first_name, profile.last_name].filter(function(part){ return part; }).join(' ');
        return {
          contractor_id: Number(profile.contractor_id) || 0,
          name: profileName || signupName[profile.registration_id] || 'Unnamed family'
        };
      });
      render();
      if (focusFromLink) {
        focusFromLink = false;
        if (selected()) {
          var panel = document.getElementById('detail');
          if (panel) panel.scrollIntoView({block:'start'});
          var card = document.querySelector('#pipeline .family[aria-current="true"]');
          var column = card && card.closest('.stage-col');
          if (column) column.scrollIntoView({block:'nearest', inline:'center'});
        }
      }
    }).catch(function(err){
      document.getElementById('dash-status').textContent = err.message;
    });
  }
  function readStageDraft(){
    document.querySelectorAll('#stage-list li').forEach(function(item){
      var index = Number(item.dataset.index);
      var input = item.querySelector('input');
      if (stageDraft[index] && input) stageDraft[index].name = input.value;
    });
  }
  function drawStageDraft(){
    var list = document.getElementById('stage-list');
    list.innerHTML = stageDraft.map(function(stage, index){
      return '<li data-index="' + index + '"><input value="' + esc(stage.name) + '" aria-label="Stage name" maxlength="60">' +
        '<button type="button" data-stage-move="up"' + (index === 0 ? ' disabled' : '') + '>Up</button>' +
        '<button type="button" data-stage-move="down"' + (index === stageDraft.length - 1 ? ' disabled' : '') + '>Down</button>' +
        '<button type="button" data-stage-remove>Remove</button></li>';
    }).join('');
  }

  document.getElementById('stages-open').addEventListener('click', function(){
    stageDraft = stages.map(function(stage){ return {id: stage.id, name: stage.name}; });
    document.getElementById('stage-status').textContent = '';
    document.getElementById('stage-editor').hidden = false;
    drawStageDraft();
  });
  document.getElementById('stage-cancel').addEventListener('click', function(){
    document.getElementById('stage-editor').hidden = true;
  });
  document.getElementById('stage-add').addEventListener('click', function(){
    readStageDraft();
    stageDraft.push({id: 0, name: ''});
    drawStageDraft();
    var inputs = document.querySelectorAll('#stage-list input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });
  document.getElementById('stage-list').addEventListener('click', function(event){
    var button = event.target.closest('button');
    if (!button) return;
    var item = button.closest('li');
    if (!item) return;
    readStageDraft();
    var index = Number(item.dataset.index);
    if (button.dataset.stageMove === 'up' && index > 0) {
      var up = stageDraft[index - 1];
      stageDraft[index - 1] = stageDraft[index];
      stageDraft[index] = up;
    } else if (button.dataset.stageMove === 'down' && index < stageDraft.length - 1) {
      var down = stageDraft[index + 1];
      stageDraft[index + 1] = stageDraft[index];
      stageDraft[index] = down;
    } else if (button.hasAttribute('data-stage-remove')) {
      stageDraft.splice(index, 1);
    } else return;
    drawStageDraft();
  });
  document.getElementById('stage-save').addEventListener('click', function(){
    readStageDraft();
    var status = document.getElementById('stage-status');
    status.textContent = 'Saving stages…';
    api('/office/contractor-pipeline', {method:'POST', body:{stages: JSON.stringify(stageDraft.map(function(stage){
      return {id: stage.id || 0, name: stage.name};
    }))}}).then(function(){
      document.getElementById('stage-editor').hidden = true;
      status.textContent = '';
      load();
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('contractor-open').addEventListener('click', function(){
    document.getElementById('contractor-status').textContent = '';
    document.getElementById('contractor-editor').hidden = false;
    var input = document.querySelector('#contractor-form [name="name"]');
    if (input) input.focus();
  });
  document.getElementById('contractor-cancel').addEventListener('click', function(){
    document.getElementById('contractor-editor').hidden = true;
  });
  document.getElementById('contractor-form').addEventListener('submit', function(event){
    event.preventDefault();
    var form = event.target;
    var status = document.getElementById('contractor-status');
    var first = stages[0];
    status.textContent = 'Saving…';
    api('/office/contractor', {method:'POST', body:{name: form.name.value}}).then(function(created){
      if (!first || !created || !created.id) return load();
      return api('/office/contractor-pipeline-move', {method:'POST', body:{
        contractor_id: created.id,
        stage_id: first.id
      }});
    }).then(function(){
      form.reset();
      document.getElementById('contractor-editor').hidden = true;
      status.textContent = '';
      return load();
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('detail').addEventListener('click', function(event){
    var button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'territory-save') {
      saveTerritory();
      return;
    }
    if (button.id !== 'callback-yes' && button.id !== 'callback-no') return;
    var on = button.id === 'callback-yes';
    paintCallback(on);
    saveCallback(on);
  });
  document.getElementById('detail').addEventListener('change', function(event){
    if (!event.target) return;
    if (event.target.id === 'callback-date') {
      saveCallback(true);
      return;
    }
    if (event.target.id !== 'stage-select') return;
    var row = selected();
    if (!row) return;
    moveContractor(row.id, Number(event.target.value));
  });
  document.querySelectorAll('[data-age]').forEach(function(button){
    button.addEventListener('click', function(){
      ageFilter = button.dataset.age;
      document.querySelectorAll('[data-age]').forEach(function(other){
        other.setAttribute('aria-pressed', String(other === button));
      });
      render();
    });
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
        load();
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(){
    sessionStorage.removeItem(KEY);
    showLogin(true);
  });
  if (token()) { showLogin(false); load(); }
  else showLogin(true);
})();
