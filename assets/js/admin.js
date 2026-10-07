(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var listEl = document.getElementById('guide-list');
  var editor = document.getElementById('editor');
  var msg = document.getElementById('editor-msg');
  var articles = [];
  var filter = '';
  var current = null;

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function label(status){
    return status === 'published' ? 'Live' : status === 'retired' ? 'Retired' : 'Draft';
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
        if (!r.ok) {
          var error = new Error(data.message || data.error || 'Something went wrong.');
          error.status = r.status;
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

  document.getElementById('login-form').addEventListener('submit', function(e){
    e.preventDefault();
    var status = document.getElementById('login-status');
    status.textContent = 'Signing in…';
    api('/auth/login', {method:'POST', auth:false, body:{password:document.getElementById('password').value}})
      .then(function(data){
        sessionStorage.setItem(KEY, data.authToken);
        document.getElementById('password').value = '';
        status.textContent = '';
        openDesk();
      })
      .catch(function(err){ status.textContent = err.message; });
  });

  signout.addEventListener('click', function(){
    sessionStorage.removeItem(KEY);
    showLogin(true);
  });

  document.querySelectorAll('[data-filter]').forEach(function(button){
    button.addEventListener('click', function(){
      filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(function(other){
        other.setAttribute('aria-pressed', String(other === button));
      });
      renderList();
    });
  });

  function renderList(){
    var shown = articles.filter(function(article){ return !filter || article.status === filter; });
    listEl.innerHTML = shown.map(function(article){
      return '<li><button type="button" data-id="' + article.id + '" aria-current="' + (current && current.id === article.id) + '">' +
        '<span class="t">' + esc(article.title) + '</span>' +
        '<span class="meta"><span class="badge ' + esc(article.status) + '">' + esc(label(article.status)) + '</span> · ' + esc(article.section) + '</span>' +
        '</button></li>';
    }).join('') || '<li><p class="note">No guides in this list.</p></li>';
    listEl.querySelectorAll('button').forEach(function(button){
      button.addEventListener('click', function(){
        var id = Number(button.dataset.id);
        current = articles.filter(function(article){ return article.id === id; })[0] || null;
        fillForm();
        renderList();
      });
    });
  }

  function fillForm(){
    var article = current || {};
    document.getElementById('title').value = article.title || '';
    document.getElementById('section').value = article.section_slug || document.getElementById('section').value;
    document.getElementById('slug').value = article.slug || '';
    document.getElementById('summary').value = article.summary || '';
    document.getElementById('body').value = article.body || '';
    document.getElementById('tags').value = article.tags || '';
    var badge = document.getElementById('editor-status');
    badge.className = 'badge ' + (article.status || 'draft');
    badge.textContent = article.id ? label(article.status) : 'New draft';
    var link = document.getElementById('live-link');
    link.innerHTML = article.status === 'published' && article.slug
      ? '<a class="link" href="/library/article/?slug=' + encodeURIComponent(article.slug) + '">View on the site</a>'
      : '';
    msg.textContent = '';
  }

  function blank(){
    current = null;
    fillForm();
    renderList();
    document.getElementById('title').focus();
  }
  document.getElementById('new-guide').addEventListener('click', blank);

  function save(status){
    var payload = {
      id: current && current.id ? current.id : 0,
      title: document.getElementById('title').value,
      summary: document.getElementById('summary').value,
      body: document.getElementById('body').value,
      section_slug: document.getElementById('section').value,
      tags: document.getElementById('tags').value,
      slug: document.getElementById('slug').value,
      status: status
    };
    msg.textContent = 'Saving…';
    return api('/office/article', {method:'POST', body:payload}).then(function(saved){
      var record = saved && saved.id ? saved : (saved && saved.items ? saved.items[0] : saved);
      current = record;
      return loadArticles().then(function(){
        current = articles.filter(function(article){ return article.id === record.id; })[0] || record;
        fillForm();
        renderList();
        msg.textContent = status === 'published' ? 'This guide is live.' : status === 'retired' ? 'This guide is retired and off the library.' : 'Draft saved. It is not on the site.';
      });
    }).catch(function(err){
      msg.textContent = err.message;
    });
  }

  document.getElementById('save-draft').addEventListener('click', function(){ save('draft'); });
  document.getElementById('publish').addEventListener('click', function(){ save('published'); });
  document.getElementById('retire').addEventListener('click', function(){
    if (!current || !current.id) { msg.textContent = 'Save the guide before retiring it.'; return; }
    if (!window.confirm('Retire this guide? It will leave the library and search.')) return;
    save('retired');
  });

  function loadArticles(){
    return api('/office/articles').then(function(data){
      articles = rows(data);
    });
  }

  function loadSections(){
    return fetch((CFG.apiBase || '').replace(/\/$/, '') + '/library/sections', {headers:{'Accept':'application/json'}})
      .then(function(r){ return r.json(); })
      .then(function(sections){
        var select = document.getElementById('section');
        select.innerHTML = (sections || []).map(function(section){
          return '<option value="' + esc(section.slug) + '">' + esc(section.name) + '</option>';
        }).join('');
      });
  }

  document.getElementById('password-form').addEventListener('submit', function(e){
    e.preventDefault();
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

  function openDesk(){
    showLogin(false);
    loadSections().then(loadArticles).then(function(){
      blank();
      if (window.AIPA_SEMINARS) window.AIPA_SEMINARS.load();
    }).catch(function(err){
      showLogin(true);
      document.getElementById('login-status').textContent = err.message;
    });
  }

  document.querySelectorAll('[data-panel]').forEach(function(button){
    button.addEventListener('click', function(){
      var panel = button.dataset.panel;
      document.querySelectorAll('[data-panel]').forEach(function(other){
        other.setAttribute('aria-pressed', String(other === button));
      });
      document.getElementById('panel-guides').hidden = panel !== 'guides';
      document.getElementById('panel-seminars').hidden = panel !== 'seminars';
    });
  });

  if (token()) openDesk();
  else showLogin(true);
})();
