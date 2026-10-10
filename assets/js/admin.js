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
  if (document.fonts && document.fonts.load) document.fonts.load('28px "VI Phong Lan Hoa"');
  if (window.AIPA_HANDOUT && AIPA_HANDOUT.ready) AIPA_HANDOUT.ready();

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
    document.getElementById('tags').value = article.tags || '';
    if (window.AIPA_GUIDE) window.AIPA_GUIDE.mount(document.getElementById('blocks'), window.AIPA_GUIDE.fromArticle(article));
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

  function sectionMatch(name){
    var want = String(name || '').trim().toLowerCase();
    var select = document.getElementById('section');
    if (!want) return '';
    var found = '';
    Array.prototype.forEach.call(select.options, function(option){
      if (found) return;
      if (option.value.toLowerCase() === want || option.text.toLowerCase() === want) found = option.value;
    });
    return found;
  }
  document.getElementById('markup-file').addEventListener('change', function(){
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      document.getElementById('markup').value = String(reader.result || '');
      msg.textContent = 'File loaded. Fill this guide when the markup looks right.';
    };
    reader.onerror = function(){ msg.textContent = 'That file could not be read.'; };
    reader.readAsText(file);
  });
  document.getElementById('markup-fill').addEventListener('click', function(){
    if (!window.AIPA_MARKUP) { msg.textContent = 'The markup tool did not load.'; return; }
    var parsed = window.AIPA_MARKUP.parse(document.getElementById('markup').value);
    if (!parsed.title && !parsed.blocks.length) {
      msg.textContent = parsed.errors[0] || 'That markup has no title and no guide blocks.';
      return;
    }
    var occupied = document.getElementById('title').value.trim() || (window.AIPA_GUIDE && window.AIPA_GUIDE.read().some(function(block){
      return block.text || block.image || (block.items || []).some(function(item){ return item.text; });
    }));
    if (occupied && !window.confirm('Replace what is in the editor? Nothing is saved until you save the draft.')) return;
    current = null;
    document.getElementById('title').value = parsed.title;
    document.getElementById('summary').value = parsed.summary;
    document.getElementById('slug').value = parsed.slug;
    document.getElementById('tags').value = parsed.tags;
    var section = sectionMatch(parsed.section);
    if (section) document.getElementById('section').value = section;
    else if (parsed.section) parsed.errors.push('No section named "' + parsed.section + '".');
    if (window.AIPA_GUIDE) window.AIPA_GUIDE.mount(document.getElementById('blocks'), parsed.blocks);
    var badge = document.getElementById('editor-status');
    badge.className = 'badge draft';
    badge.textContent = 'New draft';
    document.getElementById('live-link').innerHTML = '';
    renderList();
    var photos = parsed.blocks.filter(function(block){ return block.type === 'photo-left' || block.type === 'photo-right'; }).length;
    var note = 'Filled from the markup. Save the draft to keep the guide and the handout.';
    if (photos) note += ' Upload a photo for ' + (photos === 1 ? 'the picture block.' : 'each picture block.');
    if (parsed.errors.length) note += ' ' + parsed.errors.join(' ');
    msg.textContent = note;
    document.getElementById('title').focus();
  });

  function payloadFromGuide(guide){
    var sectionSlug = sectionMatch(guide.section);
    var sectionName = '';
    var select = document.getElementById('section');
    Array.prototype.forEach.call(select.options, function(option){
      if (option.value === sectionSlug) sectionName = option.text;
    });
    var blocks = guide.blocks || [];
    var payload = {
      id: 0,
      title: guide.title,
      summary: guide.summary,
      body: window.AIPA_GUIDE ? window.AIPA_GUIDE.plain(blocks) : '',
      blocks: JSON.stringify(blocks),
      section_slug: sectionSlug,
      tags: guide.tags || '',
      slug: guide.slug || '',
      status: 'draft'
    };
    if (blocks.length && window.AIPA_HANDOUT) {
      try {
        payload.handout = window.AIPA_HANDOUT.build({
          title: guide.title,
          summary: guide.summary,
          section: sectionName,
          blocks: blocks,
          slug: guide.slug || ''
        });
      } catch (err) {
        payload.handoutNote = err.message;
      }
    }
    return payload;
  }

  document.getElementById('markup-import').addEventListener('click', function(){
    if (!window.AIPA_MARKUP || !window.AIPA_MARKUP.parseMany) {
      msg.textContent = 'The markup tool did not load.';
      return;
    }
    var guides = window.AIPA_MARKUP.parseMany(document.getElementById('markup').value);
    var ready = guides.filter(function(guide){ return guide.title; });
    if (!ready.length) {
      msg.textContent = (guides[0] && guides[0].errors[0]) || 'That markup has no articles with a title.';
      return;
    }
    var untitled = guides.length - ready.length;
    var ask = 'Save ' + ready.length + (ready.length === 1 ? ' draft' : ' drafts') + '? They stay off the site until you publish them.';
    if (!window.confirm(ask)) return;
    var prepare = window.AIPA_HANDOUT && AIPA_HANDOUT.ready ? AIPA_HANDOUT.ready() : Promise.resolve();
    var notes = [];
    var saved = 0;
    var photos = 0;
    prepare.then(function(){
      var chain = Promise.resolve();
      ready.forEach(function(guide, index){
        chain = chain.then(function(){
          if (!sectionMatch(guide.section)) {
            notes.push('"' + guide.title + '" was skipped. No section named "' + (guide.section || '') + '".');
            return;
          }
          msg.textContent = 'Saving draft ' + (index + 1) + ' of ' + ready.length + '…';
          photos += guide.blocks.filter(function(block){
            return block.type === 'photo-left' || block.type === 'photo-right';
          }).length;
          var payload = payloadFromGuide(guide);
          var handoutNote = payload.handoutNote;
          delete payload.handoutNote;
          return api('/office/article', {method:'POST', body:payload}).then(function(){
            saved += 1;
            if (handoutNote) notes.push('"' + guide.title + '" was saved without a handout. ' + handoutNote);
            if (guide.errors.length) notes.push('"' + guide.title + '": ' + guide.errors.join(' '));
          });
        });
      });
      return chain;
    }).then(function(){
      return loadArticles();
    }).then(function(){
      renderList();
      var summary = 'Saved ' + saved + (saved === 1 ? ' draft.' : ' drafts.');
      if (untitled) summary += ' ' + untitled + (untitled === 1 ? ' had no title and was left out.' : ' had no title and were left out.');
      if (photos) summary += ' Upload a photo for ' + (photos === 1 ? 'the picture block.' : 'each picture block.');
      if (notes.length) summary += ' ' + notes.join(' ');
      msg.textContent = summary;
    }).catch(function(err){
      msg.textContent = err.message;
    });
  });

  function guidePayload(status){
    var blocks = window.AIPA_GUIDE ? window.AIPA_GUIDE.read() : [];
    var section = document.getElementById('section');
    var guide = {
      title: document.getElementById('title').value,
      summary: document.getElementById('summary').value,
      section: section.options[section.selectedIndex] ? section.options[section.selectedIndex].text : '',
      blocks: blocks,
      slug: document.getElementById('slug').value
    };
    var payload = {
      id: current && current.id ? current.id : 0,
      title: guide.title,
      summary: guide.summary,
      body: blocks.length && window.AIPA_GUIDE ? window.AIPA_GUIDE.plain(blocks) : (current && current.body) || '',
      blocks: JSON.stringify(blocks),
      section_slug: section.value,
      tags: document.getElementById('tags').value,
      slug: document.getElementById('slug').value,
      status: status
    };
    payload.handoutNote = '';
    if (blocks.length && window.AIPA_HANDOUT) {
      try { payload.handout = window.AIPA_HANDOUT.build(guide); }
      catch (err) { payload.handoutNote = err.message; }
    }
    return payload;
  }
  function save(status){
    var prepare = window.AIPA_HANDOUT && AIPA_HANDOUT.ready ? AIPA_HANDOUT.ready() : Promise.resolve();
    return prepare.then(function(){
    var payload = guidePayload(status);
    var handoutNote = payload.handoutNote;
    delete payload.handoutNote;
    msg.textContent = payload.handout ? 'Saving the guide and the handout…' : 'Saving…';
    return api('/office/article', {method:'POST', body:payload}).then(function(saved){
      var record = saved && saved.id ? saved : (saved && saved.items ? saved.items[0] : saved);
      current = record;
      return loadArticles().then(function(){
        current = articles.filter(function(article){ return article.id === record.id; })[0] || record;
        fillForm();
        renderList();
        var savedNote = status === 'published' ? 'This guide is live.' : status === 'retired' ? 'This guide is retired and off the library.' : 'Draft saved. It is not on the site.';
        msg.textContent = handoutNote ? savedNote + ' The handout was not updated. ' + handoutNote : savedNote;
      });
    }).catch(function(err){
      msg.textContent = err.message;
    });
    }).catch(function(err){
      msg.textContent = err.message;
    });
  }

  document.getElementById('preview-handout').addEventListener('click', function(){
    var prepare = window.AIPA_HANDOUT && AIPA_HANDOUT.ready ? AIPA_HANDOUT.ready() : Promise.resolve();
    prepare.then(function(){
    try {
      var payload = guidePayload('draft');
      if (payload.handoutNote) { msg.textContent = payload.handoutNote; return; }
      if (!payload.handout) { msg.textContent = 'Add a headline, paragraph, photo, or list first.'; return; }
      var binary = atob(payload.handout);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'}));
      window.open(url, '_blank');
      msg.textContent = 'The handout preview is open. Save the guide to keep it.';
    } catch (err) { msg.textContent = err.message; }
    }).catch(function(err){ msg.textContent = err.message; });
  });
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
