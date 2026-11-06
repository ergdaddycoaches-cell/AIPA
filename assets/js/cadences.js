(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var sequences = [];
  var steps = [];
  var messages = [];
  var currentKey = '';
  var openStep = 0;
  var PATH = [
    {key:'reactivation', outs:[
      {event:'Registered', to:'attendance'},
      {event:'Finished without registering', to:'nurture_new'}
    ]},
    {key:'attendance', outs:[
      {event:'Showed up', to:'attendee'},
      {event:'Missed it', to:'no_show'}
    ]},
    {key:'no_show', outs:[
      {event:'Registered again', to:'attendance'},
      {event:'Finished without registering', to:'nurture_qa'}
    ]},
    {key:'attendee', outs:[
      {event:'Booked an Ask Anything 1:1', to:'one_to_one'},
      {event:'Finished without booking', to:'nurture_qa'}
    ]},
    {key:'one_to_one', outs:[
      {event:'Finished the 1:1, no visit booked', to:'visit'},
      {event:'Missed it', to:'one_to_one_miss'}
    ]},
    {key:'one_to_one_miss', outs:[
      {event:'Rebooked', to:'one_to_one'},
      {event:'Finished without rebooking', to:'nurture_qa'},
      {event:'Finished without rebooking, and they have had a 1:1', to:'nurture_visit'}
    ]},
    {key:'visit', outs:[
      {event:'Booked the visit', stop:'Hand the lead to the contractor'},
      {event:'Finished without a visit', to:'nurture_visit'}
    ]}
  ];
  var PATH_STORE = 'aipa_cadence_path_v1';
  var ORIGINAL_PATH = JSON.parse(JSON.stringify(PATH));
  try {
    var storedPath = JSON.parse(localStorage.getItem(PATH_STORE) || 'null');
    if (Array.isArray(storedPath) && storedPath.length) PATH = storedPath;
  } catch (err) {}
  var flowKey = 'reactivation';
  var SPOT = {
    reactivation: [0, 1],
    attendance: [1, 0],
    nurture_new: [1, 2],
    no_show: [2, 0],
    attendee: [2, 2],
    nurture_qa: [3, 3],
    one_to_one: [3, 1],
    one_to_one_miss: [4, 0],
    visit: [4, 2],
    nurture_visit: [5, 3],
    seasonal: [5, 0]
  };

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
        if (r.status === 401) { window.AIPA_OFFICE.clear(); showLogin(true); }
        if (!r.ok) throw new Error(data.message || data.error || 'Something went wrong.');
        return data;
      });
    });
  }
  function channelName(channel){
    if (channel === 'sms') return 'Text';
    if (channel === 'call') return 'Call';
    return 'Email';
  }
  function askName(ask){
    if (ask === 'hard') return 'Hard ask';
    if (ask === 'soft') return 'Soft ask';
    if (ask === 'none') return 'No ask';
    return 'Reminder';
  }
  function messageByKey(key){
    return messages.filter(function(row){ return row.key === key; })[0] || null;
  }
  function optionsFor(channel, selected){
    var allowed = {};
    steps.forEach(function(step){
      if (step.sequence_key !== currentKey) return;
      if (step.message_key) allowed[step.message_key] = true;
      if (step.companion_key) allowed[step.companion_key] = true;
    });
    if (selected) allowed[selected] = true;
    return '<option value="">Choose a message</option>' + messages.filter(function(row){
      return row.channel === channel && allowed[row.key];
    }).map(function(row){
      return '<option value="' + esc(row.key) + '"' + (row.key === selected ? ' selected' : '') + '>' + esc(row.name) + '</option>';
    }).join('');
  }
  function selectedSequence(){
    return sequences.filter(function(row){ return row.key === currentKey; })[0] || null;
  }
  function sequenceName(key){
    var row = sequences.filter(function(item){ return item.key === key; })[0];
    return row ? row.name : key;
  }
  function savePath(){
    localStorage.setItem(PATH_STORE, JSON.stringify(PATH));
  }
  function pathRow(key, create){
    var row = PATH.filter(function(item){ return item.key === key; })[0];
    if (!row && create) {
      row = {key: key, outs: []};
      PATH.push(row);
    }
    return row || {key: key, outs: []};
  }
  function delayCaption(key){
    var list = steps.filter(function(step){ return step.sequence_key === key; })
      .slice().sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
    if (!list.length) return '';
    var first = list[0].when_label || '';
    var last = list[list.length - 1].when_label || '';
    if (!first) return '';
    return list.length === 1 || first === last ? first : first + ' → ' + last;
  }
  function chartModel(){
    var nodes = [];
    var seen = {};
    function addNode(id, label, key){
      if (seen[id]) return;
      seen[id] = true;
      nodes.push({id: id, label: label, key: key || ''});
    }
    PATH.forEach(function(row){
      addNode(row.key, sequenceName(row.key), row.key);
      row.outs.forEach(function(out){
        if (out.to) addNode(out.to, sequenceName(out.to), out.to);
        else if (out.stop) addNode('stop:' + out.stop, out.stop, '');
      });
    });
    addNode('seasonal', sequenceName('seasonal'), 'seasonal');
    var extraCol = 6;
    var extraRow = 0;
    var pos = {};
    nodes.forEach(function(node){
      var spot = SPOT[node.id];
      if (!spot && node.id.indexOf('stop:') === 0) spot = [6, 2];
      if (!spot) {
        spot = [extraCol, extraRow];
        extraRow += 1;
      }
      pos[node.id] = {x: spot[0], y: spot[1]};
    });
    var edges = [];
    PATH.forEach(function(row){
      row.outs.forEach(function(out, index){
        var to = out.to || ('stop:' + (out.stop || ''));
        if (!pos[row.key] || !pos[to]) return;
        edges.push({from: row.key, to: to, index: index, event: out.event || '', back: pos[to].x <= pos[row.key].x});
      });
    });
    return {nodes: nodes, pos: pos, edges: edges};
  }
  function renderPath(){
    var map = document.getElementById('path-map');
    if (!map) return;
    var heading = document.getElementById('path-heading');
    if (heading) heading.textContent = currentKey ? 'Cadence map · ' + sequenceName(currentKey) : 'Cadence map';
    var model = chartModel();
    var boxW = 180;
    var boxH = 72;
    var gapX = 92;
    var gapY = 36;
    var maxX = 0;
    var maxY = 0;
    Object.keys(model.pos).forEach(function(id){
      maxX = Math.max(maxX, model.pos[id].x);
      maxY = Math.max(maxY, model.pos[id].y);
    });
    var width = (maxX + 1) * (boxW + gapX) - gapX + 8;
    var height = (maxY + 1) * (boxH + gapY) - gapY + 8;
    function origin(id){
      var spot = model.pos[id];
      return {x: spot.x * (boxW + gapX), y: spot.y * (boxH + gapY)};
    }
    var arrows = model.edges.map(function(edge){
      var a = origin(edge.from);
      var b = origin(edge.to);
      var x1 = a.x + boxW;
      var y1 = a.y + boxH / 2;
      var x2 = b.x;
      var y2 = b.y + boxH / 2;
      var bend = edge.back ? 78 : 0;
      var midX = (x1 + x2) / 2;
      var midY = (y1 + y2) / 2 + bend;
      var path = edge.back
        ? 'M ' + (a.x + boxW / 2) + ' ' + (a.y + boxH) + ' Q ' + midX + ' ' + (Math.max(y1, y2) + 90) + ' ' + (b.x + boxW / 2) + ' ' + (b.y + boxH)
        : 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + gapX * 0.6) + ' ' + y1 + ', ' + (x2 - gapX * 0.6) + ' ' + y2 + ', ' + x2 + ' ' + y2;
      return '<path d="' + path + '"></path>';
    }).join('');
    var labels = model.edges.map(function(edge){
      var a = origin(edge.from);
      var b = origin(edge.to);
      var left;
      var top;
      if (edge.back) {
        left = (a.x + b.x) / 2 + boxW / 2 - 70;
        top = Math.max(a.y, b.y) + boxH + 28;
      } else {
        left = a.x + boxW + 6;
        top = (a.y + b.y) / 2 + boxH / 2 - 28;
      }
      return '<button type="button" class="flow-label" data-from="' + esc(edge.from) + '" style="left:' + left + 'px;top:' + top + 'px">' + esc(edge.event) + '</button>';
    }).join('');
    var boxes = model.nodes.map(function(node){
      var spot = origin(node.id);
      var delay = node.key ? delayCaption(node.key) : '';
      var current = node.key && node.key === currentKey ? ' aria-current="true"' : '';
      var editing = node.key && node.key === flowKey ? ' data-editing="true"' : '';
      if (!node.key) {
        return '<div class="flow-node flow-stop" style="left:' + spot.x + 'px;top:' + spot.y + 'px;width:' + boxW + 'px;min-height:' + boxH + 'px">' +
          '<b>' + esc(node.label) + '</b></div>';
      }
      return '<button type="button" class="flow-node" data-key="' + esc(node.key) + '"' + current + editing +
        ' style="left:' + spot.x + 'px;top:' + spot.y + 'px;width:' + boxW + 'px;min-height:' + boxH + 'px">' +
        '<b>' + esc(node.label) + '</b>' +
        (delay ? '<span>' + esc(delay) + '</span>' : '') +
        '</button>';
    }).join('');
    var row = pathRow(flowKey, false);
    var choices = '<option value="">Hand the lead to the contractor</option>' + sequences.map(function(item){
      return '<option value="' + esc(item.key) + '">' + esc(item.name) + '</option>';
    }).join('');
    var branches = row.outs.map(function(out, index){
      var selected = out.to || '';
      var options = choices.replace('value="' + selected + '"', 'value="' + selected + '" selected');
      return '<div class="flow-branch">' +
        '<label>Event<input data-branch="' + index + '" data-field="event" value="' + esc(out.event || '') + '"></label>' +
        '<label>Then<select data-branch="' + index + '" data-field="to">' + options + '</select></label>' +
        '<button type="button" class="btn quiet" data-remove="' + index + '">Remove</button>' +
        '</div>';
    }).join('') || '<p class="note">No branches yet. Add one to show what happens next.</p>';
    map.innerHTML =
      '<div class="flow-scroll"><div class="flow-board" style="width:' + width + 'px;height:' + Math.max(height, 120) + 'px">' +
      '<svg class="flow-arrows" width="' + width + '" height="' + Math.max(height, 120) + '" viewBox="0 0 ' + width + ' ' + Math.max(height, 120) + '" aria-hidden="true">' +
      '<defs><marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker></defs>' +
      arrows + '</svg>' + boxes + labels + '</div></div>' +
      '<div class="flow-edit">' +
      '<h3>Branches from ' + esc(sequenceName(flowKey)) + '</h3>' +
      branches +
      '<div class="actions"><button type="button" class="btn" id="flow-add">Add a branch</button>' +
      '<button type="button" class="btn quiet" id="flow-reset">Use the original path</button></div>' +
      '<p class="note">The line under a cadence is the wait inside it, from its first touchpoint to its last. Seasonal emails can run beside another cadence until a visit is booked or the family is closed or inactive.</p>' +
      '</div>';
  }
  function openSequence(key){
    if (!sequences.some(function(row){ return row.key === key; })) return;
    if (key !== currentKey) openStep = 0;
    currentKey = key;
    renderList();
    renderPath();
    renderSteps();
  }
  function sequenceSteps(){
    return steps.filter(function(row){ return row.sequence_key === currentKey; })
      .slice().sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
  }
  function renderList(){
    document.getElementById('sequence-list').innerHTML = sequences.map(function(row){
      var count = steps.filter(function(step){ return step.sequence_key === row.key; }).length;
      return '<li><button type="button" data-key="' + esc(row.key) + '" aria-current="' + (row.key === currentKey) + '">' +
        '<span class="t">' + esc(row.name) + '</span>' +
        '<span class="meta">' + count + (count === 1 ? ' touchpoint' : ' touchpoints') + '</span></button></li>';
    }).join('') || '<li><p class="note">No cadences yet.</p></li>';
  }
  function timingFields(step){
    if (step.timing === 'event') {
      return '<label for="hour-' + step.id + '">Hours from the session</label>' +
        '<input id="hour-' + step.id + '" type="number" min="-336" max="336" step="1" value="' + Number(step.hour_offset || 0) + '">' +
        '<p class="note">Negative hours are before the session. Zero is the start.</p>';
    }
    if (step.timing === 'calendar') {
      return '<label for="month-' + step.id + '">Month</label>' +
        '<input id="month-' + step.id + '" type="number" min="1" max="12" step="1" value="' + Number(step.month || 1) + '">' +
        '<label for="day-' + step.id + '">Day</label>' +
        '<input id="day-' + step.id + '" type="number" min="1" max="31" step="1" value="' + Number(step.day_of_month || 1) + '">';
    }
    return '<label for="offset-' + step.id + '">Days after the start</label>' +
      '<input id="offset-' + step.id + '" type="number" min="0" max="400" step="1" value="' + Number(step.day_offset || 0) + '">';
  }
  function companionField(step){
    if (step.channel === 'call') {
      return '<label for="companion-' + step.id + '">Text if nobody answers</label>' +
        '<select id="companion-' + step.id + '">' + optionsFor('sms', step.companion_key) + '</select>';
    }
    if (step.channel === 'email' && step.companion_key) {
      return '<label for="companion-' + step.id + '">Text sent with this email</label>' +
        '<select id="companion-' + step.id + '">' + optionsFor('sms', step.companion_key) + '</select>';
    }
    if (step.channel === 'sms' && step.companion_key) {
      return '<label for="companion-' + step.id + '">Email if they have not agreed to texts</label>' +
        '<select id="companion-' + step.id + '">' + optionsFor('email', step.companion_key) + '</select>';
    }
    return '';
  }
  function stepForm(step){
    var primary = messageByKey(step.message_key);
    var calendar = step.channel === 'email'
      ? '<label class="check"><input id="calendar-' + step.id + '" type="checkbox"' + (step.calendar_invite ? ' checked' : '') + '> Include a calendar invite</label>'
      : '';
    return '<form data-step="' + step.id + '">' +
      '<label for="when-' + step.id + '">When</label>' +
      '<input id="when-' + step.id + '" maxlength="80" value="' + esc(step.when_label) + '">' +
      timingFields(step) +
      '<label for="ask-' + step.id + '">How hard it asks</label>' +
      '<select id="ask-' + step.id + '">' +
        '<option value=""' + (step.ask ? '' : ' selected') + '>Reminder</option>' +
        '<option value="hard"' + (step.ask === 'hard' ? ' selected' : '') + '>Hard ask</option>' +
        '<option value="soft"' + (step.ask === 'soft' ? ' selected' : '') + '>Soft ask</option>' +
        '<option value="none"' + (step.ask === 'none' ? ' selected' : '') + '>No ask</option>' +
      '</select>' +
      '<label for="intent-' + step.id + '">Intent</label>' +
      '<textarea id="intent-' + step.id + '" rows="3">' + esc(step.intent) + '</textarea>' +
      '<label for="message-' + step.id + '">' + (step.channel === 'call' ? 'Call script' : channelName(step.channel)) + '</label>' +
      '<select id="message-' + step.id + '">' + optionsFor(step.channel, step.message_key) + '</select>' +
      (primary ? '<p class="note"><a href="/admin/messages/?key=' + encodeURIComponent(step.message_key) + '">Edit ' + esc(primary.name) + ' in Messages</a></p>' : '') +
      companionField(step) +
      calendar +
      '<div class="actions"><button class="btn" type="submit">Save touchpoint</button></div>' +
      '<p class="status-line" id="status-' + step.id + '" role="status"></p>' +
      '</form>';
  }
  function renderSteps(){
    var sequence = selectedSequence();
    document.getElementById('sequence-name').textContent = sequence ? sequence.name : 'Choose a cadence';
    document.getElementById('sequence-goal').textContent = sequence ? (sequence.goal || '') : '';
    var list = sequenceSteps();
    document.getElementById('step-list').innerHTML = list.map(function(step){
      var primary = messageByKey(step.message_key);
      var open = openStep === step.id;
      return '<div class="cadence-step">' +
        '<button type="button" class="step-summary" data-open="' + step.id + '" aria-expanded="' + open + '">' +
        '<b>' + esc(step.when_label) + ' · ' + channelName(step.channel) + '</b>' +
        '<span>' + esc(primary ? primary.name : 'No message') + '</span></button>' +
        (open ? stepForm(step) : '') +
        '</div>';
    }).join('') || (sequence ? '<p class="note">This cadence has no touchpoints yet.</p>' : '');
  }
  function load(){
    return Promise.all([
      api('/office/cadences'),
      api('/office/messages')
    ]).then(function(result){
      var data = result[0] || {};
      sequences = rows(data.sequences).slice().sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
      steps = rows(data.steps);
      messages = rows(result[1]);
      if (!sequences.some(function(row){ return row.key === currentKey; })) {
        currentKey = sequences.length ? sequences[0].key : '';
      }
      renderList();
      renderPath();
      renderSteps();
    });
  }
  function openDesk(){
    showLogin(false);
    load().catch(function(err){
      showLogin(true);
      document.getElementById('login-status').textContent = err.message;
    });
  }
  function readStep(form){
    var id = Number(form.getAttribute('data-step'));
    var step = steps.filter(function(row){ return row.id === id; })[0];
    if (!step) return null;
    var messageSelect = document.getElementById('message-' + id);
    var companion = document.getElementById('companion-' + id);
    var calendar = document.getElementById('calendar-' + id);
    var body = {
      step_id: id,
      when_label: document.getElementById('when-' + id).value,
      day_offset: step.timing === 'day' ? Number(document.getElementById('offset-' + id).value) : Number(step.day_offset || 0),
      hour_offset: step.timing === 'event' ? Number(document.getElementById('hour-' + id).value) : Number(step.hour_offset || 0),
      month: step.timing === 'calendar' ? Number(document.getElementById('month-' + id).value) : Number(step.month || 0),
      day_of_month: step.timing === 'calendar' ? Number(document.getElementById('day-' + id).value) : Number(step.day_of_month || 0),
      ask: document.getElementById('ask-' + id).value,
      intent: document.getElementById('intent-' + id).value,
      message_key: messageSelect ? messageSelect.value : (step.message_key || ''),
      companion_key: companion ? companion.value : (step.companion_key || ''),
      calendar_invite: !!(calendar && calendar.checked)
    };
    return {step: step, body: body};
  }

  document.getElementById('login-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('login-status');
    status.textContent = 'Signing in…';
    api('/auth/login', {method:'POST', auth:false, body:window.AIPA_OFFICE.creds()})
      .then(function(data){
        window.AIPA_OFFICE.save(data);
        document.getElementById('password').value = '';
        status.textContent = '';
        openDesk();
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(event){
    event.preventDefault();
    window.AIPA_OFFICE.clear();
    showLogin(true);
  });
  document.getElementById('sequence-list').addEventListener('click', function(event){
    var button = event.target.closest('[data-key]');
    if (!button) return;
    openSequence(button.getAttribute('data-key'));
  });
  document.getElementById('cadence-path').addEventListener('click', function(event){
    if (event.target.closest('#flow-add')) {
      pathRow(flowKey, true).outs.push({event: 'New event', to: 'attendance'});
      savePath();
      renderPath();
      return;
    }
    if (event.target.closest('#flow-reset')) {
      PATH = JSON.parse(JSON.stringify(ORIGINAL_PATH));
      localStorage.removeItem(PATH_STORE);
      renderPath();
      return;
    }
    var remove = event.target.closest('[data-remove]');
    if (remove) {
      pathRow(flowKey, true).outs.splice(Number(remove.getAttribute('data-remove')), 1);
      savePath();
      renderPath();
      return;
    }
    var from = event.target.closest('[data-from]');
    if (from) {
      flowKey = from.getAttribute('data-from');
      renderPath();
      return;
    }
    var button = event.target.closest('[data-key]');
    if (!button) return;
    flowKey = button.getAttribute('data-key');
    openSequence(flowKey);
  });
  document.getElementById('cadence-path').addEventListener('change', function(event){
    var field = event.target.closest('[data-field]');
    if (!field) return;
    var out = pathRow(flowKey, true).outs[Number(field.getAttribute('data-branch'))];
    if (!out) return;
    if (field.getAttribute('data-field') === 'event') out.event = field.value;
    if (field.getAttribute('data-field') === 'to') {
      if (field.value) {
        out.to = field.value;
        delete out.stop;
      } else {
        delete out.to;
        out.stop = 'Hand the lead to the contractor';
      }
    }
    savePath();
    renderPath();
  });
  document.getElementById('step-list').addEventListener('click', function(event){
    var button = event.target.closest('[data-open]');
    if (!button) return;
    var id = Number(button.getAttribute('data-open'));
    openStep = openStep === id ? 0 : id;
    renderSteps();
  });
  document.getElementById('step-list').addEventListener('submit', function(event){
    var form = event.target.closest('form');
    if (!form) return;
    event.preventDefault();
    var read = readStep(form);
    if (!read) return;
    var status = document.getElementById('status-' + read.step.id);
    status.textContent = 'Saving…';
    api('/office/cadence-step', {method:'POST', body: read.body}).then(function(){
      read.step.when_label = read.body.when_label;
      read.step.day_offset = read.body.day_offset;
      read.step.hour_offset = read.body.hour_offset;
      read.step.month = read.body.month;
      read.step.day_of_month = read.body.day_of_month;
      read.step.ask = read.body.ask;
      read.step.intent = read.body.intent;
      read.step.message_key = read.body.message_key;
      read.step.companion_key = read.body.companion_key;
      read.step.calendar_invite = read.body.calendar_invite;
      openStep = read.step.id;
      renderList();
      renderSteps();
      var saved = document.getElementById('status-' + read.step.id);
      if (saved) saved.textContent = 'Saved.';
    }).catch(function(err){ status.textContent = err.message; });
  });

  if (token()) openDesk();
  else showLogin(true);
})();
