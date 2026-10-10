(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var embedded = !!document.getElementById('call-window');
  var loginView = document.getElementById('login-view');
  var sheet = document.getElementById('sheet');
  var signout = document.getElementById('signout');
  var peopleBox = document.getElementById('people');
  var familyId = Number(new URLSearchParams(location.search).get('id')) || 0;
  var row = null;
  var profile = null;
  var guides = [];
  var channel = 'email';
  var subjectTouched = false;
  var STYLES = [
    ['protective', 'Protective'],
    ['minimizing', 'Minimizing'],
    ['detail', 'Wants the details'],
    ['action', 'Wants a next step'],
    ['urgent', 'Urgent'],
    ['unsure', 'Not enough to tell']
  ];
  var AREAS = [
    'bathrooms',
    'entries-stairs',
    'kitchens-bedrooms',
    'home-value',
    'materials-lighting',
    'costs-financing',
    'codes-permits',
    'family'
  ];
  var GUIDE_TOKEN = '{{guide}}';
  var GUIDE_LINE = /This is the guide for that:\s*(?:\{\{guide\}\}|\[[^\]]*\]|[^.\n]*)\.?/;

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }
  function rows(value){
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
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
  function showLogin(on){
    if (loginView) loginView.hidden = !on;
    if (sheet) sheet.hidden = on;
    if (signout) signout.hidden = on;
    var dash = document.getElementById('dash');
    if (embedded && dash) dash.hidden = on;
    if (embedded && on) document.getElementById('call-window').hidden = true;
  }
  function paintNotesButton(){
    var openId = 0;
    var el = document.getElementById('call-window');
    if (el && !el.hidden) openId = familyId;
    var button = document.querySelector('[data-act="call-notes"]');
    if (button) button.setAttribute('aria-pressed', openId ? 'true' : 'false');
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
    }).then(function(response){
      return response.json().catch(function(){ return {}; }).then(function(data){
        if (response.status === 401) { sessionStorage.removeItem(KEY); showLogin(true); }
        if (!response.ok) throw new Error(data.message || data.error || 'Something went wrong.');
        return data;
      });
    });
  }
  function e164(value){
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
    if (digits.length > 11) return '+' + digits;
    return '';
  }
  function contacts(family){
    var list = [];
    function add(person){
      if (!person) return;
      var phone = e164(person.phone) || '';
      var email = String(person.email || '').trim();
      var name = String(person.name || '').trim();
      if (!phone && !email) return;
      list.push({name:name, phone:phone, email:email});
    }
    add({name:family.name, phone:family.phone, email:family.email});
    add({name:family.guest_name, phone:family.guest_phone, email:family.guest_email});
    parseList(family.guests).forEach(add);
    return list;
  }
  function destinations(family, kind){
    var seen = {};
    return contacts(family).filter(function(person){
      var value = kind === 'sms' ? person.phone : person.email;
      var key = String(value || '').toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      person.value = value;
      return true;
    });
  }
  function opted(kind){
    if (!profile) return '';
    var flag = kind === 'sms' ? profile.opt_in_call : profile.opt_in_email;
    return String(flag || '').trim().toLowerCase();
  }
  function defaultSubject(){
    var guide = chosenGuide();
    return guide.title ? 'A guide: ' + guide.title : 'Following up on our conversation';
  }
  function messageBody(kind, pdf){
    var note = applyGuideToken(document.getElementById('follow').value.trim(), chosenGuide().title);
    if (kind === 'sms' || !pdf) return note;
    if (note.indexOf(pdf) !== -1) return note;
    var handout = 'Print this guide:\n' + pdf + '\n\nBook an Ask Anything 1:1:\nhttps://goaipa.com/ask-anything/\nOr call 833-AIPA-HUB.';
    return note ? note + '\n\n' + handout : handout;
  }
  function guidePdf(guide){
    if (!guide.slug) return Promise.resolve('');
    return fetch((CFG.apiBase || '').replace(/\/$/, '') + '/library/article?slug=' + encodeURIComponent(guide.slug), {headers:{'Accept':'application/json'}})
      .then(function(response){ return response.json(); })
      .then(function(article){
        if (!article || !article.pdf_url) return 'https://goaipa.com/library/pdf/' + guide.slug + '.pdf';
        return /^https?:/i.test(article.pdf_url) ? article.pdf_url : ('https://goaipa.com' + article.pdf_url);
      })
      .catch(function(){ return 'https://goaipa.com/library/pdf/' + guide.slug + '.pdf'; });
  }
  function drawSend(){
    var emailBtn = document.getElementById('channel-email');
    var textBtn = document.getElementById('channel-text');
    var who = document.getElementById('send-who');
    var whoLabel = document.getElementById('send-who-label');
    var empty = document.getElementById('send-empty');
    var subject = document.getElementById('subject');
    var subjectLabel = document.getElementById('subject-label');
    var note = document.getElementById('send-note');
    var send = document.getElementById('send-message');
    emailBtn.setAttribute('aria-pressed', channel === 'email' ? 'true' : 'false');
    textBtn.setAttribute('aria-pressed', channel === 'sms' ? 'true' : 'false');
    send.textContent = channel === 'sms' ? 'Send text' : 'Send email';
    var people = row ? destinations(row, channel) : [];
    who.innerHTML = people.map(function(person){
      var label = person.name ? person.name + ' · ' + person.value : person.value;
      return '<option value="' + esc(person.value) + '">' + esc(label) + '</option>';
    }).join('');
    var missing = !people.length;
    who.hidden = missing;
    whoLabel.hidden = missing;
    empty.hidden = !missing;
    empty.textContent = channel === 'sms' ? 'There is no number on file.' : 'There is no email on file.';
    var showSubject = channel === 'email';
    subject.hidden = !showSubject;
    subjectLabel.hidden = !showSubject;
    if (showSubject && !subjectTouched) subject.value = defaultSubject();
    var flag = opted(channel);
    if (flag === 'no') {
      note.textContent = channel === 'sms'
        ? 'Not opted in to a phone call, so a text will not send.'
        : 'Not opted in to email, so this will not send.';
    } else if (flag === 'yes') {
      note.textContent = channel === 'sms' ? 'Opted in to a phone call.' : 'Opted in to email.';
    } else note.textContent = '';
  }
  function styleOptions(selected){
    var value = STYLES.some(function(pair){ return pair[0] === selected; }) ? selected : 'unsure';
    return STYLES.map(function(pair){
      return '<option value="' + pair[0] + '"' + (pair[0] === value ? ' selected' : '') + '>' + esc(pair[1]) + '</option>';
    }).join('');
  }
  function applyGuideToken(text, title){
    return String(text || '').replace(/\{\{guide\}\}/g, title || '');
  }
  function ensureGuideToken(seedEmpty){
    var box = document.getElementById('follow');
    if (box.value.indexOf(GUIDE_TOKEN) !== -1) return;
    var text = String(box.value || '').replace(/\r\n/g, '\n').trim();
    var lines = text ? text.split('\n') : [];
    var kept = lines.filter(function(line){
      var trimmed = line.trim();
      return !trimmed || trimmed.replace(GUIDE_LINE, '').trim() !== '';
    });
    var removedLine = kept.length !== lines.length;
    text = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    var hadPhrase = removedLine;
    text = text.replace(new RegExp('\\s*' + GUIDE_LINE.source + '\\s*$'), function(){
      hadPhrase = true;
      return '';
    }).trim();
    if (!hadPhrase && text) return;
    if (!hadPhrase && !seedEmpty) return;
    var sentence = 'This is the guide for that: ' + GUIDE_TOKEN + '.';
    if (!text) box.value = sentence;
    else box.value = text + (/[.!?]$/.test(text) ? ' ' : '. ') + sentence;
  }
  function insertGuideToken(){
    var box = document.getElementById('follow');
    var start = box.selectionStart == null ? box.value.length : box.selectionStart;
    var end = box.selectionEnd == null ? box.value.length : box.selectionEnd;
    var before = box.value.slice(0, start);
    var after = box.value.slice(end);
    var pad = before && !/\s$/.test(before) ? ' ' : '';
    box.value = before + pad + GUIDE_TOKEN + after;
    var caret = before.length + pad.length + GUIDE_TOKEN.length;
    box.focus();
    if (box.setSelectionRange) box.setSelectionRange(caret, caret);
  }
  function guideMenu(articles, currentId, currentTitle){
    var groups = {};
    articles.forEach(function(article){
      var slug = article.section_slug || '';
      if (!groups[slug]) groups[slug] = {name: article.section || 'Other', items: []};
      if (article.section) groups[slug].name = article.section;
      groups[slug].items.push(article);
    });
    var slugs = Object.keys(groups).sort(function(a, b){
      var ia = AREAS.indexOf(a);
      var ib = AREAS.indexOf(b);
      if (ia < 0) ia = 99;
      if (ib < 0) ib = 99;
      if (ia !== ib) return ia - ib;
      return String(groups[a].name).localeCompare(String(groups[b].name));
    });
    var html = '<option value="">No guide</option>';
    var placed = false;
    slugs.forEach(function(slug){
      var group = groups[slug];
      group.items.sort(function(a, b){ return String(a.title).localeCompare(String(b.title)); });
      html += '<optgroup label="' + esc(group.name) + '">';
      group.items.forEach(function(article){
        if (String(article.id) === currentId) placed = true;
        html += '<option value="' + article.id + '">' + esc(article.title) + '</option>';
      });
      html += '</optgroup>';
    });
    if (currentTitle && currentId && !placed) {
      html += '<option value="current">' + esc(currentTitle) + '</option>';
    }
    return html;
  }
  function addPerson(person){
    person = person || {name:'', style:'', note:'', role:'', email:''};
    var block = document.createElement('div');
    block.className = 'call-person';
    block.dataset.role = person.role || '';
    block.dataset.email = person.email || '';
    block.innerHTML =
      '<div class="pair"><label>Name <input class="person-name" type="text" maxlength="120" value="' + esc(person.name || '') + '"></label>' +
      '<label>How they came across <select class="person-style">' + styleOptions(person.style) + '</select></label></div>' +
      '<label>Note <textarea class="person-note" rows="3" maxlength="1000">' + esc(person.note || '') + '</textarea></label>' +
      '<button class="remove" type="button">Remove</button>';
    block.querySelector('.remove').addEventListener('click', function(){
      block.remove();
      if (!peopleBox.children.length) addPerson({name: row ? row.name : ''});
    });
    peopleBox.appendChild(block);
  }
  function fill(family, meetings, articles){
    row = family;
    var meeting = meetings.filter(function(item){ return item.id === family.meeting_id; })[0];
    var allowed = !family.meeting_id || (meeting && meeting.meeting_type === 'family_1_1');
    if (!allowed) {
      document.getElementById('who').textContent = 'That person is not on this board.';
      document.getElementById('notes-form').hidden = true;
      return;
    }
    document.getElementById('who').textContent = family.name || 'Call notes';
    document.getElementById('summary').value = family.summary || '';
    document.getElementById('follow').value = family.follow_up_note || '';
    var listed = articles.filter(function(article){
      return article && article.slug && article.title && (article.status !== 'retired' || String(article.id) === String(family.suggested_article_id || ''));
    });
    guides = listed;
    var currentId = family.suggested_article_id ? String(family.suggested_article_id) : '';
    var currentTitle = family.suggested_title || family.suggested_slug || '';
    var select = document.getElementById('guide');
    select.innerHTML = guideMenu(listed, currentId, currentTitle);
    var known = listed.some(function(article){ return String(article.id) === currentId; });
    if (!known && currentTitle && currentId) currentId = 'current';
    select.value = known || currentId === 'current' ? currentId : '';
    peopleBox.innerHTML = '';
    var people = parseList(family.attendee_reads);
    if (!people.length) people = [{name: family.name || '', style:'', note:''}];
    people.forEach(addPerson);
    subjectTouched = false;
    if (chosenGuide().title) ensureGuideToken(false);
    setCallback(family.callback_requested === true || family.callback_requested === 1, callbackDate(family.callback_requested_at));
    setDelay(family.delayed_email === true || family.delayed_email === 1, callbackDate(family.delayed_email_at), family.delayed_email_subject || '', family.delayed_email_body || '', family.delayed_email_guide || '');
    drawSend();
  }
  function callbackDate(value){
    var match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ''));
    return match ? match[1] : '';
  }
  function setCallback(on, date){
    var yes = document.getElementById('callback-yes');
    var no = document.getElementById('callback-no');
    var box = document.getElementById('callback-date');
    if (!yes || !no || !box) return;
    yes.setAttribute('aria-pressed', on ? 'true' : 'false');
    no.setAttribute('aria-pressed', on ? 'false' : 'true');
    box.disabled = !on;
    if (!on) box.value = '';
    else if (date != null) box.value = date;
  }
  function setDelay(on, date, subject, body, guide) {
    var yes = document.getElementById('delay-yes');
    var no = document.getElementById('delay-no');
    var fields = ['delay-date', 'delay-subject', 'delay-guide', 'delay-body'].map(function(id){
      return document.getElementById(id);
    });
    var insert = document.getElementById('delay-insert');
    if (!yes || !no || fields.some(function(field){ return !field; })) return;
    yes.setAttribute('aria-pressed', on ? 'true' : 'false');
    no.setAttribute('aria-pressed', on ? 'false' : 'true');
    fields.forEach(function(field){ field.disabled = !on; });
    if (insert) insert.disabled = !on;
    if (!on) fields.forEach(function(field){ field.value = ''; });
    else {
      if (date != null) document.getElementById('delay-date').value = date;
      if (subject != null) document.getElementById('delay-subject').value = subject;
      if (body != null) document.getElementById('delay-body').value = body;
      if (guide != null) document.getElementById('delay-guide').value = guide;
    }
  }
  function delayOn(){
    var yes = document.getElementById('delay-yes');
    return !!(yes && yes.getAttribute('aria-pressed') === 'true');
  }
  function collectedPeople(){
    return Array.prototype.map.call(peopleBox.children, function(block){
      return {
        name: block.querySelector('.person-name').value,
        style: block.querySelector('.person-style').value,
        note: block.querySelector('.person-note').value,
        role: block.dataset.role || '',
        email: block.dataset.email || ''
      };
    }).filter(function(person){
      return person.name || person.style || person.note || person.role || person.email;
    });
  }
  function chosenGuide(){
    var value = document.getElementById('guide').value;
    if (!value) return {id:0, slug:'', title:''};
    if (value === 'current') {
      return {
        id: row.suggested_article_id || 0,
        slug: row.suggested_slug || '',
        title: row.suggested_title || ''
      };
    }
    var article = guides.filter(function(item){ return String(item.id) === value; })[0];
    if (!article) return {id:0, slug:'', title:''};
    return {id: article.id, slug: article.slug, title: article.title};
  }
  function load(){
    if (!familyId) {
      document.getElementById('who').textContent = 'Choose someone from the pipeline.';
      document.getElementById('notes-form').hidden = true;
      return Promise.resolve();
    }
    return Promise.all([
      api('/office/signups'),
      api('/office/meetings'),
      api('/office/articles').catch(function(){ return []; }),
      api('/office/households').catch(function(){ return {profiles:[]}; })
    ]).then(function(result){
      var family = rows(result[0]).filter(function(item){ return item.id === familyId; })[0];
      if (!family) {
        document.getElementById('who').textContent = 'That family could not be found.';
        document.getElementById('notes-form').hidden = true;
        return;
      }
      var profiles = result[3] && Array.isArray(result[3].profiles) ? result[3].profiles : [];
      profile = profiles.filter(function(item){ return item.registration_id === family.id; })[0] || null;
      fill(family, rows(result[1]), rows(result[2]));
    }).catch(function(err){
      document.getElementById('notes-status').textContent = err.message;
    });
  }

  function saveNotes(){
    if (delayOn() && !document.getElementById('delay-date').value) {
      return Promise.reject(new Error('Add the date for the delayed email.'));
    }
    var guide = chosenGuide();
    return api('/office/call-notes', {method:'POST', body:{
      id: row.id,
      summary: document.getElementById('summary').value,
      suggested_article_id: guide.id,
      suggested_slug: guide.slug,
      suggested_title: guide.title,
      follow_up_note: document.getElementById('follow').value,
      attendee_reads: JSON.stringify(collectedPeople())
    }}).then(function(){
      var yes = document.getElementById('callback-yes');
      var wants = yes && yes.getAttribute('aria-pressed') === 'true';
      return api('/office/callback', {method:'POST', body:{
        registration_id: row.id,
        requested: !!wants,
        callback_at: wants ? document.getElementById('callback-date').value : ''
      }});
    }).then(function(){
      return api('/office/delayed-email', {method:'POST', body:{
        registration_id: row.id,
        requested: delayOn(),
        email_at: delayOn() ? document.getElementById('delay-date').value : '',
        subject: delayOn() ? document.getElementById('delay-subject').value : '',
        body: delayOn() ? document.getElementById('delay-body').value : '',
        guide: delayOn() ? document.getElementById('delay-guide').value : ''
      }});
    }).then(function(){
      window.dispatchEvent(new CustomEvent('aipa-family-changed'));
    });
  }
  function sendCurrent(){
    var status = document.getElementById('send-status');
    var notes = document.getElementById('notes-status');
    if (!row) return;
    if (opted(channel) === 'no') {
      status.textContent = channel === 'sms'
        ? 'They have not opted in to a phone call, so this text was not sent.'
        : 'They have not opted in to email, so this was not sent.';
      return;
    }
    var who = document.getElementById('send-who');
    if (!who.value) {
      status.textContent = channel === 'sms' ? 'There is no number on file.' : 'There is no email on file.';
      return;
    }
    var guide = chosenGuide();
    if (document.getElementById('follow').value.indexOf(GUIDE_TOKEN) !== -1 && !guide.title) {
      status.textContent = 'Pick a guide so {{guide}} has a name.';
      return;
    }
    var subject = channel === 'email' ? document.getElementById('subject').value.trim() : '';
    if (channel === 'email' && !subject) { status.textContent = 'Add a subject.'; return; }
    status.textContent = 'Saving…';
    notes.textContent = '';
    saveNotes().then(function(){
      return channel === 'email' ? guidePdf(guide) : Promise.resolve('');
    }).then(function(pdf){
      var body = messageBody(channel, pdf);
      if (!body) { status.textContent = 'Write the message first.'; return null; }
      status.textContent = channel === 'sms' ? 'Sending the text…' : 'Sending the email…';
      return api('/office/send', {method:'POST', body:{
        registration_id: row.id,
        channel: channel,
        to: who.value,
        subject: subject,
        body: body
      }});
    }).then(function(data){
      if (!data) return null;
      var line = data.message || (data.ok ? (channel === 'sms' ? 'Text sent.' : 'Email sent.') : 'This was not sent.');
      return load().then(function(){ document.getElementById('send-status').textContent = line; });
    }).catch(function(err){ status.textContent = err.message; });
  }

  document.getElementById('add-person').addEventListener('click', function(){ addPerson(); });
  document.getElementById('callback-yes').addEventListener('click', function(){ setCallback(true); });
  document.getElementById('callback-no').addEventListener('click', function(){ setCallback(false); });
  document.getElementById('delay-yes').addEventListener('click', function(){
    var guide = document.getElementById('delay-guide');
    var fillGuide = guide && !guide.value ? chosenGuide().title : null;
    setDelay(true, document.getElementById('delay-date').value, document.getElementById('delay-subject').value, document.getElementById('delay-body').value, fillGuide);
  });
  document.getElementById('delay-no').addEventListener('click', function(){ setDelay(false); });
  setDelay(false);
  document.getElementById('delay-insert').addEventListener('click', function(){
    var box = document.getElementById('delay-body');
    var start = box.selectionStart == null ? box.value.length : box.selectionStart;
    var end = box.selectionEnd == null ? box.value.length : box.selectionEnd;
    var before = box.value.slice(0, start);
    var after = box.value.slice(end);
    var pad = before && !/\s$/.test(before) ? ' ' : '';
    box.value = before + pad + GUIDE_TOKEN + after;
    var caret = before.length + pad.length + GUIDE_TOKEN.length;
    box.focus();
    if (box.setSelectionRange) box.setSelectionRange(caret, caret);
  });
  var jump = document.querySelector('.call-jump');
  if (jump) jump.addEventListener('click', function(event){
    var link = event.target.closest('a');
    if (!link) return;
    var target = document.getElementById((link.getAttribute('href') || '').replace('#', ''));
    var scroller = document.querySelector('.call-window-body');
    if (!target) return;
    event.preventDefault();
    if (scroller) {
      var top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth'});
    } else {
      target.scrollIntoView({block: 'start'});
    }
  });
  document.getElementById('channel-email').addEventListener('click', function(){ channel = 'email'; drawSend(); });
  document.getElementById('channel-text').addEventListener('click', function(){ channel = 'sms'; drawSend(); });
  document.getElementById('subject').addEventListener('input', function(){ subjectTouched = true; });
  document.getElementById('guide').addEventListener('change', function(){
    var guide = chosenGuide();
    if (guide.title) ensureGuideToken(true);
    if (!subjectTouched) document.getElementById('subject').value = defaultSubject();
  });
  document.getElementById('insert-guide').addEventListener('click', insertGuideToken);
  document.getElementById('send-message').addEventListener('click', sendCurrent);
  document.getElementById('notes-form').addEventListener('submit', function(event){
    event.preventDefault();
    if (!row) return;
    var status = document.getElementById('notes-status');
    status.textContent = 'Saving…';
    document.getElementById('send-status').textContent = '';
    saveNotes().then(function(){
      status.textContent = '';
      return load();
    }).then(function(){
      var line = document.getElementById('notes-status');
      if (!line.textContent) line.textContent = 'Saved.';
    }).catch(function(err){ status.textContent = err.message; });
  });
  if (!embedded) {
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
  } else {
    var notesWindow = document.getElementById('call-window');
    var notesCard = notesWindow.querySelector('.call-window-card');
    var dragBar = document.getElementById('call-drag');
    var parked = false;
    function park(){
      var width = Math.min(notesCard.offsetWidth || 480, window.innerWidth - 24);
      var height = Math.min(notesCard.offsetHeight || 420, Math.round(window.innerHeight * 0.72));
      notesCard.style.width = width + 'px';
      notesCard.style.maxHeight = height + 'px';
      notesCard.style.left = Math.max(12, window.innerWidth - width - 16) + 'px';
      notesCard.style.top = Math.max(12, window.innerHeight - height - 16) + 'px';
      notesCard.style.right = 'auto';
      notesCard.style.bottom = 'auto';
    }
    function openNotes(id){
      notesWindow.hidden = false;
      if (!parked) { park(); parked = true; }
      if (familyId !== id) {
        familyId = id;
        row = null;
        load();
      }
      paintNotesButton();
    }
    function closeNotes(){
      notesWindow.hidden = true;
      paintNotesButton();
    }
    document.getElementById('call-close').addEventListener('click', closeNotes);
    document.addEventListener('keydown', function(event){
      if (event.key === 'Escape' && !notesWindow.hidden) closeNotes();
    });
    dragBar.addEventListener('pointerdown', function(event){
      if (event.target.closest('button')) return;
      var startX = event.clientX;
      var startY = event.clientY;
      var rect = notesCard.getBoundingClientRect();
      var originX = rect.left;
      var originY = rect.top;
      try { dragBar.setPointerCapture(event.pointerId); } catch (err) {}
      function move(ev){
        var x = originX + (ev.clientX - startX);
        var y = originY + (ev.clientY - startY);
        var width = notesCard.offsetWidth;
        var height = dragBar.offsetHeight;
        x = Math.min(Math.max(16 - width, x), window.innerWidth - 48);
        y = Math.min(Math.max(8, y), window.innerHeight - height - 8);
        notesCard.style.left = x + 'px';
        notesCard.style.top = y + 'px';
        notesCard.style.right = 'auto';
        notesCard.style.bottom = 'auto';
      }
      function end(ev){
        dragBar.removeEventListener('pointermove', move);
        dragBar.removeEventListener('pointerup', end);
        dragBar.removeEventListener('pointercancel', end);
        if (dragBar.hasPointerCapture(ev.pointerId)) dragBar.releasePointerCapture(ev.pointerId);
      }
      dragBar.addEventListener('pointermove', move);
      dragBar.addEventListener('pointerup', end);
      dragBar.addEventListener('pointercancel', end);
    });
    window.AIPA_CALL_NOTES = {
      open: openNotes,
      current: function(){ return notesWindow.hidden ? 0 : familyId; }
    };
  }
})();
