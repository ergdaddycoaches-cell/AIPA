(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = window.AIPA_OFFICE ? window.AIPA_OFFICE.KEY : 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var listEl = document.getElementById('staff-list');
  var people = [];
  var contractors = [];
  var selectedId = 0;

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
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
    }).then(function(response){
      return response.json().catch(function(){ return {}; }).then(function(data){
        if (response.status === 401) {
          window.AIPA_OFFICE.clear();
          showLogin(true);
        }
        if (!response.ok) {
          var error = new Error(data.message || data.error || 'Something went wrong.');
          error.status = response.status;
          throw error;
        }
        return data;
      });
    });
  }
  function selected(){
    return people.filter(function(person){ return person.id === selectedId; })[0] || null;
  }
  function renderList(){
    listEl.innerHTML = people.map(function(person){
      var kind = person.role === 'guide' ? 'Guide' : 'Admin';
      var count = contractors.filter(function(row){ return row.guide_user_id === person.id; }).length;
      return '<li><button type="button" data-id="' + person.id + '" aria-current="' + (person.id === selectedId) + '">' +
        '<span class="t">' + esc(person.name) + '</span>' +
        '<span class="meta">' + esc(kind) + ' · ' + esc(person.email) + (person.role === 'guide' ? ' · ' + count + ' contractor' + (count === 1 ? '' : 's') : '') + '</span>' +
        '</button></li>';
    }).join('') || '<li><p class="note">No office logins yet.</p></li>';
    listEl.querySelectorAll('button').forEach(function(button){
      button.addEventListener('click', function(){
        selectedId = Number(button.dataset.id);
        fillAssign();
        renderList();
      });
    });
  }
  function fillAssign(){
    var person = selected();
    var form = document.getElementById('assign-form');
    if (!person || person.role !== 'guide') {
      form.hidden = true;
      return;
    }
    form.hidden = false;
    document.getElementById('assign-title').textContent = person.name;
    document.getElementById('assign-user-id').value = person.id;
    document.getElementById('assign-zoom').value = person.zoom_url || '';
    document.getElementById('assign-status').textContent = '';
    document.getElementById('assign-contractors').innerHTML = contractors.map(function(row){
      var taken = row.guide_user_id && row.guide_user_id !== person.id;
      var owner = people.filter(function(item){ return item.id === row.guide_user_id; })[0];
      var note = taken && owner ? ' (now with ' + owner.name + ')' : '';
      return '<label class="check"><input type="checkbox" name="contractor" value="' + row.id + '"' +
        (row.guide_user_id === person.id ? ' checked' : '') + '> ' + esc(row.name) + esc(note) + '</label>';
    }).join('') || '<p class="note">No contractors yet.</p>';
  }
  function load(){
    return api('/office/staff').then(function(data){
      people = data.people || [];
      contractors = data.contractors || [];
      if (selectedId && !selected()) selectedId = 0;
      renderList();
      fillAssign();
    });
  }

  document.getElementById('login-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('login-status');
    status.textContent = 'Signing in…';
    api('/auth/login', {method:'POST', auth:false, body: window.AIPA_OFFICE.creds()})
      .then(function(data){
        window.AIPA_OFFICE.save(data);
        document.getElementById('password').value = '';
        status.textContent = '';
        showLogin(false);
        return load();
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(event){
    event.preventDefault();
    window.AIPA_OFFICE.clear();
    showLogin(true);
  });
  document.getElementById('staff-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('staff-status');
    status.textContent = 'Saving…';
    api('/office/staff', {
      method: 'POST',
      body: {
        name: document.getElementById('staff-name').value,
        email: document.getElementById('staff-email').value,
        password: document.getElementById('staff-password').value
      }
    }).then(function(person){
      document.getElementById('staff-form').reset();
      status.textContent = 'Guide added.';
      selectedId = person.id || 0;
      return load();
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('assign-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('assign-status');
    var ids = [];
    document.querySelectorAll('#assign-contractors input:checked').forEach(function(box){
      ids.push(box.value);
    });
    status.textContent = 'Saving…';
    api('/office/staff-guide', {
      method: 'POST',
      body: {
        user_id: Number(document.getElementById('assign-user-id').value),
        zoom_url: document.getElementById('assign-zoom').value,
        contractor_ids: ids.join(',')
      }
    }).then(function(){
      status.textContent = 'Roster saved.';
      return load();
    }).catch(function(err){ status.textContent = err.message; });
  });

  if (token()) {
    showLogin(false);
    load().catch(function(err){
      if (err.status === 401) return;
      document.getElementById('staff-status').textContent = err.message;
    });
  }
})();
