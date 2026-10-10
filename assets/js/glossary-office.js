(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var listEl = document.getElementById('term-list');
  var form = document.getElementById('term-form');
  var terms = [];
  var guides = [];
  var currentId = 0;

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
  function selected(){
    return terms.filter(function(row){ return row.id === currentId; })[0] || null;
  }
  function fillGuides(){
    var select = document.getElementById('see-slug');
    var row = selected();
    var known = false;
    var options = '<option value="">None</option>' + guides.map(function(guide){
      if (row && row.see_slug === guide.slug) known = true;
      return '<option value="' + esc(guide.slug) + '">' + esc(guide.title) + '</option>';
    }).join('');
    if (row && row.see_slug && !known) {
      options += '<option value="' + esc(row.see_slug) + '">' + esc(row.see_title || row.see_slug) + '</option>';
    }
    select.innerHTML = options;
  }
  function fillForm(){
    var row = selected();
    fillGuides();
    document.getElementById('term').value = row ? row.term : '';
    document.getElementById('definition').value = row ? row.definition : '';
    document.getElementById('see-slug').value = row && row.see_slug ? row.see_slug : '';
    document.getElementById('see-title').value = row && row.see_title ? row.see_title : '';
    document.getElementById('term-remove').hidden = !row;
    document.getElementById('term-status').textContent = '';
  }
  function renderList(){
    listEl.innerHTML = terms.map(function(row){
      var meta = row.see_title ? row.see_title : 'No related guide';
      return '<li><button type="button" data-id="' + row.id + '" aria-current="' + (row.id === currentId) + '">' +
        '<span class="t">' + esc(row.term) + '</span>' +
        '<span class="meta">' + esc(meta) + '</span></button></li>';
    }).join('') || '<li><p class="note">No terms yet.</p></li>';
  }
  function load(){
    return Promise.all([
      api('/office/glossary'),
      api('/office/articles').catch(function(){ return []; })
    ]).then(function(result){
      terms = rows(result[0]);
      guides = rows(result[1]).filter(function(article){
        return article.status === 'published' && article.slug && article.title;
      }).sort(function(a, b){
        return String(a.title).localeCompare(String(b.title), 'en', {sensitivity: 'base'});
      });
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
  document.getElementById('term-new').addEventListener('click', function(){
    currentId = 0;
    renderList();
    fillForm();
    document.getElementById('term').focus();
  });
  listEl.addEventListener('click', function(event){
    var button = event.target.closest('button');
    if (!button) return;
    currentId = Number(button.dataset.id) || 0;
    renderList();
    fillForm();
  });
  document.getElementById('see-slug').addEventListener('change', function(){
    var slug = this.value;
    var title = document.getElementById('see-title');
    if (!slug) { title.value = ''; return; }
    var guide = guides.filter(function(row){ return row.slug === slug; })[0];
    if (guide) title.value = guide.title;
  });
  form.addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('term-status');
    var seeSlug = document.getElementById('see-slug').value;
    status.textContent = 'Saving…';
    api('/office/glossary', {method:'POST', body:{
      id: currentId,
      term: document.getElementById('term').value,
      definition: document.getElementById('definition').value,
      see_slug: seeSlug,
      see_title: seeSlug ? document.getElementById('see-title').value : ''
    }}).then(function(saved){
      currentId = saved && saved.id ? saved.id : currentId;
      return load();
    }).then(function(){
      document.getElementById('term-status').textContent = 'Saved.';
    }).catch(function(err){ status.textContent = err.message; });
  });
  document.getElementById('term-remove').addEventListener('click', function(){
    var row = selected();
    if (!row) return;
    if (!window.confirm('Remove “' + row.term + '” from the glossary?')) return;
    var status = document.getElementById('term-status');
    status.textContent = 'Removing…';
    api('/office/glossary-remove', {method:'POST', body:{id: row.id}})
      .then(function(){
        currentId = 0;
        return load();
      })
      .catch(function(err){ status.textContent = err.message; });
  });

  if (token()) { showLogin(false); load().catch(function(err){ document.getElementById('term-status').textContent = err.message; }); }
  else showLogin(true);
})();
