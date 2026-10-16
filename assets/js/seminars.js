(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var meetings = [];
  var signups = [];
  var profiles = {};
  var followId = 0;
  var rosterNote = {};
  var filter = '';
  var signupFilter = '';
  var fillingSessions = false;
  var current = null;
  var notesId = 0;
  var nurtureById = {};
  var nurtureGuides = [];
  var nurtureOrder = [];
  var ROLES = [['', 'Not set'], ['parent', 'Parent'], ['adult_child', 'Adult child'], ['spouse', 'Spouse'], ['sibling', 'Sibling'], ['other', 'Other']];
  var STYLES = [['', 'Not set'], ['protective', 'Protective'], ['minimizing', 'Minimizing'], ['detail', 'Wants the details'], ['action', 'Wants a next step'], ['urgent', 'Urgent'], ['unsure', 'Not enough to tell']];
  var msg = document.getElementById('meeting-msg');

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
  function label(status){
    return status === 'published' ? 'Live' : status === 'retired' ? 'Retired' : 'Draft';
  }
  function kind(){
    var picked = document.querySelector('input[name="meeting-kind"]:checked');
    return picked ? picked.value : 'one_time';
  }
  function showLogin(on){
    var loginView = document.getElementById('login-view');
    var desk = document.getElementById('desk');
    var signout = document.getElementById('signout');
    if (loginView) loginView.hidden = !on;
    if (desk) desk.hidden = on;
    if (signout) signout.hidden = on;
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
  function syncKind(){
    var recurring = kind() === 'recurring';
    document.getElementById('frequency-wrap').hidden = !recurring;
    document.getElementById('meeting-starts-label').textContent = recurring ? 'First session' : 'Date and time';
  }
  document.querySelectorAll('input[name="meeting-kind"]').forEach(function(input){
    input.addEventListener('change', syncKind);
  });

  function fill(){
    var meeting = current || {};
    document.getElementById('meeting-type').value = meeting.meeting_type || 'contractor_orientation';
    document.getElementById('meeting-title').value = meeting.title || '';
    document.getElementById('meeting-summary').value = meeting.summary || '';
    var selected = meeting.kind === 'recurring' ? 'recurring' : 'one_time';
    document.querySelectorAll('input[name="meeting-kind"]').forEach(function(input){
      input.checked = input.value === selected;
    });
    document.getElementById('meeting-frequency').value = meeting.frequency || 'weekly';
    document.getElementById('meeting-starts').value = String(meeting.starts_at || '').slice(0, 16);
    document.getElementById('meeting-zone').value = meeting.timezone || 'America/Los_Angeles';
    document.getElementById('meeting-duration').value = meeting.duration_minutes || 45;
    document.getElementById('meeting-zoom').value = meeting.zoom_url || '';
    document.getElementById('remind-email').checked = meeting.remind_email === true || meeting.remind_email === 1;
    document.getElementById('remind-sms').checked = meeting.remind_sms === true || meeting.remind_sms === 1;
    document.getElementById('remind-hours').value = meeting.remind_hours_before || 24;
    var badge = document.getElementById('meeting-status');
    badge.className = 'badge ' + (meeting.status || 'draft');
    badge.textContent = meeting.id ? label(meeting.status) : 'New draft';
    msg.textContent = '';
    syncKind();
  }

  function sessionTitle(row){
    var meeting = meetings.filter(function(item){ return item.id === row.meeting_id; })[0];
    return meeting ? meeting.title : 'Removed meeting';
  }

  function fillSessionFilter(){
    var select = document.getElementById('signup-session');
    if (!select) return;
    var names = {};
    signups.forEach(function(row){
      if (!row.meeting_id) return;
      names[sessionTitle(row)] = true;
    });
    meetings.forEach(function(meeting){
      if ((meeting.meeting_type === 'live_qa' || meeting.meeting_type === 'family_1_1') && meeting.title) names[meeting.title] = true;
    });
    var list = Object.keys(names).sort(function(a, b){ return a.localeCompare(b); });
    var previous = signupFilter;
    fillingSessions = true;
    select.innerHTML = '<option value="">All sessions</option>' + list.map(function(name){
      return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
    }).join('');
    if (list.indexOf(previous) === -1) signupFilter = '';
    select.value = signupFilter;
    fillingSessions = false;
  }

  function guestPeople(row){
    var list = [];
    if (row.guests) {
      try {
        var parsed = JSON.parse(row.guests);
        if (Array.isArray(parsed)) list = parsed;
      } catch (err) {}
    }
    if (!list.length && (row.guest_name || row.guest_email || row.guest_phone)) {
      list = [{name: row.guest_name || '', email: row.guest_email || '', phone: row.guest_phone || ''}];
    }
    return list;
  }
  function guestCell(row, field){
    return guestPeople(row).map(function(person){ return esc(person[field] || ''); }).join('<br>') ;
  }

  function meetingFor(row){
    return meetings.filter(function(item){ return item.id === row.meeting_id; })[0] || null;
  }
  function isFamily(row){
    var meeting = meetingFor(row);
    return !!(meeting && meeting.meeting_type === 'family_1_1');
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
  function optionList(list, selected){
    return list.map(function(pair){
      return '<option value="' + esc(pair[0]) + '"' + (pair[0] === (selected || '') ? ' selected' : '') + '>' + esc(pair[1]) + '</option>';
    }).join('');
  }
  function agreed(row){
    return row.recording_consent === true || row.recording_consent === 1 || row.recording_consent === '1';
  }
  function topicText(row){
    return parseList(row.topics).join('\n');
  }
  function seedPeople(row){
    var stored = parseList(row.attendee_reads);
    if (stored.length) return stored;
    var people = [{name: row.name || '', email: row.email || '', role: '', style: '', note: ''}];
    guestPeople(row).forEach(function(person){
      people.push({name: person.name || '', email: person.email || '', role: '', style: '', note: ''});
    });
    return people;
  }
  function addPerson(person){
    person = person || {name:'', email:'', role:'', style:'', note:''};
    var block = document.createElement('div');
    block.className = 'person';
    block.innerHTML =
      '<div class="pair"><div><label>Name<input class="person-name" value="' + esc(person.name || '') + '"></label></div>' +
      '<div><label>Email<input class="person-email" type="email" value="' + esc(person.email || '') + '"></label></div></div>' +
      '<div class="pair"><div><label>Role<select class="person-role">' + optionList(ROLES, person.role) + '</select></label></div>' +
      '<div><label>Style<select class="person-style">' + optionList(STYLES, person.style) + '</select></label></div></div>' +
      '<label>Note<input class="person-note" value="' + esc(person.note || '') + '"></label>' +
      '<button class="btn quiet" type="button">Remove</button>';
    block.querySelector('button').addEventListener('click', function(){ block.remove(); });
    document.getElementById('attendee-reads').appendChild(block);
  }
  function addGuide(guide){
    guide = guide || {article_id:'', slug:'', title:'', reason:''};
    var block = document.createElement('div');
    block.className = 'guide';
    var articleId = guide.article_id ? guide.article_id : '';
    block.innerHTML =
      '<div class="pair"><div><label>Title<input class="guide-title" value="' + esc(guide.title || '') + '"></label></div>' +
      '<div><label>Slug<input class="guide-slug" value="' + esc(guide.slug || '') + '"></label></div></div>' +
      '<div class="pair"><div><label>Article id<input class="guide-id" type="number" min="0" value="' + esc(articleId) + '"></label></div>' +
      '<div><label>Why this guide<input class="guide-reason" value="' + esc(guide.reason || '') + '"></label></div></div>' +
      '<button class="btn quiet" type="button">Remove</button>';
    block.querySelector('button').addEventListener('click', function(){ block.remove(); });
    document.getElementById('other-suggestions').appendChild(block);
  }
  function closeNotes(){
    notesId = 0;
    var panel = document.getElementById('family-notes');
    if (panel) panel.hidden = true;
    renderSignups();
  }
  function openNotes(id){
    var row = signups.filter(function(item){ return item.id === id; })[0];
    var panel = document.getElementById('family-notes');
    if (!row || !isFamily(row) || !panel) return;
    notesId = id;
    var meeting = meetingFor(row);
    var when = window.AIPA_SEMINAR.format({
      starts_at: row.occurrence_at,
      timezone: meeting ? meeting.timezone : 'America/Los_Angeles',
      kind: 'one_time'
    });
    document.getElementById('family-notes-who').textContent = sessionTitle(row) + ' · ' + when + ' · ' + (row.name || '');
    document.getElementById('notes-consent').checked = agreed(row);
    document.getElementById('notes-transcript').value = row.transcript || '';
    document.getElementById('notes-summary').value = row.summary || '';
    document.getElementById('notes-topics').value = topicText(row);
    document.getElementById('notes-readiness').value = row.visit_readiness || '';
    document.getElementById('notes-readiness-note').value = row.readiness_note || '';
    document.getElementById('suggested-id').value = row.suggested_article_id ? row.suggested_article_id : '';
    document.getElementById('suggested-slug').value = row.suggested_slug || '';
    document.getElementById('suggested-title').value = row.suggested_title || '';
    document.getElementById('suggested-reason').value = row.suggestion_reason || '';
    document.getElementById('follow-up-note').value = row.follow_up_note || '';
    document.getElementById('follow-up-status').value = row.follow_up_status || 'none';
    var meta = [];
    if (row.notes_at) meta.push('Notes saved ' + row.notes_at + '.');
    if (row.follow_up_status === 'sent' && row.follow_up_sent_at) meta.push('Follow-up marked sent ' + row.follow_up_sent_at + '.');
    document.getElementById('notes-meta').textContent = meta.join(' ');
    document.getElementById('notes-msg').textContent = '';
    var people = document.getElementById('attendee-reads');
    var guides = document.getElementById('other-suggestions');
    people.innerHTML = '';
    guides.innerHTML = '';
    seedPeople(row).forEach(addPerson);
    parseList(row.other_suggestions).forEach(addGuide);
    panel.hidden = false;
    renderSignups();
    panel.scrollIntoView({behavior:'smooth', block:'nearest'});
  }
  function saveNotes(event){
    event.preventDefault();
    var msg = document.getElementById('notes-msg');
    if (!notesId) return;
    var people = [];
    document.querySelectorAll('#attendee-reads .person').forEach(function(block){
      people.push({
        name: block.querySelector('.person-name').value.trim(),
        email: block.querySelector('.person-email').value.trim(),
        role: block.querySelector('.person-role').value,
        style: block.querySelector('.person-style').value,
        note: block.querySelector('.person-note').value.trim()
      });
    });
    var guides = [];
    document.querySelectorAll('#other-suggestions .guide').forEach(function(block){
      guides.push({
        article_id: Number(block.querySelector('.guide-id').value) || 0,
        title: block.querySelector('.guide-title').value.trim(),
        slug: block.querySelector('.guide-slug').value.trim(),
        reason: block.querySelector('.guide-reason').value.trim()
      });
    });
    var topics = document.getElementById('notes-topics').value.split(/\n+/).map(function(line){
      return line.trim();
    }).filter(Boolean);
    var payload = {
      id: notesId,
      recording_consent: document.getElementById('notes-consent').checked,
      transcript: document.getElementById('notes-transcript').value,
      summary: document.getElementById('notes-summary').value,
      topics: JSON.stringify(topics),
      visit_readiness: document.getElementById('notes-readiness').value,
      readiness_note: document.getElementById('notes-readiness-note').value,
      suggested_article_id: Number(document.getElementById('suggested-id').value) || 0,
      suggested_slug: document.getElementById('suggested-slug').value.trim(),
      suggested_title: document.getElementById('suggested-title').value.trim(),
      suggestion_reason: document.getElementById('suggested-reason').value,
      other_suggestions: JSON.stringify(guides),
      follow_up_note: document.getElementById('follow-up-note').value,
      follow_up_status: document.getElementById('follow-up-status').value,
      attendee_reads: JSON.stringify(people)
    };
    msg.textContent = 'Saving notes…';
    var keep = notesId;
    api('/office/family-notes', {method:'POST', body:payload}).then(function(saved){
      if (saved && saved.id) {
        var replaced = false;
        signups = signups.map(function(row){
          if (row.id !== saved.id) return row;
          replaced = true;
          return saved;
        });
        if (!replaced) signups.push(saved);
        openNotes(saved.id);
        document.getElementById('notes-msg').textContent = 'Notes saved. They stay in the back office.';
        return;
      }
      return load().then(function(){
        openNotes(keep);
        document.getElementById('notes-msg').textContent = 'Notes saved. They stay in the back office.';
      });
    }).catch(function(err){
      msg.textContent = err.message;
    });
  }

  function rosterKind(meeting){
    if (!meeting) return '';
    if (meeting.meeting_type === 'live_qa') return 'seminar';
    if (meeting.meeting_type === 'family_1_1') return '1_1';
    return '';
  }

  function personFirst(row){
    var profile = profiles[row.id] || {};
    var first = String(profile.first_name || '').trim();
    if (first) return first;
    var name = String(row.name || '').trim();
    var space = name.indexOf(' ');
    return space > 0 ? name.slice(0, space) : name;
  }

  function followCopy(row, kind){
    if (window.AIPA_MESSAGES) {
      var tokens = AIPA_MESSAGES.pages(row.suggested_slug);
      tokens.first_name = personFirst(row);
      var profile = profiles[row.id] || {};
      if (profile.sms_token) tokens.sms_opt_in = 'https://goaipa.com/admin/families/sms/?t=' + profile.sms_token;
      var email = AIPA_MESSAGES.compose(kind === '1_1' ? 'invite_visit' : 'invite_qa', tokens);
      var sms = AIPA_MESSAGES.compose(kind === '1_1' ? 'invite_visit_sms' : 'invite_qa_sms', tokens);
      return {
        next: kind === '1_1' ? 'a home visit' : 'an Ask Anything 1:1',
        subject: email.subject,
        body: email.body,
        sms: sms.body
      };
    }
    var who = personFirst(row);
    var hello = who ? 'Hello ' + who + ',' : 'Hello,';
    if (kind === '1_1') {
      return {
        next: 'a home visit',
        subject: 'A home visit',
        body: hello + '\n\nThank you for the Ask Anything 1:1.\n\nThe next step is a home visit, if you want a contractor to look at the house.\n\nReply to this email or call 833-AIPA-HUB.\n\nAging in Place Alliance',
        sms: (who ? 'Hi ' + who + ', ' : 'Hi, ') + 'it\'s [Host name]. I enjoyed our talk. Any questions since? When you\'re ready, you can book a measuring visit here: [Book a visit] Reply STOP to opt out.'
      };
    }
    return {
      next: 'an Ask Anything 1:1',
      subject: 'Thank you for joining us today',
      body: (who ? 'Hi ' + who + ',' : 'Hi,') + '\n\nThank you for coming to today\'s Live Q&A.\n\n[If they asked a question: You asked about [topic]. The short answer is [one or two sentences].]\n\nMany people find a private conversation is the easiest next step. An Ask Anything 1:1 is about 30 minutes, about your home and your plans, with no cost and no obligation.\n\nBook my 1:1: https://goaipa.com/ask-anything/\n\nWhenever you\'re ready, or not at all. Either is fine.\n\n[Host name]\n\nAging in Place Alliance\n833-AIPA-HUB',
      sms: (who ? 'Hi ' + who + ', ' : 'Hi, ') + 'it\'s [Host name]. Thanks for joining the Live Q&A. If you\'d like a private chat about your own home, you can book a 1:1 here: https://goaipa.com/ask-anything/ Reply STOP to opt out.'
    };
  }

  function attendedOn(row, kind){
    return kind === '1_1' ? row.attended_1_1 === 'yes' : row.attended_seminar === 'yes';
  }

  function whenLabel(row){
    var meeting = meetingFor(row);
    if (!row.occurrence_at || !window.AIPA_SEMINAR) return 'Date not set';
    return window.AIPA_SEMINAR.format({
      starts_at: row.occurrence_at,
      timezone: meeting ? meeting.timezone : 'America/Los_Angeles',
      kind: 'one_time'
    });
  }

  function renderRoster(){
    var section = document.getElementById('seminar-roster');
    var list = document.getElementById('roster-list');
    var hint = document.getElementById('roster-hint');
    var empty = document.getElementById('roster-empty');
    var kind = rosterKind(current);
    if (!section || !list) return;
    if (!kind) {
      section.hidden = true;
      list.innerHTML = '';
      followId = 0;
      return;
    }
    section.hidden = false;
    hint.textContent = kind === '1_1'
      ? 'Check who came. Follow up invites them to a home visit.'
      : 'Check who came. Follow up invites them to book an Ask Anything 1:1.';
    var people = signups.filter(function(row){
      return Number(row.meeting_id) === Number(current.id);
    }).sort(function(a, b){
      if (a.occurrence_at < b.occurrence_at) return -1;
      if (a.occurrence_at > b.occurrence_at) return 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    empty.hidden = people.length > 0;
    empty.textContent = kind === '1_1' ? 'No one has signed up for this 1:1 yet.' : 'No one has signed up for this seminar yet.';
    list.innerHTML = people.map(function(row){
      var on = attendedOn(row, kind);
      var bits = [whenLabel(row), row.email || 'No email', row.phone || 'No cell'].join(' · ');
      var note = rosterNote[row.id] ? '<p class="status-line" role="status">' + esc(rosterNote[row.id]) + '</p>' : '';
      var nurtureLine = '';
      if (kind !== '1_1') {
        var person = nurtureById[row.id];
        if (person) {
          var where = person.stopped === 'booked' ? 'They booked a 1:1, so the notes have stopped.'
            : person.stopped === 'done' ? 'The playlist is finished.'
            : person.show_book ? 'Book a 1:1 is on their page.'
            : 'Book a 1:1 is not on their page yet.';
          nurtureLine = '<p class="note">Guides requested: ' + person.request_count + '. ' + where + '</p>';
        } else if (on) {
          nurtureLine = '<p class="note">No personal page. Their house ZIP does not have a contractor.</p>';
        }
      }
      var form = '';
      if (followId === row.id) {
        var profile = profiles[row.id] || {};
        var draft = followCopy(row, kind);
        var emailBlock = profile.opt_in_email === 'no'
          ? '<p class="note">They asked not to be emailed.</p>'
          : (row.email
            ? '<label for="follow-subject-' + row.id + '">Subject</label><input id="follow-subject-' + row.id + '" value="' + esc(draft.subject) + '">' +
              '<label for="follow-email-' + row.id + '">Email</label><textarea id="follow-email-' + row.id + '">' + esc(draft.body) + '</textarea>' +
              '<div class="actions"><button class="btn" type="button" data-send="' + row.id + '" data-channel="email">Send email</button></div>'
            : '<p class="note">There is no email on this signup.</p>');
        var textBlock = profile.opt_in_sms === 'yes'
          ? (row.phone
            ? '<label for="follow-sms-' + row.id + '">Text</label><textarea class="short" id="follow-sms-' + row.id + '">' + esc(draft.sms) + '</textarea>' +
              '<div class="actions"><button class="btn quiet" type="button" data-send="' + row.id + '" data-channel="sms">Send text</button></div>'
            : '<p class="note">There is no cell on this signup.</p>')
          : '<p class="note">They have not agreed to texts. Use Text agreement on their family record first.</p>';
        form = '<form class="roster-send"><p>Invite them to ' + esc(draft.next) + '.</p>' + emailBlock + textBlock +
          '<p class="status-line" id="follow-status-' + row.id + '" role="status"></p></form>';
      }
      return '<li><label class="roster-attend"><input type="checkbox" data-attend="' + row.id + '"' + (on ? ' checked' : '') + '> Attended</label>' +
        '<span class="roster-who"><b>' + esc(row.name || 'No name') + '</b><span class="meta">' + esc(bits) + '</span></span>' +
        '<button class="btn quiet" type="button" data-follow="' + row.id + '">' + (followId === row.id ? 'Close' : 'Follow up') + '</button>' +
        note + nurtureLine + form + '</li>';
    }).join('');
  }

  function signupById(id){
    return signups.filter(function(row){ return row.id === id; })[0] || null;
  }

  function sendFollow(id, channel){
    var row = signupById(id);
    var subject = document.getElementById('follow-subject-' + id);
    var body = document.getElementById(channel === 'sms' ? 'follow-sms-' + id : 'follow-email-' + id);
    var status = document.getElementById('follow-status-' + id);
    var to = row ? (channel === 'sms' ? row.phone : row.email) : '';
    if (!body || !String(body.value).trim()) {
      if (status) status.textContent = 'Write the message first.';
      return;
    }
    if (!to) {
      if (status) status.textContent = channel === 'sms' ? 'There is no cell on this signup.' : 'There is no email on this signup.';
      return;
    }
    if (status) status.textContent = channel === 'sms' ? 'Sending the text…' : 'Sending the email…';
    api('/office/send', {method:'POST', body:{
      registration_id: id,
      channel: channel,
      to: to,
      subject: subject ? subject.value : '',
      body: body.value
    }}).then(function(data){
      if (!data.configured || data.ok === false) {
        rosterNote[id] = data.message || 'This was not sent.';
        renderRoster();
        return;
      }
      followId = 0;
      rosterNote[id] = channel === 'sms' ? 'Text sent.' : 'Email sent.';
      renderRoster();
    }).catch(function(err){
      if (status) status.textContent = err.message;
    });
  }

  function renderSignups(){
    var table = document.getElementById('signup-table');
    var body = document.getElementById('signup-rows');
    var empty = document.getElementById('signup-empty');
    if (!table || !body || !empty) return;
    fillSessionFilter();
    var rows = signups.filter(function(row){
      if (!row.meeting_id) return false;
      return !signupFilter || sessionTitle(row) === signupFilter;
    }).sort(function(a, b){
      if (a.occurrence_at < b.occurrence_at) return -1;
      if (a.occurrence_at > b.occurrence_at) return 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    empty.hidden = rows.length > 0;
    table.hidden = rows.length === 0;
    empty.textContent = signups.length && signupFilter
      ? 'No one has signed up for this session.'
      : 'No one has signed up yet.';
    body.innerHTML = rows.map(function(row){
      var session = window.AIPA_SEMINAR.date(row.occurrence_at);
      var notes = isFamily(row)
        ? '<button class="notes-open" type="button" data-notes="' + row.id + '" aria-pressed="' + (notesId === row.id) + '">Notes</button>'
        : '';
      return '<tr>' +
        '<td>' + notes + '</td>' +
        '<td>' + esc(sessionTitle(row)) + '</td>' +
        '<td>' + esc(session) + '</td>' +
        '<td>' + esc(row.name) + '</td>' +
        '<td>' + esc(row.email) + '</td>' +
        '<td>' + esc(row.phone || '') + '</td>' +
        '<td>' + guestCell(row, 'name') + '</td>' +
        '<td>' + guestCell(row, 'email') + '</td>' +
        '<td>' + guestCell(row, 'phone') + '</td>' +
      '</tr>';
    }).join('');
    body.querySelectorAll('[data-notes]').forEach(function(button){
      button.addEventListener('click', function(){
        var id = Number(button.dataset.notes);
        if (notesId === id) closeNotes();
        else openNotes(id);
      });
    });
  }

  function render(){
    var list = document.getElementById('meeting-list');
    var shown = meetings.filter(function(meeting){ return !filter || meeting.status === filter; });
    list.innerHTML = shown.map(function(meeting){
      var when = window.AIPA_SEMINAR.format(meeting);
      var typeName = window.AIPA_SEMINAR.typeLabel(meeting.meeting_type);
      return '<li><button type="button" data-id="' + meeting.id + '" aria-current="' + (current && current.id === meeting.id) + '">' +
        '<span class="t">' + esc(meeting.title) + '</span>' +
        '<span class="meta"><span class="badge ' + esc(meeting.status) + '">' + esc(label(meeting.status)) + '</span>' +
        (typeName ? ' · ' + esc(typeName) : '') + ' · ' + esc(when) + '</span>' +
        '</button></li>';
    }).join('') || '<li><p class="note">No meetings in this list.</p></li>';
    renderRoster();
    list.querySelectorAll('button').forEach(function(button){
      button.addEventListener('click', function(){
        var id = Number(button.dataset.id);
        if (!current || current.id !== id) followId = 0;
        current = meetings.filter(function(meeting){ return meeting.id === id; })[0] || null;
        fill();
        render();
        var roster = document.getElementById('seminar-roster');
        if (roster && !roster.hidden) roster.scrollIntoView({behavior:'smooth', block:'nearest'});
      });
    });
  }

  function renderNurture(){
    var list = document.getElementById('nurture-order');
    var add = document.getElementById('nurture-add');
    if (!list || !add) return;
    var titles = {};
    nurtureGuides.forEach(function(guide){ titles[guide.id] = guide.title; });
    list.innerHTML = nurtureOrder.length ? nurtureOrder.map(function(id, index){
      return '<li><span>' + esc(titles[id] || 'Guide') + '</span> <button type="button" data-nurture-up="' + index + '">Up</button> <button type="button" data-nurture-down="' + index + '">Down</button> <button type="button" data-nurture-remove="' + index + '">Remove</button></li>';
    }).join('') : '<li>No guides on the playlist yet.</li>';
    var used = {};
    nurtureOrder.forEach(function(id){ used[id] = true; });
    add.innerHTML = '<option value="">Add a guide</option>' + nurtureGuides.filter(function(guide){
      return !used[guide.id];
    }).map(function(guide){
      return '<option value="' + guide.id + '">' + esc(guide.title) + '</option>';
    }).join('');
  }

  function paintNurture(data){
    data = data || {};
    var min = document.getElementById('nurture-min');
    var video = document.getElementById('nurture-video');
    if (min) min.value = data.nurture_min || 0;
    if (video) video.value = data.nurture_video || '';
    nurtureGuides = rows(data.guides);
    nurtureOrder = rows(data.playlist).map(function(row){ return row.id; });
    nurtureById = {};
    rows(data.people).forEach(function(person){ nurtureById[person.registration_id] = person; });
    renderNurture();
  }

  function paintZoom(){
    var input = document.getElementById('standing-zoom');
    var summary = document.getElementById('zoom-summary');
    if (!input || !summary) return;
    var url = input.value.trim();
    summary.textContent = url;
    summary.hidden = !url;
  }

  function load(){
    if (!token()) return Promise.resolve();
    return Promise.all([
      api('/office/zoom'),
      api('/office/meetings'),
      api('/office/signups').catch(function(){ return []; }),
      api('/office/households').catch(function(){ return {}; }),
      api('/office/nurture').catch(function(){ return {}; }),
      (window.AIPA_MESSAGES ? AIPA_MESSAGES.load() : Promise.resolve())
    ]).then(function(result){
      document.getElementById('standing-zoom').value = (result[0] && result[0].zoom_url) || '';
      paintZoom();
      meetings = rows(result[1]);
      signups = rows(result[2]);
      profiles = {};
      rows((result[3] || {}).profiles).forEach(function(profile){
        profiles[profile.registration_id] = profile;
      });
      paintNurture(result[4] || {});
      render();
      renderSignups();
    }).catch(function(err){
      msg.textContent = err.message;
    });
  }

  function save(status){
    var payload = {
      id: current && current.id ? current.id : 0,
      title: document.getElementById('meeting-title').value,
      meeting_type: document.getElementById('meeting-type').value,
      summary: document.getElementById('meeting-summary').value,
      kind: kind(),
      frequency: document.getElementById('meeting-frequency').value,
      status: status,
      starts_at: document.getElementById('meeting-starts').value,
      timezone: document.getElementById('meeting-zone').value,
      duration_minutes: Number(document.getElementById('meeting-duration').value) || 45,
      zoom_url: document.getElementById('meeting-zoom').value,
      remind_email: document.getElementById('remind-email').checked,
      remind_sms: document.getElementById('remind-sms').checked,
      remind_hours_before: Number(document.getElementById('remind-hours').value) || 24
    };
    msg.textContent = 'Saving…';
    return api('/office/meeting', {method:'POST', body:payload}).then(function(saved){
      return load().then(function(){
        current = meetings.filter(function(meeting){ return meeting.id === saved.id; })[0] || saved;
        fill();
        render();
        msg.textContent = status === 'published' ? 'This meeting is live.' : status === 'retired' ? 'This meeting is retired and off the site.' : 'Draft saved. It is not on the site.';
      });
    }).catch(function(err){ msg.textContent = err.message; });
  }

  document.getElementById('meeting-editor').addEventListener('submit', function(e){
    e.preventDefault();
    save('draft');
  });

  document.getElementById('standing-zoom').addEventListener('input', paintZoom);

  document.getElementById('nurture-add').addEventListener('change', function(){
    var id = Number(this.value);
    if (!id) return;
    nurtureOrder.push(id);
    this.value = '';
    renderNurture();
  });
  document.getElementById('nurture-order').addEventListener('click', function(event){
    var button = event.target.closest('button');
    if (!button) return;
    var index = Number(button.getAttribute('data-nurture-up') || button.getAttribute('data-nurture-down') || button.getAttribute('data-nurture-remove'));
    if (button.hasAttribute('data-nurture-up') && index > 0) {
      var up = nurtureOrder[index - 1];
      nurtureOrder[index - 1] = nurtureOrder[index];
      nurtureOrder[index] = up;
    }
    if (button.hasAttribute('data-nurture-down') && index < nurtureOrder.length - 1) {
      var down = nurtureOrder[index + 1];
      nurtureOrder[index + 1] = nurtureOrder[index];
      nurtureOrder[index] = down;
    }
    if (button.hasAttribute('data-nurture-remove')) nurtureOrder.splice(index, 1);
    renderNurture();
  });
  document.getElementById('nurture-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('nurture-status');
    status.textContent = 'Saving…';
    api('/office/nurture', {method:'POST', body:{
      nurture_min: Number(document.getElementById('nurture-min').value) || 0,
      nurture_video: document.getElementById('nurture-video').value.trim(),
      article_ids: nurtureOrder.join(',')
    }}).then(function(){
      status.textContent = 'Follow-up saved.';
      return load();
    }).catch(function(err){ status.textContent = err.message; });
  });

  document.getElementById('zoom-form').addEventListener('submit', function(e){
    e.preventDefault();
    var status = document.getElementById('zoom-status');
    status.textContent = 'Saving…';
    api('/office/zoom', {method:'POST', body:{zoom_url: document.getElementById('standing-zoom').value.trim()}})
      .then(function(data){
        document.getElementById('standing-zoom').value = data.zoom_url || '';
        paintZoom();
        status.textContent = data.zoom_url ? 'Standing Zoom link saved.' : 'Standing Zoom link cleared.';
      })
      .catch(function(err){ status.textContent = err.message; });
  });

  document.getElementById('new-meeting').addEventListener('click', function(){
    current = null;
    fill();
    render();
    document.getElementById('meeting-title').focus();
  });
  document.getElementById('meeting-draft').addEventListener('click', function(){ save('draft'); });
  document.getElementById('meeting-publish').addEventListener('click', function(){ save('published'); });
  document.getElementById('meeting-retire').addEventListener('click', function(){
    if (!current || !current.id) { msg.textContent = 'Save the meeting before retiring it.'; return; }
    if (!window.confirm('Retire this meeting? It will leave the public schedule.')) return;
    save('retired');
  });
  document.querySelectorAll('[data-seminar-filter]').forEach(function(button){
    button.addEventListener('click', function(){
      filter = button.dataset.seminarFilter;
      document.querySelectorAll('[data-seminar-filter]').forEach(function(other){
        other.setAttribute('aria-pressed', String(other === button));
      });
      render();
    });
  });
  document.getElementById('signup-session').addEventListener('change', function(){
    if (fillingSessions) return;
    signupFilter = document.getElementById('signup-session').value;
    renderSignups();
  });
  document.getElementById('family-notes-form').addEventListener('submit', saveNotes);
  document.getElementById('notes-close').addEventListener('click', closeNotes);
  document.getElementById('add-attendee').addEventListener('click', function(){ addPerson(); });
  document.getElementById('add-suggestion').addEventListener('click', function(){ addGuide(); });

  var rosterList = document.getElementById('roster-list');
  if (rosterList) {
    rosterList.addEventListener('submit', function(event){ event.preventDefault(); });
    rosterList.addEventListener('change', function(event){
      var box = event.target;
      if (!box || !box.hasAttribute('data-attend')) return;
      var id = Number(box.getAttribute('data-attend'));
      var row = signupById(id);
      var kind = rosterKind(current);
      if (!row || !kind) return;
      var on = box.checked;
      box.disabled = true;
      api('/office/attendance', {method:'POST', body:{registration_id:id, kind:kind, attended:on}}).then(function(data){
        data = data || {};
        row.attended_seminar = data.attended_seminar != null ? data.attended_seminar : (kind === 'seminar' ? (on ? 'yes' : '') : row.attended_seminar);
        row.attended_1_1 = data.attended_1_1 != null ? data.attended_1_1 : (kind === '1_1' ? (on ? 'yes' : '') : row.attended_1_1);
        box.checked = attendedOn(row, kind);
        box.disabled = false;
      }).catch(function(err){
        box.checked = !on;
        box.disabled = false;
        rosterNote[id] = err.message;
        renderRoster();
      });
    });
    rosterList.addEventListener('click', function(event){
      var follow = event.target.closest('[data-follow]');
      if (follow) {
        var next = Number(follow.getAttribute('data-follow'));
        followId = followId === next ? 0 : next;
        if (followId) delete rosterNote[followId];
        renderRoster();
        return;
      }
      var send = event.target.closest('[data-send]');
      if (!send) return;
      sendFollow(Number(send.getAttribute('data-send')), send.getAttribute('data-channel'));
    });
  }

  window.AIPA_SEMINARS = { load: load };
  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function(event){
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
  }
  var signout = document.getElementById('signout');
  if (signout) {
    signout.addEventListener('click', function(event){
      event.preventDefault();
      sessionStorage.removeItem(KEY);
      showLogin(true);
    });
  }
  if (token()) { showLogin(false); load(); }
  else showLogin(true);
})();
