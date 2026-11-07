(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = window.AIPA_OFFICE ? window.AIPA_OFFICE.KEY : 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');

  function token(){ return sessionStorage.getItem(KEY) || ''; }
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
        if (!response.ok) throw new Error(data.message || data.error || 'Something went wrong.');
        return data;
      });
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
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(event){
    event.preventDefault();
    window.AIPA_OFFICE.clear();
    showLogin(true);
  });
  document.getElementById('password-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('password-status');
    status.textContent = 'Updating…';
    api('/office/password', {method:'POST', body:{
      current: document.getElementById('current-password').value,
      next: document.getElementById('next-password').value
    }}).then(function(){
      document.getElementById('password-form').reset();
      status.textContent = 'Password updated.';
    }).catch(function(err){ status.textContent = err.message; });
  });

  if (token()) showLogin(false);
})();
