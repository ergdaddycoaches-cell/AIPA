(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var dash = document.getElementById('dash');
  var signout = document.getElementById('signout');
  var families = [];
  var ageFilter = 'all';
  var reachMode = '';
  var pendingInvite = null;
  var stages = [];
  var places = {};
  var stageDraft = [];
  var detailTab = 'summary';
  var detailTabFor = 0;
  var contractors = [];
  var profiles = {};
  var bills = [];
  var cadenceSequences = [];
  var cadenceSteps = [];
  var cadenceRuns = {};
  var contractorFilter = '';
  var contractorFilterStamp = '';
  var selectedId = 0;
  var dial = { phase: '', registrationId: 0, name: '', number: '', call: null, device: null, token: '', muted: false, started: 0, timer: 0, error: '' };
  var fromClick = false;
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var ROLES = {parent:'Parent', adult_child:'Adult child', spouse:'Spouse', sibling:'Sibling', other:'Other'};
  var STYLES = {
    protective:'Protective', minimizing:'Minimizing', detail:'Wants the details',
    action:'Wants a next step', urgent:'Urgent', unsure:'Not enough to tell'
  };
  var KINDS = {reserved:'Reserved the 1:1', meeting:'1:1', email:'Email sent', text:'Text sent', call:'Called', voicemail:'Voicemail'};
  var REASONS = {visit_booked:'Visit booked', asked_to_stop:'Asked us to stop', no_response:'No response', not_a_fit:'Not a fit'};

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
  function parseList(value){
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }
  function stamp(value){
    var text = String(value || '');
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text);
    return match ? match[0] : '';
  }
  function dayValue(value){
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp(value));
    if (!match) return null;
    return Date.UTC(+match[1], +match[2] - 1, +match[3]);
  }
  function daysBetween(from, to){
    var start = dayValue(from);
    var end = dayValue(to);
    if (start == null || end == null) return 0;
    return Math.max(0, Math.round((end - start) / 86400000));
  }
  function zonedNow(timeZone){
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || 'America/Los_Angeles',
        year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit', hourCycle:'h23'
      });
      var bag = {};
      fmt.formatToParts(new Date()).forEach(function(part){ bag[part.type] = part.value; });
      var hour = bag.hour === '24' ? '00' : bag.hour;
      return bag.year + '-' + bag.month + '-' + bag.day + 'T' + hour + ':' + bag.minute;
    } catch (err) {
      return new Date().toISOString().slice(0, 16);
    }
  }
  function fromEpoch(value, timeZone){
    var n = Number(value);
    if (!n) return '';
    var ms = n < 1e12 ? n * 1000 : n;
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || 'America/Los_Angeles',
        year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit', hourCycle:'h23'
      });
      var bag = {};
      fmt.formatToParts(new Date(ms)).forEach(function(part){ bag[part.type] = part.value; });
      var hour = bag.hour === '24' ? '00' : bag.hour;
      return bag.year + '-' + bag.month + '-' + bag.day + 'T' + hour + ':' + bag.minute;
    } catch (err) {
      return '';
    }
  }
  function pretty(value){
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(stamp(value));
    if (!match) return '';
    var hour = +match[4];
    var minute = match[5];
    var clock = (hour % 12 || 12) + ':' + minute + ' ' + (hour < 12 ? 'AM' : 'PM');
    return MONTHS[+match[2] - 1] + ' ' + (+match[3]) + ', ' + match[1] + ' · ' + clock;
  }
  function shortWhen(value){
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp(value));
    if (!match) return '';
    return SHORT[+match[2] - 1] + ' ' + (+match[3]);
  }
  function people(row){
    var list = parseList(row.guests);
    if (!list.length && (row.guest_name || row.guest_email)) {
      list = [{name: row.guest_name || '', email: row.guest_email || ''}];
    }
    return list.filter(function(person){ return person && person.name; });
  }
  function failedStatus(status){
    return status === 'bounced' || status === 'failed' || status === 'undelivered' || status === 'no-answer' || status === 'busy' || status === 'canceled';
  }
  function countsAsTouch(event){
    if (!event || event.future) return false;
    if (event.kind !== 'meeting' && event.kind !== 'email' && event.kind !== 'text' && event.kind !== 'call' && event.kind !== 'voicemail') return false;
    if (failedStatus(event.status)) return false;
    return true;
  }
  function eventLabel(event){
    if (event.kind === 'meeting' && event.future) return '1:1 scheduled';
    if (event.kind === 'email' && event.status === 'bounced') return 'Email bounced';
    if (event.kind === 'email' && failedStatus(event.status)) return 'Email failed';
    if (event.kind === 'text' && failedStatus(event.status)) return 'Text failed';
    if (event.kind === 'call' && event.status === 'no-answer') return 'No answer';
    if (event.kind === 'call' && event.status === 'busy') return 'Busy';
    if (event.kind === 'call' && failedStatus(event.status)) return 'Call failed';
    if (event.kind === 'voicemail') return 'Voicemail';
    if (event.kind === 'email' && event.direction === 'in') return 'Email received';
    if (event.kind === 'text' && event.direction === 'in') return 'Text received';
    return KINDS[event.kind] || event.kind;
  }
  function e164(value){
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
    if (digits.length > 11) return '+' + digits;
    return '';
  }
  function contacts(row){
    var list = [];
    function add(person){
      if (!person) return;
      var phone = String(person.phone || '').trim();
      var email = String(person.email || '').trim();
      var name = String(person.name || '').trim();
      if (!phone && !email && !name) return;
      var key = (phone || email || name).toLowerCase();
      if (list.some(function(item){ return item.key === key; })) return;
      list.push({key:key, name:name, phone:phone, email:email});
    }
    add({name:row.name, phone:row.phone, email:row.email});
    add({name:row.guest_name, phone:row.guest_phone, email:row.guest_email});
    parseList(row.guests).forEach(add);
    return list;
  }
  function isRetired(family){
    return !!(family && family.row && family.row.engagement === 'retired');
  }
  function callLive(){
    return dial.phase === 'connecting' || dial.phase === 'ringing' || dial.phase === 'open';
  }
  function readiness(value){
    if (value === 'ready') return 'Ready for a visit';
    if (value === 'unsure') return 'Unsure';
    if (value === 'not_ready') return 'Not ready';
    return 'Not set';
  }

  function dateLabel(value){
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return '';
    return MONTHS[+match[2] - 1] + ' ' + (+match[3]) + ', ' + match[1];
  }
  function build(row, meeting, touches, profile){
    var zone = meeting && meeting.timezone ? meeting.timezone : 'America/Los_Angeles';
    var now = zonedNow(zone);
    var occurrence = stamp(row.occurrence_at);
    var events = touches.filter(function(touch){ return touch.registration_id === row.id; }).map(function(touch){
      return {
        kind: touch.kind,
        direction: touch.direction || '',
        status: touch.status || '',
        occurred_at: stamp(touch.occurred_at),
        note: touch.note || '',
        touch_id: touch.id,
        recording_url: touch.recording_url || '',
        future: stamp(touch.occurred_at) > now
      };
    }).filter(function(event){ return event.occurred_at && KINDS[event.kind]; });
    var hasMeeting = events.some(function(event){ return event.kind === 'meeting'; });
    if (!hasMeeting && occurrence) {
      events.push({
        kind: 'meeting',
        occurred_at: occurrence,
        note: occurrence > now ? 'Still ahead.' : '',
        future: occurrence > now
      });
    }
    var hasMessage = events.some(function(event){ return event.kind === 'email' || event.kind === 'text'; });
    if (!hasMessage && row.follow_up_status === 'sent') {
      var sentAt = stamp(row.follow_up_sent_at) || fromEpoch(row.follow_up_sent_at, zone);
      if (sentAt) {
        events.push({kind:'email', occurred_at:sentAt, note:mergeGuide(row.follow_up_note, row.suggested_title), future: sentAt > now});
      }
    }
    events.sort(function(a, b){
      if (a.occurred_at < b.occurred_at) return -1;
      if (a.occurred_at > b.occurred_at) return 1;
      return 0;
    });
    events.forEach(function(event){ event.future = event.occurred_at > now; });
    var upcoming = occurrence > now;
    var pastTouches = events.filter(countsAsTouch);
    var last = pastTouches.length ? pastTouches[pastTouches.length - 1] : null;
    var days = last ? daysBetween(last.occurred_at, now) : 0;
    var contactedAfter = events.some(function(event){
      return countsAsTouch(event) && (event.kind === 'email' || event.kind === 'text' || event.kind === 'call' || event.kind === 'voicemail') && event.occurred_at >= occurrence;
    });
    var latestReal = null;
    events.forEach(function(event){ if (!event.future) latestReal = event; });
    if (latestReal) latestReal.latest = true;
    return {
      id: row.id,
      row: row,
      meeting: meeting,
      zone: zone,
      occurrence: occurrence,
      upcoming: upcoming,
      days: days,
      last: last,
      never: !upcoming && !contactedAfter,
      events: events,
      title: meeting && meeting.title ? meeting.title : (row.meeting_id ? 'Ask Anything 1:1' : 'Added by the office'),
      when: occurrence ? window.AIPA_SEMINAR.format({
        starts_at: occurrence,
        timezone: zone,
        kind: 'one_time'
      }) : (profile && profile.originated_at ? 'Record from ' + dateLabel(profile.originated_at) : 'No 1:1 yet'),
      profile: profile || null,
      guests: people(row),
      reads: parseList(row.attendee_reads)
    };
  }

  function ageClass(family){
    if (!family.last && !family.occurrence) return '';
    if (family.upcoming) return 'soon';
    if (family.days >= 30) return 'late';
    if (family.days <= 3) return 'fresh';
    return '';
  }
  function ageNumber(family){
    if (family.upcoming) return shortWhen(family.occurrence);
    if (family.days === 0) return 'Today';
    if (family.days === 1) return '1';
    return String(family.days);
  }
  function ageCaption(family){
    if (family.upcoming) return 'Coming up';
    if (family.days === 0) return family.last && family.last.kind === 'meeting' ? 'The 1:1 was today' : 'Touched today';
    var unit = family.days === 1 ? 'day' : 'days';
    if (family.last && family.last.kind === 'email' && !family.never) return unit + ' since the email';
    if (family.last && family.last.kind === 'text' && !family.never) return unit + ' since the text';
    if (family.last && family.last.kind === 'call' && !family.never) return unit + ' since the call';
    if (family.last && family.last.kind === 'voicemail' && !family.never) return unit + ' since the voicemail';
    return unit + ' since the 1:1';
  }
  function inAge(family){
    if (ageFilter === 'all') return true;
    if (family.upcoming) return false;
    if (ageFilter === 'never') return family.never;
    return family.days >= Number(ageFilter);
  }
  function wantsCallback(family){
    return !!(family && family.row && (family.row.callback_requested === true || family.row.callback_requested === 1));
  }
  function callbackPhrase(family){
    var raw = String(family && family.row && family.row.callback_requested_at || '');
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (!match) return '';
    var target = Date.UTC(+match[1], +match[2] - 1, +match[3]);
    var todayMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(zonedNow('America/Los_Angeles'));
    if (!todayMatch) return '';
    var today = Date.UTC(+todayMatch[1], +todayMatch[2] - 1, +todayMatch[3]);
    var days = Math.round((target - today) / 86400000);
    if (days > 1) return 'in ' + days + ' days';
    if (days === 1) return 'in 1 day';
    if (days === 0) return 'today';
    var late = Math.abs(days);
    return 'LATE: ' + late + ' ' + (late === 1 ? 'day' : 'days') + ' ago.';
  }
  function contractorIdOf(family){
    var id = family && family.profile && family.profile.contractor_id;
    return Number(id) || 0;
  }
  function inContractor(family){
    if (!contractorFilter) return true;
    if (contractorFilter === '0') return !contractorIdOf(family);
    return contractorIdOf(family) === Number(contractorFilter);
  }
  function pool(){
    return families.filter(inContractor);
  }
  function visible(){
    var list = pool().filter(inAge);
    var quiet = list.filter(function(family){ return !family.upcoming; });
    var ahead = list.filter(function(family){ return family.upcoming; });
    quiet.sort(function(a, b){ return b.days - a.days || a.row.name.localeCompare(b.row.name); });
    ahead.sort(function(a, b){ return a.occurrence < b.occurrence ? -1 : a.occurrence > b.occurrence ? 1 : 0; });
    return quiet.concat(ahead);
  }

  function quietLine(family){
    if (family.upcoming) return 'Coming up ' + shortWhen(family.occurrence);
    if (!family.occurrence && !family.last) return 'No touch yet';
    if (family.days === 0) return ageCaption(family);
    return ageNumber(family) + ' ' + ageCaption(family);
  }
  function callbackMark(){
    return '<span class="callback-mark" role="img" aria-label="Call back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v2.2a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 1h2.2a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.1 8.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2.1z"/><path d="M15 3h6v6"/><path d="M21 3l-6 6"/></svg></span>';
  }
  function card(family){
    return '<li><button type="button" draggable="true" class="family ' + ageClass(family) + '" data-id="' + family.id + '" aria-current="' + (family.id === selectedId) + '">' +
      '<span class="who"><span class="name-line"><strong>' + esc(family.row.name) + '</strong>' +
      (wantsCallback(family) ? callbackMark() : '') +
      '</span><span class="since">' + esc(quietLine(family)) + '</span></span></button></li>';
  }
  function queueHtml(list){
    if (!list.length) {
      return '<p class="empty-queue">No one is in this view.</p>';
    }
    var quiet = list.filter(function(family){ return !family.upcoming; });
    var ahead = list.filter(function(family){ return family.upcoming; });
    var html = '';
    if (quiet.length) html += '<ol class="family-list">' + quiet.map(card).join('') + '</ol>';
    if (ahead.length) {
      html += '<h2 class="queue-label">Coming up</h2><ol class="family-list">' + ahead.map(card).join('') + '</ol>';
    }
    return html;
  }
  function stageFor(family){
    var id = family && places[family.id];
    if (stages.some(function(stage){ return stage.id === id; })) return id;
    return stages.length ? stages[0].id : 0;
  }
  function pipelineHtml(list){
    if (!stages.length) return '<p class="empty-queue">No stages yet. Use Edit stages to add the columns.</p>';
    return stages.map(function(stage){
      var cards = list.filter(function(family){ return stageFor(family) === stage.id; });
      var body = cards.length ? '<ol class="family-list">' + cards.map(card).join('') + '</ol>' : '<p class="column-empty">No one here.</p>';
      return '<section class="stage-col" data-stage="' + stage.id + '"><h2><span>' + esc(stage.name) + '</span><b>' + cards.length + '</b></h2>' + body + '</section>';
    }).join('');
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
        fromClick = true;
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
        movePerson(Number(event.dataTransfer.getData('text/plain')), Number(col.dataset.stage));
      });
    });
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
  function leadReleased(bill){
    return bill.status === 'paid' || bill.status === 'none' || !(Number(bill.amount_cents) > 0);
  }
  function movePerson(id, stageId, jobTotal){
    var family = families.filter(function(item){ return item.id === id; })[0];
    if (!family || !stageId || stageFor(family) === stageId) return;
    var stage = stages.filter(function(item){ return item.id === stageId; })[0];
    var name = stage ? String(stage.name || '').trim().toLowerCase() : '';
    if (name === 'contract completed' && jobTotal == null) {
      askJobTotal(id, stageId);
      return;
    }
    var billingStage = name === 'wants home visit' || name === 'contract completed';
    if (!billingStage) {
      places[id] = stageId;
      render();
    }
    var body = {registration_id:id, stage_id:stageId};
    if (jobTotal != null) body.job_total = String(jobTotal);
    api('/office/pipeline-move', {method:'POST', body:body}).then(function(){
      if (!billingStage) return;
      var ask = document.getElementById('job-ask');
      if (ask) ask.hidden = true;
      return load();
    }).catch(function(err){
      var jobStatus = document.getElementById('job-status');
      if (name === 'contract completed' && jobStatus && !document.getElementById('job-ask').hidden) jobStatus.textContent = err.message;
      else {
        var line = document.getElementById('dash-status');
        if (line) line.textContent = err.message;
      }
      if (billingStage) render();
      else load();
    });
  }
  function askJobTotal(id, stageId){
    var family = families.filter(function(item){ return item.id === id; })[0];
    var box = document.getElementById('job-ask');
    var who = document.getElementById('job-who');
    var status = document.getElementById('job-status');
    var input = document.getElementById('job-total');
    if (!box || !input) return;
    box.dataset.id = String(id);
    box.dataset.stage = String(stageId);
    if (who) who.textContent = family && family.row ? family.row.name : '';
    if (status) status.textContent = '';
    input.value = '';
    render();
    box.hidden = false;
    input.focus();
  }
  function startLead(family){
    var line = document.getElementById('dash-status');
    if (line) line.textContent = 'Starting the lead fee…';
    api('/office/pipeline-move', {method:'POST', body:{registration_id: family.id, stage_id: stageFor(family)}})
      .then(function(){ return load(); })
      .catch(function(err){ if (line) line.textContent = err.message; });
  }
  function timelineNote(event){
    var note = String(event.note || '').trim();
    if (!note) return '';
    var message = event.kind === 'email' || event.kind === 'text' || event.kind === 'voicemail';
    if (!message || note.length <= 50) return '<p>' + esc(note) + '</p>';
    return '<details class="more"><summary><span class="preview">' + esc(note.slice(0, 50)) + '…</span><span class="full">' + esc(note) + '</span> <span class="more-label">More</span><span class="less-label">Less</span></summary></details>';
  }
  function timeline(family){
    return '<ol class="timeline">' + family.events.map(function(event){
      var label = eventLabel(event);
      var cls = event.kind + (event.direction === 'in' ? ' in' : '') + (event.future ? ' future' : '') + (failedStatus(event.status) ? ' failed' : '') + (event.latest ? ' latest' : '');
      return '<li class="' + cls + '"><time>' + esc(pretty(event.occurred_at)) + '</time><h3>' + esc(label) + '</h3>' +
        timelineNote(event) +
        (event.recording_url && event.touch_id ? '<button type="button" class="btn quiet message-play" data-play="family" data-play-id="' + event.touch_id + '">Play</button>' : '') +
        '</li>';
    }).join('') + '</ol>';
  }
  function reads(family){
    if (!family.reads.length) return '';
    return '<ul class="reads">' + family.reads.map(function(person){
      var bits = [ROLES[person.role] || '', STYLES[person.style] || ''].filter(Boolean).join(' · ');
      return '<li><strong>' + esc(person.name || '') + '</strong>' +
        (bits ? '<span class="role">' + esc(bits) + '</span>' : '') +
        (person.note ? '<p>' + esc(person.note) + '</p>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function mergeGuide(text, title){
    var name = String(title || '').trim();
    return String(text || '').replace(/\{\{guide\}\}/g, name || '{{guide}}');
  }
  function follow(row){
    if (!row.follow_up_note) return '';
    var label = row.follow_up_status === 'sent' ? 'Follow-up that went out' : row.follow_up_status === 'draft' ? 'Draft, not sent' : 'Follow-up note';
    return '<div class="follow"><h3>' + esc(label) + '</h3><p>' + esc(mergeGuide(row.follow_up_note, row.suggested_title)) + '</p></div>';
  }
  function firstSentence(text){
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    var match = value.match(/^.+?[.!?](?=\s|$)/);
    return match ? match[0] : value;
  }
  function latestEvent(family){
    var past = (family.events || []).filter(function(event){ return !event.future; });
    if (past.length) return past[past.length - 1];
    return (family.events || [])[0] || null;
  }
  function showedLine(person){
    var how = STYLES[person.style] || ROLES[person.role] || '';
    return (person.name || 'Someone') + (how ? ' · ' + how : '');
  }
  function hasConversation(family){
    return !!(family.row.summary || family.row.suggested_slug || family.row.follow_up_note);
  }
  function summaryPanel(family){
    var lines = [];
    var event = latestEvent(family);
    if (event) {
      var note = firstSentence(event.note);
      lines.push('<p><b>Latest</b> ' + esc(pretty(event.occurred_at)) + ' · ' + esc(eventLabel(event)) + (note ? '. ' + esc(note) : '') + '</p>');
    }
    if (family.row.summary) lines.push('<p><b>Conversation</b> ' + esc(firstSentence(family.row.summary)) + '</p>');
    if (family.profile && family.profile.notes) lines.push('<p><b>Notes</b> ' + esc(firstSentence(family.profile.notes)) + '</p>');
    family.reads.forEach(function(person, index){
      lines.push('<p' + (index ? ' class="sum-next"' : '') + '>' + (index ? '' : '<b>Showed up</b> ') + esc(showedLine(person)) + '</p>');
    });
    return lines.length ? lines.join('') : '<p class="band-empty">Nothing recorded yet.</p>';
  }
  function conversationPanel(family){
    var guide = family.row.suggested_slug
      ? '<p><a class="guide-link" href="/library/article/?slug=' + encodeURIComponent(family.row.suggested_slug) + '">' + esc(family.row.suggested_title || family.row.suggested_slug) + '</a></p>' +
        (family.row.suggestion_reason ? '<p class="reason">' + esc(family.row.suggestion_reason) + '</p>' : '')
      : '';
    return (family.row.summary ? '<p>' + esc(family.row.summary) + '</p>' : '') + guide + follow(family.row);
  }
  function addressLine(profile){
    var street = [profile.address_1, profile.address_2].filter(function(part){ return part; }).join(', ');
    var place = [profile.city, profile.state].filter(function(part){ return part; }).join(', ');
    if (profile.zip) place = place ? place + ' ' + profile.zip : profile.zip;
    return [street, place].filter(function(part){ return part; }).join(' · ');
  }
  function flagLine(value){
    if (value === 'yes') return 'Opted in';
    if (value === 'no') return 'Not opted in';
    return '';
  }
  function hasRecord(family){
    var profile = family.profile;
    if (!profile) return false;
    return !!(addressLine(profile) || profile.notes || profile.originated_at || profile.opt_in_call || profile.opt_in_email || profile.opt_in_sms || family.row.email || family.row.phone);
  }
  function recordPanel(family){
    var profile = family.profile || {};
    var lines = [];
    var address = addressLine(profile);
    if (address) lines.push('<p><b>Address</b> ' + esc(address) + '</p>');
    if (family.row.email) lines.push('<p><b>Email</b> ' + esc(family.row.email) + '</p>');
    if (family.row.phone) lines.push('<p><b>Cell</b> ' + esc(family.row.phone) + '</p>');
    if (profile.originated_at) lines.push('<p><b>Opened</b> ' + esc(dateLabel(profile.originated_at)) + '</p>');
    if (flagLine(profile.opt_in_call)) lines.push('<p><b>Calls</b> ' + flagLine(profile.opt_in_call) + '</p>');
    if (flagLine(profile.opt_in_email)) lines.push('<p><b>Emails</b> ' + flagLine(profile.opt_in_email) + '</p>');
    if (flagLine(profile.opt_in_sms)) lines.push('<p><b>Texts</b> ' + flagLine(profile.opt_in_sms) + '</p>');
    if (profile.notes) lines.push('<p><b>Notes</b> ' + esc(profile.notes) + '</p>');
    return lines.join('') || '<p class="band-empty">No address or notes yet.</p>';
  }
  function band(family){
    if (detailTabFor !== family.id) {
      detailTab = 'summary';
      detailTabFor = family.id;
    }
    var tabs = [{id:'summary', label:'Summary'}];
    if (family.events.length) tabs.push({id:'timeline', label:'Timeline'});
    if (hasConversation(family)) tabs.push({id:'conversation', label:'Conversation'});
    if (family.reads.length) tabs.push({id:'showed', label:'Showed up'});
    if (hasRecord(family)) tabs.push({id:'record', label:'Record'});
    if (!tabs.some(function(tab){ return tab.id === detailTab; })) detailTab = 'summary';
    var panel = summaryPanel(family);
    if (detailTab === 'timeline') panel = timeline(family);
    else if (detailTab === 'conversation') panel = conversationPanel(family);
    else if (detailTab === 'showed') panel = reads(family);
    else if (detailTab === 'record') panel = recordPanel(family);
    if (tabs.length === 1 && panel.indexOf('band-empty') !== -1) return '';
    return '<div class="band-tabs" role="tablist">' + tabs.map(function(tab){
      return '<button type="button" role="tab" data-tab="' + tab.id + '" aria-selected="' + (detailTab === tab.id) + '">' + tab.label + '</button>';
    }).join('') + '</div><div class="detail-body" role="tabpanel">' + panel + '</div>';
  }
  function choiceList(people, field){
    return people.filter(function(person){ return person[field]; }).map(function(person, index){
      var value = field === 'phone' ? (e164(person.phone) || person.phone) : person.email;
      return '<label class="who-choice"><input type="radio" name="reach-who" value="' + esc(value) + '"' + (index === 0 ? ' checked' : '') + '>' +
        '<span><b>' + esc(person.name || value) + '</b><small>' + esc(value) + '</small></span></label>';
    }).join('');
  }
  function dialLabel(){
    if (dial.phase === 'connecting') return 'Starting the dialer…';
    if (dial.phase === 'ringing') return 'Ringing…';
    if (dial.phase === 'open') return 'On the call';
    if (dial.phase === 'ended') return dial.error || 'Call ended.';
    if (dial.phase === 'error') return dial.error || 'The call could not start.';
    return '';
  }
  function dialerHtml(){
    var live = callLive();
    return '<div class="dialer">' +
      '<p class="dial-kicker" id="dial-status">' + esc(dialLabel()) + '</p>' +
      '<p class="dial-who">' + esc(dial.name || 'Ask Anything 1:1') + '</p>' +
      '<p class="dial-number">' + esc(dial.number) + '</p>' +
      '<p class="dial-timer" id="call-timer"' + (dial.phase === 'open' ? '' : ' hidden') + '>0:00</p>' +
      '<div class="dial-actions">' +
      (live ? '<button type="button" data-act="mute" aria-pressed="' + dial.muted + '">' + (dial.muted ? 'Unmute' : 'Mute') + '</button>' : '') +
      (live ? '<button type="button" class="hangup" data-act="hangup">Hang up</button>' : '<button type="button" data-act="close">Close</button>') +
      '</div></div>';
  }
  function messageTokens(family){
    var pages = window.AIPA_MESSAGES ? AIPA_MESSAGES.pages() : {
      live_qa: 'https://goaipa.com/live-qa/',
      one_to_one: 'https://goaipa.com/ask-anything/',
      library: 'https://goaipa.com/library/',
      sms_opt_in: '',
      first_name: ''
    };
    pages.first_name = firstName(family);
    var linkToken = family.profile && family.profile.sms_token;
    if (linkToken) pages.sms_opt_in = 'https://goaipa.com/admin/families/sms/?t=' + linkToken;
    return pages;
  }
  function guideMail(family){
    var note = String(family.row.follow_up_note || '').trim();
    var slug = String(family.row.suggested_slug || '').trim();
    var title = String(family.row.suggested_title || '').trim();
    var pdf = slug ? (family.handoutUrl || ('https://goaipa.com/library/pdf/' + slug + '.pdf')) : '';
    var tokens = messageTokens(family);
    tokens.note = note;
    tokens.guide = title;
    tokens.guide_pdf = pdf;
    if (window.AIPA_MESSAGES) {
      if (!title) return AIPA_MESSAGES.compose('guide_followup_plain', tokens);
      var mail = AIPA_MESSAGES.compose('guide_followup', tokens);
      if (!pdf) mail.body = note;
      else if (note && note.indexOf(pdf) !== -1) mail.body = note;
      return mail;
    }
    if (!title) return {subject: 'Following up on our conversation', body: note};
    if (!pdf) return {subject: 'A guide: ' + title, body: note};
    if (note.indexOf(pdf) !== -1) return {subject: 'A guide: ' + title, body: note};
    var handout = 'Print this guide:\n' + pdf + '\n\nBook an Ask Anything 1:1:\nhttps://goaipa.com/ask-anything/\nOr call 833-AIPA-HUB.';
    return {subject: 'A guide: ' + title, body: note ? note + '\n\n' + handout : handout};
  }
  function firstName(family){
    var profile = family.profile || {};
    var first = String(profile.first_name || '').trim();
    if (first) return first;
    var name = String(family.row.name || '').trim();
    var space = name.indexOf(' ');
    return space > 0 ? name.slice(0, space) : name;
  }
  function inviteCopy(family){
    var visit = family.row.attended_1_1 === 'yes';
    if (window.AIPA_MESSAGES) {
      var tokens = messageTokens(family);
      var email = AIPA_MESSAGES.compose(visit ? 'invite_visit' : 'invite_qa', tokens);
      var sms = AIPA_MESSAGES.compose(visit ? 'invite_visit_sms' : 'invite_qa_sms', tokens);
      return {
        next: visit ? 'a home visit' : 'an Ask Anything 1:1',
        subject: email.subject,
        body: email.body,
        sms: sms.body
      };
    }
    var who = firstName(family);
    var hello = who ? 'Hello ' + who + ',' : 'Hello,';
    if (family.row.attended_1_1 === 'yes') {
      return {
        next: 'a home visit',
        subject: 'A home visit',
        body: hello + '\n\nThank you for the Ask Anything 1:1.\n\nThe next step is a home visit, if you want a contractor to look at the house.\n\nReply to this email or call 833-AIPA-HUB.\n\nAging in Place Alliance',
        sms: 'Hi ' + (who ? who : '') + (who ? ', ' : '') + 'it\'s [Guide name]. I enjoyed our talk. Any questions since? When you\'re ready, you can book a measuring visit here: [Book a visit] Reply STOP to opt out.'
      };
    }
    return {
      next: 'an Ask Anything 1:1',
      subject: 'Thank you for joining us today',
      body: (who ? 'Hi ' + who + ',' : 'Hi,') + '\n\nThank you for coming to today\'s Live Q&A.\n\n[If they asked a question: You asked about [topic]. The short answer is [one or two sentences].]\n\nMany people find a private conversation is the easiest next step. An Ask Anything 1:1 is about 30 minutes, about your home and your plans, with no cost and no obligation.\n\nBook my 1:1: https://goaipa.com/ask-anything/\n\nWhenever you\'re ready, or not at all. Either is fine.\n\n[Host name]\n\nAging in Place Alliance\n833-AIPA-HUB',
      sms: (who ? 'Hi ' + who + ', ' : 'Hi, ') + 'it\'s [Host name]. Thanks for joining the Live Q&A. If you\'d like a private chat about your own home, you can book a 1:1 here: https://goaipa.com/ask-anything/ Reply STOP to opt out.'
    };
  }
  function attendHtml(family){
    var seminar = family.row.attended_seminar === 'yes';
    var one = family.row.attended_1_1 === 'yes';
    var invite = (seminar || one)
      ? '<button type="button" data-act="invite" aria-pressed="' + (reachMode === 'invite') + '">Invite to the next step</button>'
      : '';
    return '<div class="attend" role="group" aria-label="Attendance">' +
      '<button type="button" data-act="attend" data-kind="seminar" aria-pressed="' + seminar + '">Attended Q&A</button>' +
      '<button type="button" data-act="attend" data-kind="1_1" aria-pressed="' + one + '">Attended 1:1</button>' +
      invite + '</div>';
  }
  function reachPanel(family){
    var showingCall = dial.registrationId === family.id && dial.phase && (reachMode === 'call' || callLive() || dial.phase === 'ended' || dial.phase === 'error');
    if (showingCall && dial.phase !== '') return dialerHtml();
    if (!reachMode) return '';
    var people = contacts(family.row);
    if (reachMode === 'call' || reachMode === 'text') {
      var phones = choiceList(people, 'phone');
      if (!phones) return '<form class="composer" data-reach="' + reachMode + '"><p>There is no number on file.</p><button type="button" data-act="close">Close</button></form>';
    }
    if (reachMode === 'email') {
      var emails = choiceList(people, 'email');
      if (!emails) return '<form class="composer"><p>There is no email on file.</p><button type="button" data-act="close">Close</button></form>';
    }
    if (reachMode === 'call') {
      return '<form class="composer" data-reach="call"><p class="hint">You talk through this computer. They see the Twilio number.</p>' + phones +
        '<div class="composer-actions"><button class="btn" type="submit">Place the call</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    if (reachMode === 'invite') {
      var copy = inviteCopy(family);
      var textOk = family.profile && family.profile.opt_in_sms === 'yes';
      var emailNo = family.profile && family.profile.opt_in_email === 'no';
      return '<form class="composer" data-reach="invite"><p>Invite them to ' + esc(copy.next) + '.</p>' +
        (emailNo ? '<p>They have not opted in to email.</p>' : '<button class="btn" type="button" data-act="invite-email">Email</button>') +
        (textOk ? '<button class="btn" type="button" data-act="invite-text">Text</button>' : '<p>They have not agreed to texts. Use Text agreement first.</p>') +
        '<div class="composer-actions"><button type="button" data-act="close">Close</button></div></form>';
    }
    if (reachMode === 'text') {
      return '<form class="composer" data-reach="text">' + phones +
        '<label for="reach-body">Text</label><textarea id="reach-body" name="reach-body" rows="4" required>' + esc(pendingInvite ? pendingInvite.sms : (family.row.follow_up_note || '')) + '</textarea>' +
        '<div class="composer-actions"><button class="btn" type="submit">Send text</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    if (reachMode === 'sms-agree') {
      var agreed = family.profile && family.profile.opt_in_sms === 'yes';
      if (!family.row.email) return '<form class="composer"><p>There is no email on file.</p><button type="button" data-act="close">Close</button></form>';
      return '<form class="composer" data-reach="sms-agree"><p>This emails them a private link. They confirm their mobile number and agree to texts. The link stops working after they submit.</p>' +
        (agreed ? '<p>They have already agreed to texts. Sending a new link replaces the old one.</p>' : '') +
        '<div class="composer-actions"><button class="btn" type="submit">Send the link</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    if (reachMode === 'email') {
      var mail = guideMail(family);
      var subject = pendingInvite ? pendingInvite.subject : mail.subject;
      var draft = pendingInvite ? pendingInvite.body : mail.body;
      return '<form class="composer" data-reach="email">' + emails +
        '<label for="reach-subject">Subject</label><input id="reach-subject" name="reach-subject" type="text" required value="' + esc(subject) + '">' +
        '<label for="reach-body">Email</label><textarea id="reach-body" name="reach-body" rows="8" required>' + esc(draft) + '</textarea>' +
        '<div class="composer-actions"><button class="btn" type="submit">Send email</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    if (reachMode === 'retire') {
      return '<form class="composer" data-reach="retire"><label for="retire-reason">Why</label><select id="retire-reason" name="reason" required>' +
        '<option value="">Choose a reason</option>' +
        '<option value="visit_booked">Visit booked</option><option value="asked_to_stop">Asked us to stop</option>' +
        '<option value="no_response">No response</option><option value="not_a_fit">Not a fit</option></select>' +
        '<label for="retire-note">Note</label><textarea id="retire-note" name="note" rows="3"></textarea>' +
        '<div class="composer-actions"><button class="btn" type="submit">Retire</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    if (reachMode === 'restore') {
      var why = REASONS[family.row.retired_reason] || 'Retired';
      return '<form class="composer" data-reach="restore"><p>Bring ' + esc(family.row.name) + ' back onto the clock. They were retired as ' + esc(why.toLowerCase()) + '.</p>' +
        (family.row.retired_note ? '<p class="reason">' + esc(family.row.retired_note) + '</p>' : '') +
        '<div class="composer-actions"><button class="btn" type="submit">Bring back</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    return '';
  }
  function contractorField(family){
    var current = contractorIdOf(family);
    return '<label class="stage-pick">Contractor <select id="contractor-select"><option value="0"' + (current ? '' : ' selected') + '>No contractor</option>' +
      contractors.map(function(contractor){
        return '<option value="' + contractor.id + '"' + (contractor.id === current ? ' selected' : '') + '>' + esc(contractor.name) + '</option>';
      }).join('') + '</select></label>';
  }
  function holdLine(family){
    var lead = bills.filter(function(item){ return item.kind === 'lead' && Number(item.registration_id) === family.id; })[0];
    var job = bills.filter(function(item){ return item.kind === 'job' && Number(item.registration_id) === family.id; })[0];
    var stage = stages.filter(function(item){ return item.id === stageFor(family); })[0];
    var name = stage ? String(stage.name || '').trim().toLowerCase() : '';
    var bits = [];
    if (lead) {
      if (leadReleased(lead)) bits.push('The lead fee is ' + (Number(lead.amount_cents) > 0 ? money(lead.amount_cents) + ' and paid' : '$0') + '. Notes and contact are on their pay page.');
      else bits.push('The lead fee is ' + money(lead.amount_cents) + '. Notes and contact stay off their pay page until it is paid.');
    } else if (name === 'wants home visit') {
      bits.push('No lead fee yet.');
    }
    if (job) {
      var due = leadReleased(job) && !(Number(job.amount_cents) > 0) ? '$0' : money(job.amount_cents) + (job.status === 'paid' ? ' paid' : ' open');
      bits.push('The job fee is ' + due + ' on a job of ' + money(job.job_cents) + '.');
    }
    if (!bits.length) return '';
    return '<p class="hold-line">' + bits.map(function(bit){ return esc(bit); }).join(' ') +
      (!lead && name === 'wants home visit' ? ' <button type="button" data-act="start-lead">Start the lead fee</button>' : '') +
      '</p>';
  }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function shiftStamp(value, days, hours){
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(stamp(value));
    if (!match) return '';
    var date = new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
    if (days) date.setDate(date.getDate() + days);
    if (hours) date.setTime(date.getTime() + hours * 3600000);
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + 'T' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }
  function seasonalDue(started, month, day){
    var match = /^(\d{4})/.exec(stamp(started));
    if (!match || !month || !day) return '';
    var year = +match[1];
    var candidate = year + '-' + pad2(month) + '-' + pad2(day) + 'T09:00';
    if (candidate < stamp(started)) candidate = (year + 1) + '-' + pad2(month) + '-' + pad2(day) + 'T09:00';
    return candidate;
  }
  function cadenceStepsFor(key){
    return cadenceSteps.filter(function(step){ return step.sequence_key === key; })
      .slice().sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
  }
  function cadenceNeedsEvent(key){
    return cadenceStepsFor(key).some(function(step){ return step.timing === 'event'; });
  }
  function cadenceDue(step, run){
    if (!run) return '';
    if (step.timing === 'event') return run.anchor_at ? shiftStamp(run.anchor_at, 0, Number(step.hour_offset || 0)) : '';
    if (step.timing === 'calendar') return seasonalDue(run.started_at, Number(step.month || 0), Number(step.day_of_month || 0));
    return shiftStamp(run.started_at, Number(step.day_offset || 0), 0);
  }
  function cadenceChannel(channel){
    if (channel === 'sms') return 'Text';
    if (channel === 'call') return 'Call';
    return 'Email';
  }
  function cadenceAsk(ask){
    if (ask === 'hard') return 'Hard ask';
    if (ask === 'soft') return 'Soft ask';
    if (ask === 'none') return 'No ask';
    return 'Reminder';
  }
  function cadenceResult(result){
    if (result === 'answered') return 'Answered';
    if (result === 'voicemail') return 'Voicemail';
    if (result === 'no_answer') return 'No answer';
    return '';
  }
  function ensureCadence(id){
    if (!id || cadenceRuns[id]) return;
    cadenceRuns[id] = {loading: true};
    api('/office/cadence-run?registration_id=' + id).then(function(data){
      cadenceRuns[id] = {loading: false, run: data && data.run ? data.run : null, outcomes: rows(data && data.outcomes)};
      if (selectedId === id) detail(selectedFamily());
    }).catch(function(){
      cadenceRuns[id] = {loading: false, run: null, outcomes: [], error: true};
      if (selectedId === id) detail(selectedFamily());
    });
  }
  function cadencePanel(family){
    ensureCadence(family.id);
    var bag = cadenceRuns[family.id];
    if (!bag || bag.loading) return '<section class="cadence-card"><h3>Cadence</h3><p>Loading the schedule…</p></section>';
    if (bag.error) return '<section class="cadence-card"><h3>Cadence</h3><p>The schedule could not be loaded.</p></section>';
    var run = bag.run && bag.run.status === 'active' ? bag.run : null;
    var sequence = run ? cadenceSequences.filter(function(item){ return item.key === run.sequence_key; })[0] : null;
    var showAnchor = cadenceNeedsEvent(run ? run.sequence_key : '');
    var picker = '<label for="cadence-pick">Sequence <select id="cadence-pick">' +
      '<option value="">Choose a cadence</option>' +
      cadenceSequences.map(function(item){
        return '<option value="' + esc(item.key) + '"' + (run && run.sequence_key === item.key ? ' selected' : '') + '>' + esc(item.name) + '</option>';
      }).join('') + '</select></label>';
    var anchorValue = run && run.anchor_at ? run.anchor_at : (family.occurrence || '');
    var anchor = '<label for="cadence-anchor"' + (showAnchor || !run ? '' : ' hidden') + '>Session time <input id="cadence-anchor" type="datetime-local" value="' + esc(anchorValue) + '"></label>';
    var buttons = '<div class="cadence-actions"><button type="button" data-cadence="start">Start</button>' +
      (run ? '<button type="button" data-cadence="anchor">Save session time</button><button type="button" data-cadence="stop">Stop</button>' : '') +
      '</div><p class="status-line" id="cadence-status" role="status"></p>';
    var now = zonedNow(family.zone);
    var items = '';
    if (run && sequence) {
      items = '<ol>' + cadenceStepsFor(run.sequence_key).map(function(step){
        var due = cadenceDue(step, run);
        var outcome = (bag.outcomes || []).filter(function(item){
          return item.step_id === step.id && (!item.recorded_at || !run.started_at || item.recorded_at >= run.started_at);
        })[0];
        var state = step.channel === 'call'
          ? (outcome ? cadenceResult(outcome.result) : (due && due > now ? 'Scheduled' : 'Call due'))
          : (!due ? 'Set the session time' : (due > now ? 'Scheduled' : 'Waiting to send'));
        var calls = step.channel === 'call'
          ? '<div class="cadence-actions">' +
            '<button type="button" data-cadence="result" data-step="' + step.id + '" data-result="answered" aria-pressed="' + (outcome && outcome.result === 'answered') + '">Answered</button>' +
            '<button type="button" data-cadence="result" data-step="' + step.id + '" data-result="voicemail" aria-pressed="' + (outcome && outcome.result === 'voicemail') + '">Voicemail</button>' +
            '<button type="button" data-cadence="result" data-step="' + step.id + '" data-result="no_answer" aria-pressed="' + (outcome && outcome.result === 'no_answer') + '">No answer</button>' +
            '</div>'
          : '';
        var extra = step.companion_key ? '<p><a href="/admin/messages/?key=' + encodeURIComponent(step.companion_key) + '">Open the ' + (step.channel === 'sms' ? 'email' : 'text') + '</a></p>' : '';
        var calendar = step.calendar_invite ? ' · Calendar invite' : '';
        return '<li><p class="when">' + esc(step.when_label) + ' · ' + cadenceChannel(step.channel) + ' · ' + esc(cadenceAsk(step.ask)) + calendar + '</p>' +
          '<p>' + esc(step.intent) + '</p>' +
          '<p>' + (due ? 'Due ' + esc(pretty(due)) + ' · ' : '') + esc(state) + '</p>' +
          '<p><a href="/admin/messages/?key=' + encodeURIComponent(step.message_key) + '">Open the ' + (step.channel === 'call' ? 'script' : step.channel === 'sms' ? 'text' : 'email') + '</a></p>' +
          extra + calls + '</li>';
      }).join('') + '</ol>';
    }
    return '<section class="cadence-card"><h3>Cadence</h3>' +
      (sequence ? '<p>' + esc(sequence.name) + ' started ' + esc(pretty(run.started_at) || run.started_at) + '.</p>' : '<p>No cadence is running.</p>') +
      picker + anchor + buttons + items + '</section>';
  }
  function stageField(family){
    if (!stages.length) return '';
    var current = stageFor(family);
    return '<label class="stage-pick">Stage <select id="stage-select">' + stages.map(function(stage){
      return '<option value="' + stage.id + '"' + (stage.id === current ? ' selected' : '') + '>' + esc(stage.name) + '</option>';
    }).join('') + '</select></label>';
  }
  function detail(family){
    if (!family) {
      document.getElementById('detail').innerHTML = '<p class="waiting">No one is in this view.</p>';
      return;
    }
    var retired = isRetired(family);
    var away = callLive() && dial.registrationId !== family.id
      ? '<div class="on-call"><p>On a call with ' + esc(dial.name) + '</p><button type="button" data-act="return-call">Return</button><button type="button" class="hangup" data-act="hangup">Hang up</button></div>'
      : '';
    var banner = retired ? '<p class="retired-banner">Retired' + (REASONS[family.row.retired_reason] ? ' · ' + esc(REASONS[family.row.retired_reason]) : '') + '</p>' : '';
    var callbackWhen = wantsCallback(family) ? callbackPhrase(family) : '';
    var callbackBanner = wantsCallback(family) ? '<p class="callback-banner">Asked for a call back' + (callbackWhen ? ' · ' + esc(callbackWhen) : '') + ' <button type="button" data-act="clear-callback">Callback done</button></p>' : '';
    document.getElementById('detail').innerHTML =
      away +
      '<div class="detail-top">' +
      '<div class="detail-id">' +
      '<h2>' + esc(family.row.name) + '</h2>' +
      '<p class="session">' + esc(family.title) + ' · ' + esc(family.when) + '</p>' +
      (family.row.readiness_note ? '<p class="split-note">' + esc(family.row.readiness_note) + '</p>' : '') +
      banner +
      callbackBanner +
      '</div>' +
      '<div class="detail-actions">' +
      contractorField(family) +
      stageField(family) +
      holdLine(family) +
      attendHtml(family) +
      '<button type="button" class="call-notes" data-act="call-notes" aria-pressed="' + (window.AIPA_CALL_NOTES && window.AIPA_CALL_NOTES.current() === family.id ? 'true' : 'false') + '">Call notes</button>' +
      '<div class="reach" role="group" aria-label="Reach this person">' +
      '<button type="button" data-act="call" aria-pressed="' + (reachMode === 'call') + '">Call</button>' +
      '<button type="button" data-act="text" aria-pressed="' + (reachMode === 'text') + '">Text</button>' +
      '<button type="button" data-act="email" aria-pressed="' + (reachMode === 'email') + '">Email</button>' +
      '<button type="button" data-act="sms-agree" aria-pressed="' + (reachMode === 'sms-agree') + '">Text agreement</button>' +
      '<button type="button" data-act="' + (retired ? 'restore' : 'retire') + '" aria-pressed="' + (reachMode === 'retire' || reachMode === 'restore') + '">' + (retired ? 'Bring back' : 'Retire') + '</button>' +
      '</div></div></div>' +
      cadencePanel(family) +
      reachPanel(family) +
      band(family);
    fromClick = false;
  }
  function counts(list){
    document.getElementById('count-all').textContent = list.length;
    document.getElementById('count-7').textContent = list.filter(function(family){ return !family.upcoming && family.days >= 7; }).length;
    document.getElementById('count-14').textContent = list.filter(function(family){ return !family.upcoming && family.days >= 14; }).length;
    document.getElementById('count-30').textContent = list.filter(function(family){ return !family.upcoming && family.days >= 30; }).length;
    document.getElementById('count-never').textContent = list.filter(function(family){ return family.never; }).length;
  }
  function contractorOptions(selected){
    var current = Number(selected) || 0;
    return '<option value="0"' + (current ? '' : ' selected') + '>No contractor</option>' +
      contractors.map(function(contractor){
        return '<option value="' + contractor.id + '"' + (contractor.id === current ? ' selected' : '') + '>' + esc(contractor.name) + '</option>';
      }).join('');
  }
  function drawContractorFilter(){
    var select = document.getElementById('contractor-filter');
    if (!select) return;
    var stamp = contractors.map(function(contractor){ return contractor.id + ':' + contractor.name; }).join('|');
    if (stamp === contractorFilterStamp && select.value === contractorFilter) return;
    contractorFilterStamp = stamp;
    select.innerHTML = '<option value="">All contractors</option><option value="0">No contractor</option>' +
      contractors.map(function(contractor){
        return '<option value="' + contractor.id + '">' + esc(contractor.name) + '</option>';
      }).join('');
    select.value = contractorFilter;
    if (select.value !== contractorFilter) {
      contractorFilter = '';
      select.value = '';
    }
  }
  function drawContractors(){
    var list = document.getElementById('contractor-list');
    if (list) {
      list.innerHTML = contractors.length ? contractors.map(function(contractor){
        return '<li><b>' + contractor.id + '</b> ' + esc(contractor.name) + '</li>';
      }).join('') : '<li>No contractors yet.</li>';
    }
    var select = document.querySelector('#family-form [name="contractor_id"]');
    if (select) {
      var current = select.value;
      select.innerHTML = contractorOptions(current);
    }
  }
  function render(){
    drawContractorFilter();
    drawContractors();
    var activePool = families.filter(inContractor);
    counts(activePool);
    var list = visible();
    if (!list.some(function(family){ return family.id === selectedId; })) {
      selectedId = list.length ? list[0].id : 0;
    }
    document.getElementById('pipeline').innerHTML = pipelineHtml(list);
    bindPipeline();
    detail(list.filter(function(family){ return family.id === selectedId; })[0] || null);
  }

  function load(){
    var status = document.getElementById('dash-status');
    status.textContent = 'Loading…';
    return Promise.all([
      api('/office/meetings'),
      api('/office/signups'),
      api('/office/touches').catch(function(){ return []; }),
      api('/office/pipeline'),
      (window.AIPA_MESSAGES ? AIPA_MESSAGES.load() : Promise.resolve()),
      api('/office/households'),
      api('/office/billing').catch(function(){ return {bills:[]}; }),
      api('/office/cadences').catch(function(){ return {sequences:[], steps:[]}; })
    ]).then(function(result){
      var meetings = rows(result[0]);
      var signups = rows(result[1]);
      var touches = rows(result[2]);
      var pipeline = result[3] || {};
      var household = result[5] || {};
      bills = rows((result[6] || {}).bills);
      var cadence = result[7] || {};
      cadenceSequences = rows(cadence.sequences).slice().sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
      cadenceSteps = rows(cadence.steps);
      stages = rows(pipeline.stages).slice().sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
      places = {};
      rows(pipeline.places).forEach(function(place){ places[place.registration_id] = place.stage_id; });
      contractors = rows(household.contractors);
      profiles = {};
      rows(household.profiles).forEach(function(profile){ profiles[profile.registration_id] = profile; });
      families = signups.filter(function(row){
        var meeting = meetings.filter(function(item){ return item.id === row.meeting_id; })[0];
        if (meeting && meeting.meeting_type === 'family_1_1') return true;
        return !row.meeting_id;
      }).map(function(row){
        var meeting = meetings.filter(function(item){ return item.id === row.meeting_id; })[0];
        return build(row, meeting, touches, profiles[row.id] || null);
      });
      status.textContent = '';
      render();
    }).catch(function(err){
      status.textContent = err.message;
    });
  }

  function selectedFamily(){
    return families.filter(function(family){ return family.id === selectedId; })[0] || null;
  }
  function stopTimer(){
    if (dial.timer) clearInterval(dial.timer);
    dial.timer = 0;
  }
  function startTimer(){
    stopTimer();
    dial.timer = setInterval(function(){
      var el = document.getElementById('call-timer');
      if (!el || !dial.started) return;
      var seconds = Math.max(0, Math.floor((Date.now() - dial.started) / 1000));
      var minute = Math.floor(seconds / 60);
      var rest = seconds % 60;
      el.textContent = minute + ':' + (rest < 10 ? '0' : '') + rest;
    }, 1000);
  }
  function finishCall(message){
    stopTimer();
    dial.phase = 'ended';
    dial.error = message || 'Call ended.';
    dial.call = null;
    reachMode = 'call';
    render();
    setTimeout(function(){ load(); }, 1200);
  }
  function bindCall(call){
    dial.call = call;
    call.on('ringing', function(){ dial.phase = 'ringing'; render(); });
    call.on('accept', function(){
      dial.phase = 'open';
      dial.started = Date.now();
      startTimer();
      render();
    });
    call.on('disconnect', function(){ finishCall('Call ended.'); });
    call.on('cancel', function(){ finishCall('Call canceled.'); });
    call.on('reject', function(){ finishCall('The call was declined.'); });
    call.on('error', function(err){
      stopTimer();
      dial.phase = 'error';
      dial.error = (err && err.message) || 'The call failed.';
      dial.call = null;
      render();
    });
  }
  function placeCall(family){
    var picked = document.querySelector('input[name="reach-who"]:checked');
    var status = document.getElementById('reach-status');
    if (!picked) {
      if (status) status.textContent = 'Choose who to call.';
      return;
    }
    var person = contacts(family.row).filter(function(item){ return (e164(item.phone) || item.phone) === picked.value; })[0];
    dial.registrationId = family.id;
    dial.name = person && person.name ? person.name : family.row.name;
    dial.number = picked.value;
    dial.phase = 'connecting';
    dial.muted = false;
    dial.error = '';
    dial.started = 0;
    reachMode = 'call';
    render();
    api('/office/voice-token', {method:'POST', body:{}}).then(function(data){
      if (!data.configured || !data.token) {
        dial.phase = 'error';
        dial.error = data.message || 'Twilio voice is not connected yet.';
        render();
        return null;
      }
      if (!window.Twilio || !window.Twilio.Device) {
        dial.phase = 'error';
        dial.error = 'The dialer did not load.';
        render();
        return null;
      }
      if (!dial.device || dial.token !== data.token) {
        if (dial.device) dial.device.destroy();
        dial.device = new window.Twilio.Device(data.token, {closeProtection:true});
        dial.token = data.token;
        dial.device.on('error', function(err){
          if (!callLive()) return;
          stopTimer();
          dial.phase = 'error';
          dial.error = (err && err.message) || 'The dialer hit a problem.';
          render();
        });
      }
      return Promise.resolve(dial.device.connect({params:{To:dial.number, registration_id:String(family.id)}}));
    }).then(function(call){
      if (call) bindCall(call);
    }).catch(function(err){
      stopTimer();
      dial.phase = 'error';
      dial.error = err.message || 'The call could not start.';
      render();
    });
  }
  function sendMessage(family, channel){
    var picked = document.querySelector('input[name="reach-who"]:checked');
    var body = document.querySelector('[name="reach-body"]');
    var subject = document.querySelector('[name="reach-subject"]');
    var status = document.getElementById('reach-status');
    if (!picked) { if (status) status.textContent = 'Choose who to reach.'; return; }
    if (!body || !body.value.trim()) { if (status) status.textContent = 'Write the message first.'; return; }
    if (body.value.indexOf('{{guide}}') !== -1 && !String(family.row.suggested_title || '').trim()) {
      if (status) status.textContent = 'Pick a guide so {{guide}} has a name.';
      return;
    }
    if (status) status.textContent = channel === 'sms' ? 'Sending the text…' : 'Sending the email…';
    api('/office/send', {method:'POST', body:{
      registration_id: family.id,
      channel: channel,
      to: picked.value,
      subject: subject ? subject.value : '',
      body: mergeGuide(body.value, family.row.suggested_title)
    }}).then(function(data){
      if (!data.configured || data.ok === false) {
        if (status) status.textContent = data.message || 'This was not sent.';
        return;
      }
      reachMode = '';
      load();
    }).catch(function(err){ if (status) status.textContent = err.message; });
  }
  function sendSmsAgree(family){
    var status = document.getElementById('reach-status');
    if (status) status.textContent = 'Sending the link…';
    api('/office/sms-opt-in', {method:'POST', body:{registration_id: family.id}}).then(function(data){
      if (data.sent) {
        reachMode = '';
        load();
        return;
      }
      if (status) status.textContent = (data.message || 'This was not sent.') + (data.link ? ' Copy this link: ' + data.link : '');
    }).catch(function(err){ if (status) status.textContent = err.message; });
  }
  function retireFamily(family, engagement){
    var status = document.getElementById('reach-status');
    var reason = document.querySelector('[name="reason"]');
    var note = document.querySelector('[name="note"]');
    if (engagement === 'retired' && (!reason || !reason.value)) {
      if (status) status.textContent = 'Choose why they are retiring.';
      return;
    }
    if (status) status.textContent = engagement === 'retired' ? 'Retiring…' : 'Bringing them back…';
    api('/office/family-retire', {method:'POST', body:{
      registration_id: family.id,
      engagement: engagement,
      reason: reason ? reason.value : '',
      note: note ? note.value : ''
    }}).then(function(){
      reachMode = '';
      load();
    }).catch(function(err){ if (status) status.textContent = err.message; });
  }
  function saveCadence(family, body){
    var line = document.getElementById('cadence-status');
    if (line) line.textContent = 'Saving the schedule…';
    return api('/office/cadence-run', {method:'POST', body: body}).then(function(){
      delete cadenceRuns[family.id];
      ensureCadence(family.id);
    }).catch(function(err){
      if (line) line.textContent = err.message;
    });
  }
  document.getElementById('detail').addEventListener('click', function(event){
    var cadenceButton = event.target.closest('[data-cadence]');
    if (cadenceButton) {
      var family = selectedFamily();
      if (!family) return;
      var bag = cadenceRuns[family.id] || {};
      var run = bag.run || null;
      var pick = document.getElementById('cadence-pick');
      var anchorField = document.getElementById('cadence-anchor');
      var action = cadenceButton.getAttribute('data-cadence');
      if (action === 'result') {
        var line = document.getElementById('cadence-status');
        if (line) line.textContent = 'Saving the call…';
        api('/office/cadence-outcome', {method:'POST', body:{
          registration_id: family.id,
          step_id: Number(cadenceButton.getAttribute('data-step')),
          result: cadenceButton.getAttribute('data-result'),
          recorded_at: zonedNow(family.zone)
        }}).then(function(){
          delete cadenceRuns[family.id];
          ensureCadence(family.id);
        }).catch(function(err){ if (line) line.textContent = err.message; });
        return;
      }
      if (action === 'stop') {
        saveCadence(family, {
          registration_id: family.id,
          sequence_key: run ? run.sequence_key : '',
          started_at: run ? run.started_at : zonedNow(family.zone),
          anchor_at: run ? run.anchor_at : zonedNow(family.zone),
          status: 'stopped'
        });
        return;
      }
      if (action === 'anchor') {
        if (!run) return;
        saveCadence(family, {
          registration_id: family.id,
          sequence_key: run.sequence_key,
          started_at: run.started_at,
          anchor_at: anchorField && anchorField.value ? anchorField.value : run.anchor_at,
          status: 'active'
        });
        return;
      }
      var key = pick ? pick.value : '';
      var lineStart = document.getElementById('cadence-status');
      if (!key) { if (lineStart) lineStart.textContent = 'Choose a cadence.'; return; }
      var started = zonedNow(family.zone);
      var anchor = anchorField && anchorField.value ? anchorField.value : (cadenceNeedsEvent(key) ? (family.occurrence || started) : started);
      saveCadence(family, {
        registration_id: family.id,
        sequence_key: key,
        started_at: started,
        anchor_at: anchor,
        status: 'active'
      });
      return;
    }
    var tabBtn = event.target.closest('[data-tab]');
    if (tabBtn && tabBtn.closest('.band-tabs')) {
      detailTab = tabBtn.dataset.tab;
      detailTabFor = selectedId;
      render();
      return;
    }
    var button = event.target.closest('[data-act]');
    if (!button) return;
    var act = button.dataset.act;
    var family = selectedFamily();
    if (act === 'start-lead') {
      if (!family) return;
      startLead(family);
      return;
    }
    if (act === 'clear-callback') {
      if (!family) return;
      api('/office/callback', {method:'POST', body:{registration_id: family.id, requested: false}})
        .then(function(){ load(); })
        .catch(function(err){
          var line = document.getElementById('dash-status');
          if (line) line.textContent = err.message;
        });
      return;
    }
    if (act === 'hangup') {
      if (dial.call) dial.call.disconnect();
      else finishCall('Call canceled.');
      return;
    }
    if (act === 'return-call') {
      selectedId = dial.registrationId;
      reachMode = 'call';
      fromClick = true;
      render();
      return;
    }
    if (!family) return;
    if (act === 'call-notes') {
      if (window.AIPA_CALL_NOTES) window.AIPA_CALL_NOTES.open(family.id);
      return;
    }
    if (act === 'attend') {
      var kind = button.getAttribute('data-kind');
      var turningOn = button.getAttribute('aria-pressed') !== 'true';
      api('/office/attendance', {method:'POST', body:{registration_id: family.id, kind: kind, attended: turningOn}}).then(function(){
        reachMode = turningOn ? 'invite' : (reachMode === 'invite' ? '' : reachMode);
        if (!turningOn) pendingInvite = null;
        return load();
      }).catch(function(err){
        var line = document.getElementById('dash-status');
        if (line) line.textContent = err.message;
      });
      return;
    }
    if (act === 'invite-email' || act === 'invite-text') {
      pendingInvite = inviteCopy(family);
      reachMode = act === 'invite-email' ? 'email' : 'text';
      render();
      return;
    }
    if (act === 'call' || act === 'text' || act === 'email' || act === 'sms-agree' || act === 'invite' || act === 'retire' || act === 'restore') {
      if (act === 'call' || act === 'text' || act === 'email') pendingInvite = null;
      if (callLive() && act === 'call') { reachMode = 'call'; render(); return; }
      reachMode = reachMode === act ? '' : act;
      render();
      if (act === 'email' && reachMode === 'email' && family.row.suggested_slug && !family.handoutUrl) {
        var slug = family.row.suggested_slug;
        var id = family.id;
        fetch((CFG.apiBase || '').replace(/\/$/, '') + '/library/article?slug=' + encodeURIComponent(slug), {headers:{'Accept':'application/json'}})
          .then(function(r){ return r.json(); })
          .then(function(article){
            if (!article || !article.pdf_url || selectedId !== id || reachMode !== 'email') return;
            var before = guideMail(family).body;
            family.handoutUrl = /^https?:/i.test(article.pdf_url) ? article.pdf_url : ('https://goaipa.com' + article.pdf_url);
            var box = document.querySelector('[name="reach-body"]');
            if (box && box.value === before) box.value = guideMail(family).body;
          })
          .catch(function(){});
      }
      return;
    }
    if (act === 'close') {
      reachMode = '';
      pendingInvite = null;
      if (!callLive()) { dial.phase = ''; dial.error = ''; }
      render();
      return;
    }
    if (act === 'mute' && dial.call) {
      dial.muted = !dial.muted;
      dial.call.mute(dial.muted);
      render();
    }
  });
  document.getElementById('detail').addEventListener('submit', function(event){
    var form = event.target;
    if (!form || !form.dataset || !form.dataset.reach) return;
    event.preventDefault();
    var family = selectedFamily();
    if (!family) return;
    if (form.dataset.reach === 'call') placeCall(family);
    else if (form.dataset.reach === 'text') sendMessage(family, 'sms');
    else if (form.dataset.reach === 'email') sendMessage(family, 'email');
    else if (form.dataset.reach === 'sms-agree') sendSmsAgree(family);
    else if (form.dataset.reach === 'retire') retireFamily(family, 'retired');
    else if (form.dataset.reach === 'restore') retireFamily(family, 'active');
  });

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
      return '<li data-index="' + index + '"><input value="' + esc(stage.name) + '" aria-label="Stage name" maxlength="40">' +
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
    api('/office/pipeline', {method:'POST', body:{stages: JSON.stringify(stageDraft.map(function(stage){
      return {id: stage.id || 0, name: stage.name};
    }))}}).then(function(){
      document.getElementById('stage-editor').hidden = true;
      status.textContent = '';
      load();
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('detail').addEventListener('change', function(event){
    if (!event.target) return;
    if (event.target.id === 'contractor-select') {
      var picked = selectedFamily();
      if (!picked) return;
      var note = document.getElementById('dash-status');
      api('/office/household-contractor', {method:'POST', body:{
        registration_id: picked.id,
        contractor_id: Number(event.target.value) || 0
      }}).then(function(){ load(); }).catch(function(err){
        note.textContent = err.message;
        load();
      });
      return;
    }
    if (event.target.id !== 'stage-select') return;
    var family = selectedFamily();
    if (!family) return;
    movePerson(family.id, Number(event.target.value));
  });
  document.getElementById('job-form').addEventListener('submit', function(event){
    event.preventDefault();
    var box = document.getElementById('job-ask');
    var input = document.getElementById('job-total');
    if (!box || !input) return;
    movePerson(Number(box.dataset.id), Number(box.dataset.stage), input.value);
  });
  document.getElementById('job-cancel').addEventListener('click', function(){
    document.getElementById('job-ask').hidden = true;
    document.getElementById('job-status').textContent = '';
    render();
  });

  function parseCsv(text){
    var rows = [];
    var row = [];
    var cell = '';
    var quoted = false;
    var source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (var i = 0; i < source.length; i++) {
      var ch = source.charAt(i);
      if (quoted) {
        if (ch === '"') {
          if (source.charAt(i + 1) === '"') { cell += '"'; i += 1; }
          else quoted = false;
        } else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function headerKey(value){
    return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  }
  var CSV_HEADER = {
    'first name':'first_name', 'last name':'last_name',
    'address 1':'address_1', 'address1':'address_1', 'address 2':'address_2', 'address2':'address_2',
    'city':'city', 'state':'state', 'zip':'zip', 'zip code':'zip',
    'email':'email', 'email address':'email',
    'cell phone':'cell_phone', 'cell':'cell_phone', 'phone':'cell_phone',
    'opt in for phone call':'opt_in_call', 'opt in for phone call flag':'opt_in_call',
    'opt in call':'opt_in_call', 'opt in phone':'opt_in_call',
    'opt in for email':'opt_in_email', 'opt in for email flag':'opt_in_email', 'opt in email':'opt_in_email',
    'date of originating record creation':'originated_at', 'originated':'originated_at', 'originated at':'originated_at',
    'notes':'notes', 'note':'notes',
    'contractor internal id':'contractor_id', 'contractor id':'contractor_id'
  };
  var CSV_REQUIRED = [
    ['first_name','first name'], ['last_name','last name'], ['address_1','address 1'], ['address_2','address 2'],
    ['city','city'], ['state','state'], ['zip','zip'], ['email','email'], ['cell_phone','cell phone'],
    ['opt_in_call','opt in for phone call'], ['opt_in_email','opt in for email'],
    ['originated_at','date of originating record creation'], ['notes','notes'], ['contractor_id','contractor internal id']
  ];
  function rowsFromCsv(text){
    var table = parseCsv(text);
    if (!table.length) return {error:'The file is empty.'};
    var index = {};
    table[0].forEach(function(name, i){
      var key = CSV_HEADER[headerKey(name)];
      if (key && index[key] == null) index[key] = i;
    });
    var missing = CSV_REQUIRED.filter(function(pair){ return index[pair[0]] == null; }).map(function(pair){ return pair[1]; });
    if (missing.length) return {error:'This file is missing a column for ' + missing.join(', ') + '.'};
    var out = [];
    for (var r = 1; r < table.length; r++) {
      var cells = table[r];
      if (!cells.some(function(value){ return String(value || '').trim(); })) continue;
      var item = {row: r + 1};
      CSV_REQUIRED.forEach(function(pair){
        item[pair[0]] = cells[index[pair[0]]] == null ? '' : cells[index[pair[0]]];
      });
      out.push(item);
    }
    if (!out.length) return {error:'The file has a header and no families.'};
    if (out.length > 200) return {error:'Upload 200 families at a time.'};
    return {rows: out};
  }
  function familyMessage(data){
    var created = data && data.created ? data.created : 0;
    var messages = rows(data && data.errors).map(function(item){ return item.message || ''; }).filter(Boolean);
    if (!created && messages.length) return messages.join(' ');
    var lead = created === 1 ? 'Added 1 family to the first column.' : 'Added ' + created + ' families to the first column.';
    if (!messages.length) return lead;
    return lead + ' ' + messages.join(' ') + ' Uploading this file again will add the families that already went in a second time.';
  }
  function postFamilies(list){
    var status = document.getElementById('family-status');
    status.textContent = 'Saving…';
    return api('/office/households', {method:'POST', body:{rows: JSON.stringify(list)}}).then(function(data){
      status.textContent = familyMessage(data);
      if (data && data.created) {
        var form = document.getElementById('family-form');
        if (form) form.reset();
        return load();
      }
    }).catch(function(err){ status.textContent = err.message; });
  }
  document.getElementById('contractor-filter').addEventListener('change', function(event){
    contractorFilter = event.target.value;
    render();
  });
  document.getElementById('family-open').addEventListener('click', function(){
    document.getElementById('family-status').textContent = '';
    document.getElementById('family-editor').hidden = false;
    drawContractors();
  });
  document.getElementById('family-cancel').addEventListener('click', function(){
    document.getElementById('family-editor').hidden = true;
  });
  document.getElementById('contractors-open').addEventListener('click', function(){
    document.getElementById('contractor-status').textContent = '';
    document.getElementById('contractor-editor').hidden = false;
    drawContractors();
  });
  document.getElementById('contractor-close').addEventListener('click', function(){
    document.getElementById('contractor-editor').hidden = true;
  });
  document.getElementById('contractor-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('contractor-status');
    status.textContent = 'Saving…';
    api('/office/contractor', {method:'POST', body:{name: event.target.name.value}}).then(function(){
      event.target.reset();
      status.textContent = 'Added.';
      load();
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('family-form').addEventListener('submit', function(event){
    event.preventDefault();
    var form = event.target;
    postFamilies([{
      row: 1,
      first_name: form.first_name.value,
      last_name: form.last_name.value,
      address_1: form.address_1.value,
      address_2: form.address_2.value,
      city: form.city.value,
      state: form.state.value,
      zip: form.zip.value,
      email: form.email.value,
      cell_phone: form.cell_phone.value,
      opt_in_call: form.opt_in_call.checked ? 'yes' : 'no',
      opt_in_email: form.opt_in_email.checked ? 'yes' : 'no',
      originated_at: form.originated_at.value,
      notes: form.notes.value,
      contractor_id: form.contractor_id.value || '0'
    }]);
  });
  document.getElementById('family-upload').addEventListener('click', function(){
    var input = document.getElementById('family-csv');
    var status = document.getElementById('family-status');
    var file = input.files && input.files[0];
    if (!file) { status.textContent = 'Choose a CSV file.'; return; }
    var reader = new FileReader();
    reader.onload = function(){
      var parsed = rowsFromCsv(String(reader.result || ''));
      if (parsed.error) { status.textContent = parsed.error; return; }
      postFamilies(parsed.rows).then(function(){ input.value = ''; });
    };
    reader.onerror = function(){ status.textContent = 'That file could not be read.'; };
    reader.readAsText(file);
  });

  document.getElementById('login-form').addEventListener('submit', function(e){
    e.preventDefault();
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
  signout.addEventListener('click', function(event){
    event.preventDefault();
    sessionStorage.removeItem(KEY);
    showLogin(true);
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
  window.addEventListener('aipa-family-changed', function(){ load(); });
  if (token()) { showLogin(false); load(); }
  else showLogin(true);
})();
