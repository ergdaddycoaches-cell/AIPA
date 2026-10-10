(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var ZONE = 'America/Los_Angeles';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var dayInput = document.getElementById('day');
  var calls = [];
  var day = '';
  var editing = null;
  var emailNote = {};

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
  function pad(n){ return n < 10 ? '0' + n : String(n); }
  function today(){
    return new Intl.DateTimeFormat('en-CA', {timeZone:ZONE, year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  }
  function shift(iso, days){
    var parts = String(iso || '').split('-');
    var stamp = Date.UTC(+parts[0], +parts[1] - 1, +parts[2]) + days * 86400000;
    var date = new Date(stamp);
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
  }
  function heading(iso){
    var parts = String(iso || '').split('-');
    var date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return date.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', timeZone:'UTC'});
  }
  function wants(row){
    return !!(row && (row.callback_requested === true || row.callback_requested === 1));
  }
  function due(row){
    var match = /^(\d{4}-\d{2}-\d{2})/.exec(String(row && row.callback_requested_at || ''));
    return match ? match[1] : '';
  }
  var dial = { contractorId: 0, name: '', company: '', number: '', call: null, device: null, token: '', muted: false, started: 0, timer: 0, phase: '', error: '' };

  function rank(item){
    if (item.group === 'session') return 0;
    if (item.group === 'email') return 1;
    return 2;
  }
  function byName(a, b){
    var order = rank(a) - rank(b);
    if (order) return order;
    if (a.group === 'session') return String(a.at).localeCompare(String(b.at));
    return String(a.name).localeCompare(String(b.name)) || String(a.kind).localeCompare(String(b.kind));
  }
  function e164(value){
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
    if (digits.length > 11) return '+' + digits;
    return '';
  }
  function submittedLabel(value){
    var date = new Date(value);
    if (!value || isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: ZONE,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }
  function callLive(){
    return dial.phase === 'connecting' || dial.phase === 'ringing' || dial.phase === 'open';
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
      '<p class="dial-kicker">' + esc(dialLabel()) + '</p>' +
      '<p class="dial-who">' + esc(dial.name || 'Contractor') + '</p>' +
      '<p class="dial-number">' + esc(dial.company ? dial.company + ' · ' + dial.number : dial.number) + '</p>' +
      '<p class="dial-timer" id="call-timer"' + (dial.phase === 'open' ? '' : ' hidden') + '>0:00</p>' +
      '<div class="dial-actions">' +
      (live ? '<button type="button" data-act="mute" aria-pressed="' + dial.muted + '">' + (dial.muted ? 'Unmute' : 'Mute') + '</button>' : '') +
      (live ? '<button type="button" class="hangup" data-act="hangup">Hang up</button>' : '<button type="button" data-act="close">Close</button>') +
      '</div></div>';
  }
  function emailById(id){
    return calls.filter(function(item){ return item.group === 'email' && item.id === id; })[0] || null;
  }
  function emailHtml(item){
    var preview = String(item.body || '').replace(/\s+/g, ' ').trim();
    if (preview.length > 180) preview = preview.slice(0, 177) + '…';
    var open = editing && editing.id === item.id;
    var editor = '';
    if (open && editing.mode === 'change') {
      editor = '<div class="delay-editor">' +
        '<label for="email-date">Date</label><input id="email-date" type="date" value="' + esc(item.date) + '">' +
        '<label for="email-subject">Subject</label><input id="email-subject" type="text" maxlength="200" value="' + esc(item.subject) + '">' +
        '<label for="email-guide">Guide name</label><input id="email-guide" type="text" maxlength="200" value="' + esc(item.guide) + '">' +
        '<label for="email-body">Email</label><textarea id="email-body" rows="6" maxlength="20000">' + esc(item.body) + '</textarea>' +
        '<div class="action-review"><button class="btn" type="button" data-email-act="save" data-email-id="' + item.id + '">Save</button>' +
        '<button class="btn quiet" type="button" data-email-act="cancel">Cancel</button></div></div>';
    } else if (open && editing.mode === 'delay') {
      editor = '<div class="delay-editor"><label for="email-date">New date</label><input id="email-date" data-delay-date="' + item.id + '" type="date" value="' + esc(item.date) + '"></div>';
    }
    var note = emailNote[item.id] ? '<p class="status-line" role="status">' + esc(emailNote[item.id]) + '</p>' : '';
    return '<li><span class="action-kind">Delayed email</span>' +
      '<a class="name" href="' + esc(item.href) + '">' + esc(item.name) + '</a>' +
      (item.subject ? '<span class="meta">' + esc(item.subject) + '</span>' : '') +
      (item.guide ? '<span class="meta">Guide: ' + esc(item.guide) + '</span>' : '') +
      (preview ? '<span class="meta">' + esc(preview) + '</span>' : '') +
      '<div class="action-review">' +
      '<button class="btn" type="button" data-email-act="approve" data-email-id="' + item.id + '">Approve</button>' +
      '<button class="btn quiet" type="button" data-email-act="change" data-email-id="' + item.id + '">Change</button>' +
      '<button class="btn quiet" type="button" data-email-act="delay" data-email-id="' + item.id + '">Delay</button>' +
      '<button class="btn quiet" type="button" data-email-act="kill" data-email-id="' + item.id + '">Kill</button>' +
      '</div>' + editor + note + '</li>';
  }
  function sessionHtml(item){
    var people = (item.people || []).map(function(person){
      return person.href ? '<a href="' + esc(person.href) + '">' + esc(person.name) + '</a>' : esc(person.name);
    }).join(', ');
    return '<li><span class="action-kind">' + esc(item.kind) + '</span>' +
      '<span class="name">' + esc(item.title) + '</span>' +
      '<span class="meta">' + esc(item.when) + '</span>' +
      '<span class="meta">' + (people ? 'Signed up: ' + people : 'No one signed up yet.') + '</span></li>';
  }
  function itemHtml(item){
    if (item.group === 'email') return emailHtml(item);
    if (item.group === 'session') return sessionHtml(item);
    if (item.kind === 'Contractor') {
      var when = submittedLabel(item.submitted);
      var bits = [];
      if (item.phone) bits.push(esc(item.phone));
      if (item.email) bits.push(esc(item.email));
      var open = dial.contractorId === item.id && dial.phase;
      var button = '';
      if (!open) {
        if (!e164(item.phone)) button = '<p class="meta">No number on file.</p>';
        else if (callLive()) button = '<button class="btn quiet call-btn" type="button" disabled>On another call</button>';
        else button = '<button class="btn call-btn" type="button" data-call="' + item.id + '">Call</button>';
      }
      return '<li><span class="action-kind">Contractor</span>' +
        '<a class="name" href="' + esc(item.href) + '">' + esc(item.person) + '</a>' +
        '<a class="company" href="' + esc(item.href) + '">' + esc(item.company) + '</a>' +
        (when ? '<span class="meta">Form filled ' + esc(when) + '</span>' : '') +
        (bits.length ? '<span class="meta">' + bits.join(' · ') + '</span>' : '') +
        (item.note ? '<span class="meta">' + esc(item.note) + '</span>' : '') +
        (open ? dialerHtml() : button) +
        '</li>';
    }
    var familyBits = [];
    if (item.phone) familyBits.push(esc(item.phone));
    if (item.email) familyBits.push(esc(item.email));
    if (item.note) familyBits.push(esc(item.note));
    return '<li><span class="action-kind">' + esc(item.kind) + '</span>' +
      '<a class="name" href="' + esc(item.href) + '">' + esc(item.name) + '</a>' +
      (familyBits.length ? '<span class="meta">' + familyBits.join(' · ') + '</span>' : '') +
      '</li>';
  }
  function listHtml(items){
    return items.slice().sort(byName).map(itemHtml).join('');
  }
  function sectionDays(){
    var dates = [];
    document.querySelectorAll('#day-groups .action-day').forEach(function(section){
      dates.push(section.getAttribute('data-day'));
    });
    return dates;
  }
  function countButton(span, count, label){
    var word = count === 1 ? '1 item' : count + ' items';
    return '<button type="button" class="' + (span === 'past' && count ? 'is-past' : '') + '" data-span="' + span + '" aria-label="' + word + ' ' + label.toLowerCase() + '"><b>' + count + '</b><span>' + label + '</span></button>';
  }
  function render(){
    var y = window.scrollY;
    var now = today();
    var groups = {};
    var open = [];
    calls.forEach(function(item){
      if (!item.date) open.push(item);
      else {
        if (!groups[item.date]) groups[item.date] = [];
        groups[item.date].push(item);
      }
    });
    if (pinned && !groups[pinned]) groups[pinned] = [];
    if (!groups[now]) groups[now] = [];
    var keys = Object.keys(groups).sort();
    if (keys.length > 1) {
      var cursor = keys[0];
      var end = keys[keys.length - 1];
      var added = [];
      var guard = 0;
      while (cursor < end && guard <= 62) {
        if (!groups[cursor]) {
          groups[cursor] = [];
          added.push(cursor);
        }
        cursor = shift(cursor, 1);
        guard += 1;
      }
      if (cursor < end) added.forEach(function(iso){ delete groups[iso]; });
    }
    var dates = Object.keys(groups).sort();
    document.getElementById('day-groups').innerHTML = dates.map(function(iso){
      var items = groups[iso];
      var kind = iso < now ? ' is-past' : (iso === now ? ' is-today' : '');
      var title = (iso === now ? 'Today · ' : '') + heading(iso);
      var body = items.length
        ? '<ul class="action-list">' + listHtml(items) + '</ul>'
        : '<p class="action-empty">Nothing on this day.</p>';
      return '<section class="action-day' + kind + '" id="day-' + iso + '" data-day="' + iso + '"><h2>' + esc(title) + '</h2>' + body + '</section>';
    }).join('');
    var past = calls.filter(function(item){ return item.date && item.date < now; }).length;
    var due = calls.filter(function(item){ return item.date === now; }).length;
    var future = calls.filter(function(item){ return item.date && item.date > now; }).length;
    document.getElementById('day-count').innerHTML =
      countButton('past', past, 'Past') +
      countButton('today', due, 'Today') +
      countButton('future', future, 'Future');
    var openBox = document.getElementById('undated');
    openBox.hidden = !open.length;
    document.getElementById('undated-list').innerHTML = listHtml(open);
    if (y) window.scrollTo(0, y);
    if (editing && editing.focus) {
      var box = document.getElementById('email-date');
      editing.focus = false;
      if (box) box.focus();
    }
  }
  var spyLock = false;
  function reveal(iso, smooth){
    var section = document.getElementById('day-' + iso);
    if (!section) return;
    var stick = document.getElementById('action-stick');
    var top = section.getBoundingClientRect().top + window.scrollY - (stick ? stick.offsetHeight : 0) - 4;
    spyLock = true;
    day = iso;
    dayInput.value = iso;
    window.scrollTo({top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto'});
    window.setTimeout(function(){ spyLock = false; }, smooth ? 700 : 40);
  }
  function jumpSpan(span){
    var now = today();
    var dates = sectionDays();
    var target = '';
    if (span === 'today') target = dates.indexOf(now) === -1 ? '' : now;
    else if (span === 'past') dates.forEach(function(iso){ if (!target && iso < now) target = iso; });
    else dates.forEach(function(iso){ if (!target && iso > now) target = iso; });
    if (target) reveal(target, true);
  }
  var pinned = '';
  function stepDay(dir){
    var next = shift(dayInput.value || today(), dir);
    pinned = next;
    render();
    reveal(next, true);
  }
  function isFamily(row, meetings){
    var meeting = meetings.filter(function(item){ return item.id === row.meeting_id; })[0];
    if (meeting && meeting.meeting_type === 'family_1_1') return true;
    return !row.meeting_id;
  }
  function emailDue(row){
    var match = /^(\d{4}-\d{2}-\d{2})/.exec(String(row && row.delayed_email_at || ''));
    return match ? match[1] : '';
  }
  function wantsEmail(row){
    return !!(row && (row.delayed_email === true || row.delayed_email === 1));
  }
  function parseStamp(value){
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '');
    if (!match) return null;
    return {y:+match[1], mo:+match[2], d:+match[3], h:+match[4], mi:+match[5]};
  }
  function stampOf(part){
    return part.y + '-' + pad(part.mo) + '-' + pad(part.d) + 'T' + pad(part.h) + ':' + pad(part.mi);
  }
  function addDaysPart(part, days){
    var date = new Date(Date.UTC(part.y, part.mo - 1, part.d + days));
    return {y:date.getUTCFullYear(), mo:date.getUTCMonth() + 1, d:date.getUTCDate(), h:part.h, mi:part.mi};
  }
  function addMonthsPart(part, months){
    var y = part.y;
    var mo = part.mo + months;
    while (mo > 12) { mo -= 12; y += 1; }
    while (mo < 1) { mo += 12; y -= 1; }
    var last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return {y:y, mo:mo, d:Math.min(part.d, last), h:part.h, mi:part.mi};
  }
  function sessionWhen(meeting, at){
    var seminar = window.AIPA_SEMINAR;
    if (!seminar) return at;
    var full = seminar.format({starts_at:at, timezone:meeting.timezone, kind:'one_time'});
    var cut = full.indexOf(' at ');
    return cut === -1 ? full : full.slice(cut + 4);
  }
  function sessionItems(meetings, signups){
    var start = today() + 'T00:00';
    var horizon = shift(today(), 62) + 'T23:59';
    var items = [];
    meetings.forEach(function(meeting){
      if (meeting.status !== 'published') return;
      if (meeting.meeting_type !== 'live_qa' && meeting.meeting_type !== 'family_1_1') return;
      var part = parseStamp(meeting.starts_at);
      if (!part) return;
      var step = 0;
      var monthly = false;
      if (meeting.kind === 'recurring') {
        if (meeting.frequency === 'weekly') step = 7;
        else if (meeting.frequency === 'every_two_weeks') step = 14;
        else if (meeting.frequency === 'monthly') monthly = true;
        else return;
        var walked = 0;
        while (stampOf(part) < start && walked < 520) {
          part = monthly ? addMonthsPart(part, 1) : addDaysPart(part, step);
          walked += 1;
        }
      }
      var made = 0;
      while (stampOf(part) <= horizon && made < 70) {
        var at = stampOf(part);
        if (at >= start) {
          var people = signups.filter(function(row){
            return Number(row.meeting_id) === Number(meeting.id) && String(row.occurrence_at || '').slice(0, 16) === at;
          }).map(function(row){
            var person = {name: row.name || 'Unnamed'};
            if (meeting.meeting_type === 'family_1_1') person.href = '/admin/families/call/?id=' + row.id;
            return person;
          });
          var label = window.AIPA_SEMINAR ? window.AIPA_SEMINAR.typeLabel(meeting.meeting_type) : '';
          items.push({
            group: 'session',
            kind: label || 'Session',
            title: meeting.title || label || 'Session',
            name: meeting.title || label || 'Session',
            when: sessionWhen(meeting, at),
            at: at,
            people: people,
            date: at.slice(0, 10)
          });
        }
        if (meeting.kind !== 'recurring') break;
        part = monthly ? addMonthsPart(part, 1) : addDaysPart(part, step);
        made += 1;
      }
    });
    return items;
  }
  function load(options){
    options = options || {};
    if (!options.keep) document.getElementById('day-count').textContent = 'Loading…';
    return Promise.all([
      api('/office/signups'),
      api('/office/meetings'),
      api('/office/contractor-pipeline')
    ]).then(function(result){
      var signups = rows(result[0]);
      var meetings = rows(result[1]);
      var contractors = rows((result[2] || {}).contractors);
      calls = [];
      signups.filter(function(row){ return wants(row) && isFamily(row, meetings); }).forEach(function(row){
        calls.push({
          group: 'call',
          kind: 'Family',
          name: row.name || 'Unnamed family',
          phone: row.phone || '',
          email: row.email || '',
          who: '',
          note: row.engagement === 'retired' ? 'Retired' : '',
          href: '/admin/families/call/?id=' + row.id,
          date: due(row)
        });
      });
      signups.filter(function(row){ return wantsEmail(row) && isFamily(row, meetings); }).forEach(function(row){
        calls.push({
          group: 'email',
          kind: 'Delayed email',
          id: row.id,
          name: row.name || 'Unnamed family',
          email: row.email || '',
          subject: row.delayed_email_subject || '',
          body: row.delayed_email_body || '',
          guide: row.delayed_email_guide || '',
          href: '/admin/families/call/?id=' + row.id,
          date: emailDue(row)
        });
      });
      contractors.filter(wants).forEach(function(row){
        var person = row.contact_name || 'Unnamed contractor';
        calls.push({
          group: 'call',
          kind: 'Contractor',
          id: row.id,
          name: person,
          person: person,
          company: row.name || 'Unnamed company',
          phone: row.phone || '',
          email: row.email || '',
          submitted: row.submitted_at || '',
          note: '',
          href: '/admin/contractors/?id=' + row.id + '#detail',
          date: due(row)
        });
      });
      sessionItems(meetings, signups).forEach(function(item){ calls.push(item); });
      render();
      if (!options.keep) reveal(today(), false);
    }).catch(function(err){
      document.getElementById('day-count').textContent = err.message;
    });
  }
  function clearEmail(id){
    return api('/office/delayed-email', {method:'POST', body:{
      registration_id: id,
      requested: false
    }});
  }
  function saveEmail(id, fields){
    return api('/office/delayed-email', {method:'POST', body:{
      registration_id: id,
      requested: true,
      email_at: fields.date,
      subject: fields.subject,
      body: fields.body,
      guide: fields.guide
    }});
  }
  function approveEmail(id){
    var item = emailById(id);
    if (!item) return;
    if (/\{\{guide\}\}/.test(item.body || '') && !String(item.guide || '').trim()) {
      emailNote[id] = 'Add a guide name before approving this.';
      render();
      return;
    }
    if (!String(item.subject || '').trim()) {
      emailNote[id] = 'Add a subject.';
      render();
      return;
    }
    if (!item.email) {
      emailNote[id] = 'There is no email on file.';
      render();
      return;
    }
    emailNote[id] = 'Sending…';
    render();
    var body = String(item.body || '').replace(/\{\{guide\}\}/g, item.guide || '');
    api('/office/send', {method:'POST', body:{
      registration_id: item.id,
      channel: 'email',
      to: item.email,
      subject: item.subject,
      body: body
    }}).then(function(data){
      if (!data || data.ok !== true) {
        emailNote[id] = (data && data.message) || 'This was not sent.';
        render();
        return null;
      }
      return clearEmail(id).then(function(){
        delete emailNote[id];
        editing = null;
        return load({keep:true});
      });
    }).catch(function(err){
      emailNote[id] = err.message;
      render();
    });
  }
  function killEmail(id){
    delete emailNote[id];
    editing = null;
    clearEmail(id).then(function(){ return load({keep:true}); }).catch(function(err){
      emailNote[id] = err.message;
      render();
    });
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
    render();
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
  function contractorById(id){
    return calls.filter(function(item){ return item.kind === 'Contractor' && item.id === id; })[0] || null;
  }
  function placeCall(id){
    var item = contractorById(id);
    var number = item ? e164(item.phone) : '';
    if (!item || !number || callLive()) return;
    dial.contractorId = item.id;
    dial.name = item.person;
    dial.company = item.company;
    dial.number = number;
    dial.phase = 'connecting';
    dial.muted = false;
    dial.error = '';
    dial.started = 0;
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
      return Promise.resolve(dial.device.connect({params:{To:dial.number, contractor_id:String(item.id)}}));
    }).then(function(call){
      if (call) bindCall(call);
    }).catch(function(err){
      stopTimer();
      dial.phase = 'error';
      dial.error = err.message || 'The call could not start.';
      render();
    });
  }
  function hangup(){
    if (dial.call) dial.call.disconnect();
    else finishCall('Call ended.');
  }
  document.getElementById('desk').addEventListener('click', function(event){
    var emailButton = event.target.closest('[data-email-act]');
    if (emailButton) {
      var emailId = Number(emailButton.getAttribute('data-email-id'));
      var emailAct = emailButton.getAttribute('data-email-act');
      var current = emailById(emailId);
      if (emailAct === 'approve') approveEmail(emailId);
      else if (emailAct === 'kill') killEmail(emailId);
      else if (emailAct === 'cancel') { editing = null; render(); }
      else if (emailAct === 'change' && current) {
        editing = {id: emailId, mode: 'change', focus: false};
        render();
      } else if (emailAct === 'delay' && current) {
        editing = {id: emailId, mode: 'delay', focus: true};
        render();
      } else if (emailAct === 'save' && current) {
        var nextDate = document.getElementById('email-date').value;
        var nextSubject = document.getElementById('email-subject').value;
        var nextBody = document.getElementById('email-body').value;
        var nextGuide = document.getElementById('email-guide').value;
        if (!nextDate) { emailNote[emailId] = 'Add the date for this email.'; render(); return; }
        emailNote[emailId] = 'Saving…';
        saveEmail(emailId, {
          date: nextDate,
          subject: nextSubject,
          body: nextBody,
          guide: nextGuide
        }).then(function(){
          delete emailNote[emailId];
          editing = null;
          return load({keep:true});
        }).catch(function(err){
          emailNote[emailId] = err.message;
          render();
        });
      }
      return;
    }
    var callButton = event.target.closest('[data-call]');
    if (callButton) {
      placeCall(Number(callButton.getAttribute('data-call')));
      return;
    }
    var act = event.target.closest('[data-act]');
    if (!act) return;
    var action = act.getAttribute('data-act');
    if (action === 'hangup') hangup();
    else if (action === 'mute' && dial.call) {
      dial.muted = !dial.muted;
      dial.call.mute(dial.muted);
      render();
    } else if (action === 'close' && !callLive()) {
      dial.phase = '';
      dial.contractorId = 0;
      render();
    }
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
  document.getElementById('desk').addEventListener('change', function(event){
    var input = event.target.closest('[data-delay-date]');
    if (!input) return;
    var delayId = Number(input.getAttribute('data-delay-date'));
    var item = emailById(delayId);
    if (!item || !input.value || input.value === item.date) return;
    emailNote[delayId] = 'Saving…';
    saveEmail(delayId, {
      date: input.value,
      subject: item.subject,
      body: item.body,
      guide: item.guide
    }).then(function(){
      delete emailNote[delayId];
      editing = null;
      return load({keep:true});
    }).catch(function(err){
      emailNote[delayId] = err.message;
      render();
    });
  });
  document.getElementById('day-prev').addEventListener('click', function(){ stepDay(-1); });
  document.getElementById('day-next').addEventListener('click', function(){ stepDay(1); });
  document.getElementById('day-today').addEventListener('click', function(){ reveal(today(), true); });
  dayInput.addEventListener('change', function(){
    var picked = dayInput.value;
    if (!picked) return;
    pinned = picked;
    render();
    reveal(picked, true);
  });
  document.getElementById('day-count').addEventListener('click', function(event){
    var button = event.target.closest('[data-span]');
    if (button) jumpSpan(button.getAttribute('data-span'));
  });
  window.addEventListener('scroll', function(){
    if (spyLock || desk.hidden) return;
    var stick = document.getElementById('action-stick');
    var edge = stick ? stick.getBoundingClientRect().bottom + 8 : 0;
    var found = '';
    document.querySelectorAll('#day-groups .action-day').forEach(function(section){
      if (section.getBoundingClientRect().top <= edge) found = section.getAttribute('data-day');
    });
    if (found && found !== dayInput.value) {
      day = found;
      dayInput.value = found;
    }
  }, {passive:true});
  if (token()) { showLogin(false); load(); }
  else showLogin(true);
})();
