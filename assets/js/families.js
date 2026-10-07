(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var dash = document.getElementById('dash');
  var signout = document.getElementById('signout');
  var families = [];
  var ageFilter = 'all';
  var readyFilter = '';
  var lifeFilter = 'active';
  var callbackFilter = false;
  var reachMode = '';
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

  function build(row, meeting, touches){
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
        events.push({kind:'email', occurred_at:sentAt, note:row.follow_up_note || '', future: sentAt > now});
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
      title: meeting && meeting.title ? meeting.title : 'Family 1:1',
      when: window.AIPA_SEMINAR.format({
        starts_at: occurrence,
        timezone: zone,
        kind: 'one_time'
      }),
      guests: people(row),
      reads: parseList(row.attendee_reads)
    };
  }

  function ageClass(family){
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
  function inReady(family){
    return !readyFilter || family.row.visit_readiness === readyFilter;
  }
  function wantsCallback(family){
    return !!(family && family.row && (family.row.callback_requested === true || family.row.callback_requested === 1));
  }
  function inLife(family){
    return lifeFilter === 'retired' ? isRetired(family) : !isRetired(family);
  }
  function pool(){
    return families.filter(inReady).filter(inLife);
  }
  function visible(){
    var list = callbackFilter ? families.filter(wantsCallback) : pool().filter(inAge);
    var quiet = list.filter(function(family){ return !family.upcoming; });
    var ahead = list.filter(function(family){ return family.upcoming; });
    quiet.sort(function(a, b){ return b.days - a.days || a.row.name.localeCompare(b.row.name); });
    ahead.sort(function(a, b){ return a.occurrence < b.occurrence ? -1 : a.occurrence > b.occurrence ? 1 : 0; });
    return quiet.concat(ahead);
  }

  function spark(family){
    return '<span class="spark" aria-hidden="true">' + family.events.map(function(event){
      var cls = event.kind + (event.future ? ' future' : '');
      return '<span class="' + cls + '"></span>';
    }).join('') + '</span>';
  }
  function card(family){
    var withWhom = family.guests.length ? '<span class="with">with ' + esc(family.guests.map(function(person){ return person.name; }).join(', ')) + '</span>' : '';
    var ready = family.row.visit_readiness || 'unset';
    var word = family.upcoming || family.days === 0 ? ' word' : '';
    var retiredFlag = isRetired(family) ? '<span class="flag retired">' + esc(REASONS[family.row.retired_reason] || 'Retired') + '</span>' : '';
    var callbackFlag = wantsCallback(family) ? '<span class="flag callback">Call back</span>' : '';
    return '<li><button type="button" class="family ' + ageClass(family) + word + (isRetired(family) ? ' retired' : '') + '" data-id="' + family.id + '" aria-current="' + (family.id === selectedId) + '">' +
      '<span class="age"><b>' + esc(ageNumber(family)) + '</b></span>' +
      '<span class="who"><strong>' + esc(family.row.name) + '</strong>' +
      '<span class="since">' + esc(ageCaption(family)) + '</span>' + withWhom +
      '<span class="session">' + esc(family.title) + '</span>' +
      '<span class="flags"><span class="flag ' + esc(ready) + '">' + esc(readiness(family.row.visit_readiness)) + '</span>' + callbackFlag + retiredFlag + '</span>' +
      spark(family) +
      '</span></button></li>';
  }
  function queueHtml(list){
    if (!list.length) {
      return '<p class="empty-queue">No family is in this view.</p>';
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
  function bindQueue(){
    document.querySelectorAll('.family').forEach(function(button){
      button.addEventListener('click', function(){
        selectedId = Number(button.dataset.id);
        fromClick = true;
        render();
      });
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
    return '<div class="note-block"><h3>How they showed up</h3><ul class="reads">' + family.reads.map(function(person){
      var bits = [ROLES[person.role] || '', STYLES[person.style] || ''].filter(Boolean).join(' · ');
      return '<li><strong>' + esc(person.name || '') + '</strong>' +
        (bits ? '<span class="role">' + esc(bits) + '</span>' : '') +
        (person.note ? '<p>' + esc(person.note) + '</p>' : '') + '</li>';
    }).join('') + '</ul></div>';
  }
  function follow(row){
    if (!row.follow_up_note) return '';
    var label = row.follow_up_status === 'sent' ? 'Follow-up that went out' : row.follow_up_status === 'draft' ? 'Draft, not sent' : 'Follow-up note';
    return '<div class="follow"><h3>' + esc(label) + '</h3><p>' + esc(row.follow_up_note) + '</p></div>';
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
      '<p class="dial-who">' + esc(dial.name || 'Family') + '</p>' +
      '<p class="dial-number">' + esc(dial.number) + '</p>' +
      '<p class="dial-timer" id="call-timer"' + (dial.phase === 'open' ? '' : ' hidden') + '>0:00</p>' +
      '<div class="dial-actions">' +
      (live ? '<button type="button" data-act="mute" aria-pressed="' + dial.muted + '">' + (dial.muted ? 'Unmute' : 'Mute') + '</button>' : '') +
      (live ? '<button type="button" class="hangup" data-act="hangup">Hang up</button>' : '<button type="button" data-act="close">Close</button>') +
      '</div></div>';
  }
  function reachPanel(family){
    var showingCall = dial.registrationId === family.id && dial.phase && (reachMode === 'call' || callLive() || dial.phase === 'ended' || dial.phase === 'error');
    if (showingCall && dial.phase !== '') return dialerHtml();
    if (!reachMode) return '';
    var people = contacts(family.row);
    if (reachMode === 'call' || reachMode === 'text') {
      var phones = choiceList(people, 'phone');
      if (!phones) return '<form class="composer" data-reach="' + reachMode + '"><p>There is no number on this family.</p><button type="button" data-act="close">Close</button></form>';
    }
    if (reachMode === 'email') {
      var emails = choiceList(people, 'email');
      if (!emails) return '<form class="composer"><p>There is no email on this family.</p><button type="button" data-act="close">Close</button></form>';
    }
    if (reachMode === 'call') {
      return '<form class="composer" data-reach="call"><p class="hint">You talk through this computer. The family sees the Twilio number.</p>' + phones +
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
        '<label for="reach-body">Email</label><textarea id="reach-body" name="reach-body" rows="6" required>' + esc(family.row.follow_up_note || '') + '</textarea>' +
        '<div class="composer-actions"><button class="btn" type="submit">Send email</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    if (reachMode === 'retire') {
      return '<form class="composer" data-reach="retire"><label for="retire-reason">Why</label><select id="retire-reason" name="reason" required>' +
        '<option value="">Choose a reason</option>' +
        '<option value="visit_booked">Visit booked</option><option value="asked_to_stop">Asked us to stop</option>' +
        '<option value="no_response">No response</option><option value="not_a_fit">Not a fit</option></select>' +
        '<label for="retire-note">Note</label><textarea id="retire-note" name="note" rows="3"></textarea>' +
        '<div class="composer-actions"><button class="btn" type="submit">Retire this family</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    if (reachMode === 'restore') {
      var why = REASONS[family.row.retired_reason] || 'Retired';
      return '<form class="composer" data-reach="restore"><p>Bring ' + esc(family.row.name) + ' back onto the clock. They were retired as ' + esc(why.toLowerCase()) + '.</p>' +
        (family.row.retired_note ? '<p class="reason">' + esc(family.row.retired_note) + '</p>' : '') +
        '<div class="composer-actions"><button class="btn" type="submit">Bring back</button><button type="button" data-act="close">Close</button></div><p class="status-line" id="reach-status" role="status"></p></form>';
    }
    return '';
  }
  function detail(family){
    if (!family) {
      document.getElementById('detail').innerHTML = '<p class="waiting">No family is in this view.</p>';
      return;
    }
    var retired = isRetired(family);
    var away = callLive() && dial.registrationId !== family.id
      ? '<div class="on-call"><p>On a call with ' + esc(dial.name) + '</p><button type="button" data-act="return-call">Return</button><button type="button" class="hangup" data-act="hangup">Hang up</button></div>'
      : '';
    var guide = family.row.suggested_slug
      ? '<p><a class="guide-link" href="/library/article/?slug=' + encodeURIComponent(family.row.suggested_slug) + '">' + esc(family.row.suggested_title || family.row.suggested_slug) + '</a></p>' +
        (family.row.suggestion_reason ? '<p class="reason">' + esc(family.row.suggestion_reason) + '</p>' : '')
      : '';
    var summary = family.row.summary ? '<div class="note-block"><h3>From the conversation</h3><p>' + esc(family.row.summary) + '</p>' + guide + follow(family.row) + '</div>' : (guide || follow(family.row) ? '<div class="note-block">' + guide + follow(family.row) + '</div>' : '');
    var banner = retired ? '<p class="retired-banner">Retired' + (REASONS[family.row.retired_reason] ? ' · ' + esc(REASONS[family.row.retired_reason]) : '') + '</p>' : '';
    var callbackBanner = wantsCallback(family) ? '<p class="callback-banner">Asked for a call back <button type="button" data-act="clear-callback">Callback done</button></p>' : '';
    document.getElementById('detail').innerHTML =
      away +
      '<p class="kicker">' + esc(readiness(family.row.visit_readiness)) + '</p>' +
      '<h2>' + esc(family.row.name) + '</h2>' +
      '<p class="session">' + esc(family.title) + ' · ' + esc(family.when) + '</p>' +
      banner +
      callbackBanner +
      '<div class="reach" role="group" aria-label="Reach this family">' +
      '<button type="button" data-act="call" aria-pressed="' + (reachMode === 'call') + '">Call</button>' +
      '<button type="button" data-act="text" aria-pressed="' + (reachMode === 'text') + '">Text</button>' +
      '<button type="button" data-act="email" aria-pressed="' + (reachMode === 'email') + '">Email</button>' +
      '<button type="button" data-act="' + (retired ? 'restore' : 'retire') + '" aria-pressed="' + (reachMode === 'retire' || reachMode === 'restore') + '">' + (retired ? 'Bring back' : 'Retire') + '</button>' +
      '</div>' +
      reachPanel(family) +
      (family.row.readiness_note ? '<p>' + esc(family.row.readiness_note) + '</p>' : '') +
      timeline(family) + summary + reads(family);
    if (fromClick && window.matchMedia('(max-width: 900px)').matches) {
      document.getElementById('detail').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
    }
    fromClick = false;
  }
  function counts(list){
    document.getElementById('count-all').textContent = list.length;
    document.getElementById('count-7').textContent = list.filter(function(family){ return !family.upcoming && family.days >= 7; }).length;
    document.getElementById('count-14').textContent = list.filter(function(family){ return !family.upcoming && family.days >= 14; }).length;
    document.getElementById('count-30').textContent = list.filter(function(family){ return !family.upcoming && family.days >= 30; }).length;
    document.getElementById('count-never').textContent = list.filter(function(family){ return family.never; }).length;
    var callbackCount = document.getElementById('count-callback');
    if (callbackCount) callbackCount.textContent = families.filter(wantsCallback).length;
  }
  function label(){
    var text = 'Longest silence first';
    if (ageFilter === '7') text = 'Quiet at least 7 days';
    else if (ageFilter === '14') text = 'Quiet at least 14 days';
    else if (ageFilter === '30') text = 'Quiet at least 30 days';
    else if (ageFilter === 'never') text = 'The 1:1 happened, and no email, text, or call has connected since';
    if (lifeFilter === 'retired') text = 'Retired families';
    if (callbackFilter) text = 'Asked for a call back';
    document.getElementById('queue-label').textContent = text;
  }
  function render(){
    var activePool = families.filter(inReady).filter(function(family){ return !isRetired(family); });
    counts(activePool);
    label();
    var list = visible();
    if (!list.some(function(family){ return family.id === selectedId; })) {
      selectedId = list.length ? list[0].id : 0;
    }
    document.getElementById('queue').innerHTML = queueHtml(list);
    bindQueue();
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
        '<form class="attach" data-unmatched="' + item.id + '"><label>Family <select name="registration_id" required><option value="">Choose a family</option>' + options + '</select></label><button type="submit">Attach</button><span class="attach-status" role="status"></span></form></li>';
    }).join('');
  }

  function load(){
    var status = document.getElementById('dash-status');
    status.textContent = 'Loading families…';
    return Promise.all([
      api('/office/meetings'),
      api('/office/signups'),
      api('/office/touches').catch(function(){ return []; }),
      api('/office/unmatched').catch(function(){ return []; })
    ]).then(function(result){
      var meetings = rows(result[0]);
      var signups = rows(result[1]);
      var touches = rows(result[2]);
      var unmatched = rows(result[3]);
      families = signups.filter(function(row){
        var meeting = meetings.filter(function(item){ return item.id === row.meeting_id; })[0];
        return meeting && meeting.meeting_type === 'family_1_1';
      }).map(function(row){
        var meeting = meetings.filter(function(item){ return item.id === row.meeting_id; })[0];
        return build(row, meeting, touches);
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
    if (status) status.textContent = channel === 'sms' ? 'Sending the text…' : 'Sending the email…';
    api('/office/send', {method:'POST', body:{
      registration_id: family.id,
      channel: channel,
      to: picked.value,
      subject: subject ? subject.value : '',
      body: body.value
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
      if (status) status.textContent = 'Choose why this family is retiring.';
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
      if (engagement === 'retired') lifeFilter = 'active';
      document.querySelectorAll('[data-life]').forEach(function(button){
        button.setAttribute('aria-pressed', String(button.dataset.life === lifeFilter));
      });
      load();
    }).catch(function(err){ if (status) status.textContent = err.message; });
  }
  document.getElementById('detail').addEventListener('click', function(event){
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
    if (act === 'call' || act === 'text' || act === 'email' || act === 'retire' || act === 'restore') {
      if (callLive() && act === 'call') { reachMode = 'call'; render(); return; }
      reachMode = reachMode === act ? '' : act;
      render();
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
      if (note) note.textContent = 'Choose a family.';
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
  document.querySelectorAll('[data-callback]').forEach(function(button){
    button.addEventListener('click', function(){
      callbackFilter = !callbackFilter;
      button.setAttribute('aria-pressed', String(callbackFilter));
      render();
    });
  });
  document.querySelectorAll('[data-life]').forEach(function(button){
    button.addEventListener('click', function(){
      lifeFilter = button.dataset.life;
      reachMode = '';
      callbackFilter = false;
      document.querySelectorAll('[data-callback]').forEach(function(other){
        other.setAttribute('aria-pressed', 'false');
      });
      document.querySelectorAll('[data-life]').forEach(function(other){
        other.setAttribute('aria-pressed', String(other === button));
      });
      render();
    });
  });
  document.querySelectorAll('[data-ready]').forEach(function(button){
    button.addEventListener('click', function(){
      readyFilter = button.dataset.ready;
      document.querySelectorAll('[data-ready]').forEach(function(other){
        other.setAttribute('aria-pressed', String(other === button));
      });
      render();
    });
  });

  if (token()) { showLogin(false); load(); }
  else showLogin(true);
})();
