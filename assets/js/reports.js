(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';
  var loginView = document.getElementById('login-view');
  var desk = document.getElementById('desk');
  var signout = document.getElementById('signout');
  var FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var LABELS = {utm_source:'Source', utm_medium:'Medium', utm_campaign:'Campaign', utm_term:'Term', utm_content:'Content'};

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function rows(value){
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }
  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
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
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data){
        if (r.status === 401) { sessionStorage.removeItem(KEY); showLogin(true); }
        if (!r.ok) throw new Error(data.message || data.error || 'Something went wrong.');
        return data;
      });
    });
  }
  function pacificDay(value){
    var parsed = new Date(value);
    if (!value || isNaN(parsed.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(parsed);
    } catch (err) {
      return '';
    }
  }
  function pacificToday(){
    return pacificDay(new Date().toISOString());
  }
  function when(value){
    var parsed = new Date(value);
    if (!value || isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }
  function dayLabel(value){
    var parsed = new Date(value);
    if (!value || isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }
  function fieldText(row, key){
    var value = String(row[key] || '').trim();
    return value || 'blank';
  }
  function fills(list, from, to){
    return rows(list).filter(function(row){
      var day = pacificDay(row.submitted_at);
      return day && day >= from && day <= to;
    });
  }
  function groups(list){
    var map = {};
    var none = 0;
    list.forEach(function(row){
      var any = false;
      FIELDS.forEach(function(key, index){
        var value = String(row[key] || '').trim();
        if (!value) return;
        any = true;
        var label = LABELS[key] + ': ' + value;
        if (!map[label]) map[label] = {code: label, count: 0, order: index};
        map[label].count += 1;
      });
      if (!any) none += 1;
    });
    var buckets = Object.keys(map).map(function(key){ return map[key]; });
    if (none) buckets.push({code: 'No UTM code', count: none, order: FIELDS.length});
    return buckets.sort(function(a, b){
      if (b.count !== a.count) return b.count - a.count;
      if (a.order !== b.order) return a.order - b.order;
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
  }
  function paint(list){
    var root = document.getElementById('report');
    var from = document.getElementById('from').value;
    var to = document.getElementById('to').value;
    if (from > to) {
      root.innerHTML = '';
      document.getElementById('report-status').textContent = 'The start date is after the end date.';
      return;
    }
    var matched = fills(list, from, to).slice().sort(function(a, b){
      return String(b.submitted_at).localeCompare(String(a.submitted_at));
    });
    var buckets = groups(matched);
    var max = buckets.reduce(function(n, bucket){ return Math.max(n, bucket.count); }, 0);
    var summary = matched.length === 1 ? '1 form fill' : matched.length + ' form fills';
    var bars = buckets.map(function(bucket){
      var height = max ? Math.max(12, Math.round(bucket.count / max * 100)) : 0;
      return '<li><span class="utm-count">' + bucket.count + '</span>' +
        '<span class="utm-plot" aria-hidden="true"><span class="utm-bar" style="height:' + height + '%"></span></span>' +
        '<span class="utm-name">' + esc(bucket.code) + '</span></li>';
    }).join('');
    var body = matched.map(function(row){
      var name = String(row.name || '').trim() || ('Contractor ' + row.id);
      return '<tr><td>' + esc(when(row.submitted_at)) + '</td><td><a href="/admin/contractors/?id=' + encodeURIComponent(row.id) + '">' + esc(name) + '</a></td><td>' +
        esc(row.contact_name || '') + '</td>' +
        FIELDS.map(function(key){ return '<td>' + esc(fieldText(row, key)) + '</td>'; }).join('') +
        '</tr>';
    }).join('');
    root.innerHTML = matched.length
      ? (bars ? '<figure class="utm-chart"><figcaption>Form fills by UTM code</figcaption><p class="utm-note">Each value has its own bar. A form fill with several codes is counted on each of those bars.</p><ul>' + bars + '</ul></figure>' : '') +
        '<details class="utm-fills"><summary>' + esc(summary) + '<span class="utm-last">Last signup ' + esc(dayLabel(matched[0].submitted_at)) + '</span></summary><div class="utm-scroll"><table class="utm-table"><thead><tr><th>Submitted</th><th>Company</th><th>Contact</th><th>Source</th><th>Medium</th><th>Campaign</th><th>Term</th><th>Content</th></tr></thead><tbody>' + body + '</tbody></table></div></details>'
      : '';
    document.getElementById('report-status').textContent = matched.length ? '' : 'No form fills in this range.';
  }
  function load(){
    var status = document.getElementById('report-status');
    status.textContent = 'Running…';
    return api('/office/contractor-pipeline').then(function(data){
      paint(rows((data || {}).contractors));
    }).catch(function(err){
      document.getElementById('report').innerHTML = '';
      status.textContent = err.message;
    });
  }
  function setDefaultRange(){
    var today = pacificToday();
    document.getElementById('from').value = today.slice(0, 8) + '01';
    document.getElementById('to').value = today;
  }

  document.getElementById('range').addEventListener('submit', function(event){
    event.preventDefault();
    load();
  });
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
        setDefaultRange();
        load();
      })
      .catch(function(err){ status.textContent = err.message; });
  });
  signout.addEventListener('click', function(event){
    event.preventDefault();
    sessionStorage.removeItem(KEY);
    showLogin(true);
  });
  if (token()) {
    showLogin(false);
    setDefaultRange();
    load();
  }
})();
