(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var meetings = [];
  var signups = [];
  var filter = '';
  var signupFilter = '';
  var fillingSessions = false;
  var current = null;
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
  function api(path, options){
    options = options || {};
    var headers = {'Accept':'application/json', Authorization:'Bearer ' + token()};
    if (options.body) headers['Content-Type'] = 'application/json';
    return fetch(base + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data){
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
    signups.forEach(function(row){ names[sessionTitle(row)] = true; });
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

  function renderSignups(){
    var table = document.getElementById('signup-table');
    var body = document.getElementById('signup-rows');
    var empty = document.getElementById('signup-empty');
    if (!table || !body || !empty) return;
    fillSessionFilter();
    var rows = signups.filter(function(row){
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
      var meeting = meetings.filter(function(item){ return item.id === row.meeting_id; })[0];
      var session = window.AIPA_SEMINAR.format({
        starts_at: row.occurrence_at,
        timezone: meeting ? meeting.timezone : 'America/Los_Angeles',
        kind: 'one_time'
      });
      return '<tr>' +
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
    list.querySelectorAll('button').forEach(function(button){
      button.addEventListener('click', function(){
        var id = Number(button.dataset.id);
        current = meetings.filter(function(meeting){ return meeting.id === id; })[0] || null;
        fill();
        render();
      });
    });
  }

  function load(){
    if (!token()) return Promise.resolve();
    return Promise.all([
      api('/office/zoom'),
      api('/office/meetings'),
      api('/office/signups').catch(function(){ return []; })
    ]).then(function(result){
      document.getElementById('standing-zoom').value = (result[0] && result[0].zoom_url) || '';
      meetings = rows(result[1]);
      signups = rows(result[2]);
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

  document.getElementById('zoom-form').addEventListener('submit', function(e){
    e.preventDefault();
    var status = document.getElementById('zoom-status');
    status.textContent = 'Saving…';
    api('/office/zoom', {method:'POST', body:{zoom_url: document.getElementById('standing-zoom').value.trim()}})
      .then(function(data){
        document.getElementById('standing-zoom').value = data.zoom_url || '';
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

  window.AIPA_SEMINARS = { load: load };
  if (token()) load();
})();
