(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var listEl = document.getElementById('row-list');
  var form = document.getElementById('row-form');
  var rows = [];
  var currentId = 0;

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function list(value){
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
  function selected(){
    return rows.filter(function(row){ return row.id === currentId; })[0] || null;
  }
  function nextSort(){
    var max = 0;
    rows.forEach(function(row){ if ((row.sort || 0) > max) max = row.sort; });
    return max + 10;
  }
  function fillAreas(){
    var seen = {};
    var names = [];
    rows.forEach(function(row){
      var area = row.area || '';
      var key = area.toLowerCase();
      if (!area || seen[key]) return;
      seen[key] = true;
      names.push(area);
    });
    document.getElementById('area-list').innerHTML = names.map(function(name){
      return '<option value="' + esc(name) + '"></option>';
    }).join('');
  }
  function fillForm(){
    var row = selected();
    fillAreas();
    document.getElementById('area').value = row ? row.area : '';
    document.getElementById('label').value = row ? row.label : '';
    document.getElementById('target').value = row ? row.target : '';
    document.getElementById('means').value = row ? row.means : '';
    document.getElementById('source').value = row ? row.source : '';
    document.getElementById('sort').value = row ? row.sort : nextSort();
    document.getElementById('row-remove').hidden = !row;
    document.getElementById('row-status').textContent = '';
  }
  function renderList(){
    listEl.innerHTML = rows.map(function(row){
      return '<li><button type="button" data-id="' + row.id + '" aria-current="' + (row.id === currentId) + '">' +
        '<span class="t">' + esc(row.label) + '</span>' +
        '<span class="meta">' + esc(row.area) + ' · ' + esc(row.target) + '</span></button></li>';
    }).join('') || '<li><p class="note">No measurements yet.</p></li>';
  }
  function load(){
    return api('/office/standards').then(function(data){
      rows = list(data);
      if (currentId && !selected()) currentId = 0;
      renderList();
      fillForm();
    });
  }

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
        return load();
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(){
    sessionStorage.removeItem(KEY);
    showLogin(true);
  });
  document.getElementById('row-new').addEventListener('click', function(){
    currentId = 0;
    renderList();
    fillForm();
    document.getElementById('area').focus();
  });
  listEl.addEventListener('click', function(event){
    var button = event.target.closest('button');
    if (!button) return;
    currentId = Number(button.dataset.id) || 0;
    renderList();
    fillForm();
  });
  form.addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('row-status');
    status.textContent = 'Saving…';
    api('/office/standards', {method:'POST', body:{
      id: currentId,
      area: document.getElementById('area').value,
      label: document.getElementById('label').value,
      target: document.getElementById('target').value,
      means: document.getElementById('means').value,
      source: document.getElementById('source').value,
      sort: Number(document.getElementById('sort').value) || 0
    }}).then(function(saved){
      currentId = saved && saved.id ? saved.id : currentId;
      return load();
    }).then(function(){
      document.getElementById('row-status').textContent = 'Saved.';
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('row-remove').addEventListener('click', function(){
    var row = selected();
    if (!row) return;
    if (!window.confirm('Remove “' + row.label + '” from the standards?')) return;
    var status = document.getElementById('row-status');
    status.textContent = 'Removing…';
    api('/office/standards-remove', {method:'POST', body:{id: row.id}})
      .then(function(){
        currentId = 0;
        return load();
      })
      .catch(function(err){ status.textContent = err.message; });
  });

  if (token()) { showLogin(false); load().catch(function(err){ document.getElementById('row-status').textContent = err.message; }); }
  else showLogin(true);
})();
