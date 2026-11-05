(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = window.AIPA_OFFICE ? window.AIPA_OFFICE.KEY : 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var listEl = document.getElementById('staff-list');

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
  function rows(value){
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }
  function render(people){
    listEl.innerHTML = rows(people).map(function(person){
      var kind = person.role === 'guide' ? 'Guide' : 'Admin';
      return '<li><span class="t">' + esc(person.name) + '</span><span class="meta">' + esc(kind) + ' · ' + esc(person.email) + '</span></li>';
    }).join('') || '<li><p class="note">No office logins yet.</p></li>';
  }
  function load(){
    return api('/office/staff').then(render);
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
    }).then(function(){
      document.getElementById('staff-form').reset();
      status.textContent = 'Guide added.';
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
