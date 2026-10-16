(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var messages = [];
  var currentKey = '';
  var requested = '';
  try { requested = new URLSearchParams(location.search).get('key') || ''; } catch (err) { requested = ''; }
  var caret = {id: 'message-body', start: 0, end: 0};
  var PAGE_TOKENS = [
    {token: '{{live_qa}}', label: 'Live Q&A registration'},
    {token: '{{one_to_one}}', label: '1:1 registration'},
    {token: '{{sms_opt_in}}', label: 'SMS opt-in page'},
    {token: '{{library}}', label: 'Guide we send'},
    {token: '{{zoom}}', label: 'Standing Zoom link'},
    {token: '{{first_name}}', label: 'First name'},
    {token: '{{contractor}}', label: 'Contractor'}
  ];
  var EXTRA_TOKENS = {
    invite_qa_guest: [
      {token: '{{inviter_name}}', label: 'Person who invited them'}
    ],
    guide_followup: [
      {token: '{{guide}}', label: 'Guide title'},
      {token: '{{guide_pdf}}', label: 'Handout'},
      {token: '{{note}}', label: 'Note'}
    ],
    guide_followup_plain: [
      {token: '{{note}}', label: 'Note'}
    ],
    calculator: [
      {token: '{{leads}}', label: 'Leads a month'},
      {token: '{{cost_per_lead}}', label: 'Cost per lead'},
      {token: '{{close_rate}}', label: 'Close rate'},
      {token: '{{job_value}}', label: 'Average job'},
      {token: '{{gross_margin}}', label: 'Gross margin'},
      {token: '{{recovery_rate}}', label: 'Recovery rate'},
      {token: '{{spent}}', label: 'Spent on dead leads'},
      {token: '{{revenue}}', label: 'Recovered revenue'},
      {token: '{{fees}}', label: 'Fees'},
      {token: '{{net}}', label: 'Net found margin'}
    ]
  };

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
    return messages.filter(function(row){ return row.key === currentKey; })[0] || null;
  }
  function rememberCaret(event){
    var field = event.target;
    if (!field || (field.id !== 'message-subject' && field.id !== 'message-body')) return;
    caret = {id: field.id, start: field.selectionStart || 0, end: field.selectionEnd || 0};
  }
  function drawTokens(row){
    var extras = row ? (EXTRA_TOKENS[row.key] || []) : [];
    var tokens = PAGE_TOKENS.concat(extras);
    document.getElementById('token-row').innerHTML = tokens.map(function(item){
      return '<button type="button" data-token="' + esc(item.token) + '">' + esc(item.label) + '</button>';
    }).join('');
  }
  function fillForm(){
    var row = selected();
    var subject = document.getElementById('message-subject');
    var subjectLabel = document.getElementById('subject-label');
    document.getElementById('message-name').textContent = row ? row.name : 'Choose a message';
    document.getElementById('message-hint').textContent = row ? (row.hint || '') : '';
    subject.hidden = !row || row.channel !== 'email';
    subjectLabel.hidden = subject.hidden;
    subject.value = row ? (row.subject || '') : '';
    document.getElementById('message-body').value = row ? (row.body || '') : '';
    document.getElementById('body-label').textContent = row && row.channel === 'call' ? 'Script' : (row && row.channel === 'sms' ? 'Text' : 'Email');
    document.getElementById('message-status').textContent = '';
    drawTokens(row);
    caret = {id: 'message-body', start: document.getElementById('message-body').value.length, end: document.getElementById('message-body').value.length};
  }
  function renderList(){
    document.getElementById('message-list').innerHTML = messages.map(function(row){
      var kind = row.channel === 'sms' ? 'Text' : (row.channel === 'call' ? 'Call' : 'Email');
      return '<li><button type="button" data-key="' + esc(row.key) + '" aria-current="' + (row.key === currentKey) + '">' +
        '<span class="t">' + esc(row.name) + '</span>' +
        '<span class="meta">' + kind + '</span></button></li>';
    }).join('') || '<li><p class="note">No messages yet.</p></li>';
  }
  function load(){
    return api('/office/messages').then(function(data){
      messages = rows(data).slice().sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
      if (requested && messages.some(function(row){ return row.key === requested; })) currentKey = requested;
      if (!messages.some(function(row){ return row.key === currentKey; })) {
        currentKey = messages.length ? messages[0].key : '';
      }
      renderList();
      fillForm();
    });
  }
  function openDesk(){
    showLogin(false);
    load().catch(function(err){
      showLogin(true);
      document.getElementById('login-status').textContent = err.message;
    });
  }

  document.getElementById('login-form').addEventListener('submit', function(event){
    event.preventDefault();
    var status = document.getElementById('login-status');
    status.textContent = 'Signing in…';
    api('/auth/login', {method:'POST', auth:false, body:{password: document.getElementById('password').value}})
      .then(function(data){
        sessionStorage.setItem(KEY, data.authToken);
        document.getElementById('password').value = '';
        status.textContent = '';
        openDesk();
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(event){
    event.preventDefault();
    sessionStorage.removeItem(KEY);
    showLogin(true);
  });
  document.getElementById('message-list').addEventListener('click', function(event){
    var button = event.target.closest('[data-key]');
    if (!button) return;
    currentKey = button.getAttribute('data-key');
    renderList();
    fillForm();
  });
  document.getElementById('message-subject').addEventListener('keyup', rememberCaret);
  document.getElementById('message-subject').addEventListener('click', rememberCaret);
  document.getElementById('message-body').addEventListener('keyup', rememberCaret);
  document.getElementById('message-body').addEventListener('click', rememberCaret);
  document.getElementById('token-row').addEventListener('click', function(event){
    var button = event.target.closest('[data-token]');
    if (!button) return;
    var row = selected();
    var field = document.getElementById(caret.id);
    if (!field || field.hidden) field = document.getElementById('message-body');
    var tokenText = button.getAttribute('data-token');
    var start = field === document.getElementById(caret.id) ? caret.start : field.value.length;
    var end = field === document.getElementById(caret.id) ? caret.end : field.value.length;
    field.value = field.value.slice(0, start) + tokenText + field.value.slice(end);
    var pos = start + tokenText.length;
    caret = {id: field.id, start: pos, end: pos};
    field.focus();
    field.setSelectionRange(pos, pos);
    if (row) document.getElementById('message-status').textContent = '';
  });
  document.getElementById('message-form').addEventListener('submit', function(event){
    event.preventDefault();
    var row = selected();
    var status = document.getElementById('message-status');
    if (!row) { status.textContent = 'Choose a message.'; return; }
    var subject = document.getElementById('message-subject').value;
    var body = document.getElementById('message-body').value;
    if (row.channel === 'email' && !subject.trim()) { status.textContent = 'Add a subject.'; return; }
    if (!body.trim()) { status.textContent = 'Write the message.'; return; }
    status.textContent = 'Saving…';
    api('/office/message', {method:'POST', body:{key: row.key, subject: subject, body: body}}).then(function(){
      row.subject = subject;
      row.body = body;
      status.textContent = 'Saved.';
    }).catch(function(err){ status.textContent = err.message; });
  });

  if (token()) openDesk();
  else showLogin(true);
})();
