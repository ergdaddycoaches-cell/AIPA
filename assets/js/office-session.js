(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var ROLE = 'aipa_office_role';
  var NAME = 'aipa_office_name';
  var ADMIN_PREFIXES = [
    '/admin/guides',
    '/admin/messages',
    '/admin/cadences',
    '/admin/prices',
    '/admin/glossary',
    '/admin/standards',
    '/admin/reports',
    '/admin/staff'
  ];

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function role(){ return sessionStorage.getItem(ROLE) || ''; }

  function creds(){
    var emailEl = document.getElementById('email');
    return {
      email: emailEl ? String(emailEl.value || '').trim() : '',
      password: document.getElementById('password') ? document.getElementById('password').value : ''
    };
  }

  function save(data){
    if (data && data.authToken) sessionStorage.setItem(KEY, data.authToken);
    if (data && data.role) sessionStorage.setItem(ROLE, data.role);
    if (data && data.name) sessionStorage.setItem(NAME, data.name);
    applyNav();
  }

  function clear(){
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(ROLE);
    sessionStorage.removeItem(NAME);
    applyNav();
  }

  function pathAllowed(path){
    if (role() !== 'guide') return true;
    for (var i = 0; i < ADMIN_PREFIXES.length; i++) {
      if (path.indexOf(ADMIN_PREFIXES[i]) === 0) return false;
    }
    return true;
  }

  function applyNav(){
    var isGuide = role() === 'guide';
    document.querySelectorAll('[data-office-admin]').forEach(function(el){
      el.hidden = isGuide;
    });
    var spider = document.getElementById('spider-form');
    if (spider) spider.hidden = isGuide;
    var path = location.pathname || '';
    if (token() && !pathAllowed(path)) {
      location.replace('/admin/');
    }
  }

  function sync(){
    applyNav();
    if (!token() || !base) return;
    fetch(base + '/office/me', {
      headers: {'Accept':'application/json', 'Authorization':'Bearer ' + token()}
    }).then(function(response){
      return response.json().catch(function(){ return {}; }).then(function(data){
        if (response.status === 401) { clear(); return; }
        if (!response.ok) return;
        sessionStorage.setItem(ROLE, data.role || '');
        sessionStorage.setItem(NAME, data.name || '');
        applyNav();
      });
    }).catch(function(){});
  }

  window.AIPA_OFFICE = {
    KEY: KEY,
    creds: creds,
    save: save,
    clear: clear,
    token: token,
    role: role,
    applyNav: applyNav,
    sync: sync
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }
})();
