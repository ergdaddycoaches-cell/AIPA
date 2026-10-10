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
  var stages = [];
  var places = {};
  var stageDraft = [];
  var detailTab = 'summary';
  var detailTabFor = 0;
  var contractors = [];
  var profiles = {};
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
  function movePerson(id, stageId){
    var family = families.filter(function(item){ return item.id === id; })[0];
    if (!family || !stageId || stageFor(family) === stageId) return;
    places[id] = stageId;
    render();
    api('/office/pipeline-move', {method:'POST', body:{registration_id:id, stage_id:stageId}}).catch(function(err){
      var line = document.getElementById('dash-status');
      if (line) line.textContent = err.message;
      load();
    });
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
        timelineNote(event) + '</li>';
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
    return !!(addressLine(profile) || profile.notes || profile.originated_at || profile.opt_in_call || profile.opt_in_email || family.row.email || family.row.phone);
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
  function emailDraft(family){
    var note = String(family.row.follow_up_note || '').trim();
    var slug = String(family.row.suggested_slug || '').trim();
    if (!slug) return note;
    var pdf = family.handoutUrl || ('https://goaipa.com/library/pdf/' + slug + '.pdf');
    var book = 'https://goaipa.com/ask-anything/';
    if (note.indexOf(pdf) !== -1) return note;
    var handout = 'Print this guide:\n' + pdf + '\n\nBook an Ask Anything 1:1:\n' + book + '\nOr call 833-AIPA-HUB.';
    return note ? note + '\n\n' + handout : handout;
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
    if (reachMode === 'text') {
      return '<form class="composer" data-reach="text">' + phones +
        '<label for="reach-body">Text</label><textarea id="reach-body" name="reach-body" rows="4" required>' + esc(family.row.follow_up_note || '') + '</textarea>' +
        '<div class="composer-actions"><button class="btn" type="submit">Send text</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    if (reachMode === 'email') {
      var subject = family.row.suggested_title ? 'A guide: ' + family.row.suggested_title : 'Following up on our conversation';
      return '<form class="composer" data-reach="email">' + emails +
        '<label for="reach-subject">Subject</label><input id="reach-subject" name="reach-subject" type="text" required value="' + esc(subject) + '">' +
        '<label for="reach-body">Email</label><textarea id="reach-body" name="reach-body" rows="8" required>' + esc(emailDraft(family)) + '</textarea>' +
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
      '<button type="button" class="call-notes" data-act="call-notes" aria-pressed="' + (window.AIPA_CALL_NOTES && window.AIPA_CALL_NOTES.current() === family.id ? 'true' : 'false') + '">Call notes</button>' +
      '<div class="reach" role="group" aria-label="Reach this person">' +
      '<button type="button" data-act="call" aria-pressed="' + (reachMode === 'call') + '">Call</button>' +
      '<button type="button" data-act="text" aria-pressed="' + (reachMode === 'text') + '">Text</button>' +
      '<button type="button" data-act="email" aria-pressed="' + (reachMode === 'email') + '">Email</button>' +
      '<button type="button" data-act="' + (retired ? 'restore' : 'retire') + '" aria-pressed="' + (reachMode === 'retire' || reachMode === 'restore') + '">' + (retired ? 'Bring back' : 'Retire') + '</button>' +
      '</div></div></div>' +
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

  function renderUnmatched(list){
    var box = document.getElementById('unmatched');
    var target = document.getElementById('unmatched-list');
    if (!box || !target) return;
    box.hidden = list.length === 0;
    var options = families.slice().sort(function(a, b){
      return a.row.name.localeCompare(b.row.name);
    }).map(function(family){
      return '<option value="' + family.id + '">' + esc(family.row.name) + (isRetired(family) ? ' (retired)' : '') + '</option>';
    }).join('');
    target.innerHTML = list.map(function(item){
      var who = item.direction === 'out' ? item.to_address : item.from_address;
      var what = item.channel === 'email' ? 'Email' : (item.channel === 'voicemail' ? 'Voicemail' : 'Text');
      var way = item.direction === 'out' ? 'to' : 'from';
      var line = item.body || item.subject || '';
      return '<li><strong>' + esc(what) + ' ' + esc(way) + ' ' + esc(who || 'unknown') + '</strong>' +
        (line ? '<span>' + esc(line) + '</span>' : '') +
        '<form class="attach" data-unmatched="' + item.id + '"><label>Person <select name="registration_id" required><option value="">Choose someone</option>' + options + '</select></label><button type="submit">Attach</button><span class="attach-status" role="status"></span></form></li>';
    }).join('');
  }

  function load(){
    var status = document.getElementById('dash-status');
    status.textContent = 'Loading…';
    return Promise.all([
      api('/office/meetings'),
      api('/office/signups'),
      api('/office/touches').catch(function(){ return []; }),
      api('/office/unmatched').catch(function(){ return []; }),
      api('/office/pipeline'),
      api('/office/households')
    ]).then(function(result){
      var meetings = rows(result[0]);
      var signups = rows(result[1]);
      var touches = rows(result[2]);
      var unmatched = rows(result[3]);
      var pipeline = result[4] || {};
      var household = result[5] || {};
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
      renderUnmatched(unmatched);
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
  document.getElementById('detail').addEventListener('click', function(event){
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
    if (act === 'call' || act === 'text' || act === 'email' || act === 'retire' || act === 'restore') {
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
            var before = emailDraft(family);
            family.handoutUrl = /^https?:/i.test(article.pdf_url) ? article.pdf_url : ('https://goaipa.com' + article.pdf_url);
            var box = document.querySelector('[name="reach-body"]');
            if (box && box.value === before) box.value = emailDraft(family);
          })
          .catch(function(){});
      }
      return;
    }
    if (act === 'close') {
      reachMode = '';
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
  signout.addEventListener('click', function(){
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
  var unmatchedBox = document.getElementById('unmatched');
  if (unmatchedBox) unmatchedBox.addEventListener('submit', function(event){
    var form = event.target;
    if (!form || !form.dataset || !form.dataset.unmatched) return;
    event.preventDefault();
    var select = form.querySelector('[name="registration_id"]');
    var note = form.querySelector('.attach-status');
    if (!select || !select.value) {
      if (note) note.textContent = 'Choose someone.';
      return;
    }
    if (note) note.textContent = 'Attaching…';
    api('/office/assign-message', {method:'POST', body:{
      unmatched_id: Number(form.dataset.unmatched),
      registration_id: Number(select.value)
    }}).then(function(){ load(); }).catch(function(err){
      if (note) note.textContent = err.message;
    });
  });
  window.addEventListener('aipa-family-changed', function(){ load(); });
  if (token()) { showLogin(false); load(); }
  else showLogin(true);
})();
