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
        if (r.status === 401) { sessionStorage.removeItem(KEY); showLogin(true); }
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
    return '<option value="">Choose a message</option>' + messages.filter(function(row){
      return row.channel === channel;
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
  function pathButton(key){
    var current = key === currentKey ? ' aria-current="true"' : '';
    return '<button type="button" class="path-next" data-key="' + esc(key) + '"' + current + '>' + esc(sequenceName(key)) + '</button>';
  }
  function renderPath(){
    var map = document.getElementById('path-map');
    if (!map) return;
    var rowsHtml = PATH.map(function(row){
      var current = row.key === currentKey ? ' aria-current="true"' : '';
      var outs = row.outs.map(function(out){
        var dest = out.to ? pathButton(out.to) : '<span class="path-stop">' + esc(out.stop) + '</span>';
        return '<li><span class="path-event">' + esc(out.event) + '</span>' + dest + '</li>';
      }).join('');
      return '<li class="path-row"><button type="button" class="path-node" data-key="' + esc(row.key) + '"' + current + '>' +
        esc(sequenceName(row.key)) + '</button><ul class="path-outs">' + outs + '</ul></li>';
    }).join('');
    var seasonalCurrent = currentKey === 'seasonal' ? ' aria-current="true"' : '';
    map.innerHTML = '<ol>' + rowsHtml + '</ol>' +
      '<div class="path-side"><button type="button" class="path-node" data-key="seasonal"' + seasonalCurrent + '>' +
      esc(sequenceName('seasonal')) + '</button>' +
      '<p class="note">These can run while another cadence is running. They stop for someone who has booked a visit, is closed, or is inactive.</p></div>' +
      '<ul class="path-exits">' +
      '<li>A real reply pauses the cadence until you answer and resume it, or move them by hand.</li>' +
      '<li>An unsubscribe or a clear no closes them.</li>' +
      '<li>A booked visit stops every cadence and hands the lead to the contractor.</li>' +
      '</ul>';
  }
  function openSequence(key){
    if (!sequences.some(function(row){ return row.key === key; })) return;
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
  var NURTURE_TOKENS = [
    {token: '{{first_name}}', label: 'First name'},
    {token: '{{page}}', label: 'Personal page'},
    {token: '{{guide}}', label: 'Guide title'},
    {token: '{{guide_link}}', label: 'Guide link'}
  ];
  function nurtureCopy(step){
    if (!selectedSequence() || selectedSequence().key !== 'nurture_before') return '';
    var email = messageByKey(step.message_key);
    var sms = messageByKey(step.companion_key);
    if (!email) return '';
    return '<label for="copy-subject-' + step.id + '">Subject</label>' +
      '<input id="copy-subject-' + step.id + '" maxlength="200" value="' + esc(email.subject || '') + '">' +
      '<label for="copy-body-' + step.id + '">Email</label>' +
      '<textarea id="copy-body-' + step.id + '" rows="10">' + esc(email.body || '') + '</textarea>' +
      '<label for="copy-sms-' + step.id + '">Text</label>' +
      '<textarea id="copy-sms-' + step.id + '" rows="4">' + esc(sms ? sms.body || '' : '') + '</textarea>' +
      '<div class="token-row" id="tokens-' + step.id + '">' + NURTURE_TOKENS.map(function(item){
        return '<button type="button" data-token="' + esc(item.token) + '">' + esc(item.label) + '</button>';
      }).join('') + '</div>' +
      '<p class="note">These are the words that go out. A merge field is replaced when the message is sent.</p>';
  }
  function renderSteps(){
    var sequence = selectedSequence();
    document.getElementById('sequence-name').textContent = sequence ? sequence.name : 'Choose a cadence';
    document.getElementById('sequence-goal').textContent = sequence ? (sequence.goal || '') : '';
    var list = sequenceSteps();
    document.getElementById('step-list').innerHTML = list.map(function(step){
      var primary = messageByKey(step.message_key);
      var calendar = step.channel === 'email'
        ? '<label class="check"><input id="calendar-' + step.id + '" type="checkbox"' + (step.calendar_invite ? ' checked' : '') + '> Include a calendar invite</label>'
        : '';
      return '<form class="cadence-step" data-step="' + step.id + '">' +
        '<h3>' + esc(step.when_label) + ' · ' + channelName(step.channel) + '</h3>' +
        '<p class="note">' + askName(step.ask) + '</p>' +
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
        '<textarea id="intent-' + step.id + '" rows="4">' + esc(step.intent) + '</textarea>' +
        (selectedSequence() && selectedSequence().key === 'nurture_before' ? nurtureCopy(step) :
          '<label for="message-' + step.id + '">' + (step.channel === 'call' ? 'Call script' : channelName(step.channel)) + '</label>' +
          '<select id="message-' + step.id + '">' + optionsFor(step.channel, step.message_key) + '</select>' +
          (primary ? '<p class="note"><a href="/admin/messages/?key=' + encodeURIComponent(step.message_key) + '">Edit ' + esc(primary.name) + ' in Messages</a></p>' : '')) +
        (selectedSequence() && selectedSequence().key === 'nurture_before' ? '' : companionField(step)) +
        (selectedSequence() && selectedSequence().key === 'nurture_before' ? '' : calendar) +
        '<div class="actions"><button class="btn" type="submit">Save touchpoint</button></div>' +
        '<p class="status-line" id="status-' + step.id + '" role="status"></p>' +
      '</form>';
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

  function saveNurtureCopy(step){
    var subject = document.getElementById('copy-subject-' + step.id);
    if (!subject) return Promise.resolve();
    var email = messageByKey(step.message_key);
    var sms = messageByKey(step.companion_key);
    var body = document.getElementById('copy-body-' + step.id).value;
    var smsBody = document.getElementById('copy-sms-' + step.id).value;
    var saves = [];
    if (email) {
      saves.push(api('/office/message', {method:'POST', body:{key: email.key, subject: subject.value, body: body}}).then(function(){
        email.subject = subject.value;
        email.body = body;
      }));
    }
    if (sms) {
      saves.push(api('/office/message', {method:'POST', body:{key: sms.key, subject: '', body: smsBody}}).then(function(){
        sms.body = smsBody;
      }));
    }
    return Promise.all(saves);
  }
  var copyCaret = {id: '', start: 0, end: 0};
  function rememberCopy(event){
    var field = event.target;
    if (!field || !field.id || field.id.indexOf('copy-') !== 0) return;
    copyCaret = {id: field.id, start: field.selectionStart || 0, end: field.selectionEnd || 0};
  }

  document.getElementById('login-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('login-status');
    status.textContent = 'Signing in…';
    api('/auth/login', {method:'POST', auth:false, body:{password: document.getElementById('password').value}})
      .then(function(data){
        sessionStorage.setItem(KEY, data.authToken);
        document.getElementById('password').value = '';
        status.textContent = '';
        openDesk();
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(event){
    event.preventDefault();
    sessionStorage.removeItem(KEY);
    showLogin(true);
  });
  document.getElementById('sequence-list').addEventListener('click', function(event){
    var button = event.target.closest('[data-key]');
    if (!button) return;
    openSequence(button.getAttribute('data-key'));
  });
  document.getElementById('cadence-path').addEventListener('click', function(event){
    var button = event.target.closest('[data-key]');
    if (!button) return;
    openSequence(button.getAttribute('data-key'));
    var editor = document.getElementById('sequence-editor');
    if (editor && editor.scrollIntoView) editor.scrollIntoView({behavior:'smooth', block:'nearest'});
  });
  document.getElementById('step-list').addEventListener('focusin', rememberCopy);
  document.getElementById('step-list').addEventListener('keyup', rememberCopy);
  document.getElementById('step-list').addEventListener('click', function(event){
    var button = event.target.closest('[data-token]');
    if (!button) return;
    var form = button.closest('form');
    var field = copyCaret.id ? document.getElementById(copyCaret.id) : null;
    if (!field || !form || !form.contains(field)) field = form.querySelector('textarea');
    if (!field) return;
    var tokenText = button.getAttribute('data-token');
    var start = field.id === copyCaret.id ? copyCaret.start : field.value.length;
    var end = field.id === copyCaret.id ? copyCaret.end : field.value.length;
    field.value = field.value.slice(0, start) + tokenText + field.value.slice(end);
    var pos = start + tokenText.length;
    copyCaret = {id: field.id, start: pos, end: pos};
    field.focus();
    field.setSelectionRange(pos, pos);
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
      return saveNurtureCopy(read.step);
    }).then(function(){
      status.textContent = 'Saved.';
      renderList();
      renderSteps();
    }).catch(function(err){ status.textContent = err.message; });
  });

  if (token()) openDesk();
  else showLogin(true);
})();
