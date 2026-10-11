(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.apiBase || '').replace(/\/$/, '');
  var form = document.getElementById('sms-form');
  var miss = document.getElementById('sms-miss');
  var done = document.getElementById('sms-done');
  var status = document.getElementById('sms-status');
  var params = new URLSearchParams(window.location.search);
  var token = (params.get('t') || '').trim();

  function showMiss(message){
    form.hidden = true;
    done.hidden = true;
    miss.hidden = false;
    miss.textContent = message || 'This link is no longer available.';
  }
  function showForm(data){
    miss.hidden = true;
    done.hidden = true;
    form.hidden = false;
    document.getElementById('sms-name').textContent = data.name || '';
    document.getElementById('sms-email').textContent = data.email || '';
    document.getElementById('sms-phone').value = data.phone || '';
    document.getElementById('sms-phone').focus();
  }

  if (!base || token.length < 20) {
    showMiss();
    return;
  }
  miss.hidden = false;
  miss.textContent = 'Looking up this link…';

  fetch(base + '/sms-opt-in?token=' + encodeURIComponent(token), {headers:{'Accept':'application/json'}})
    .then(function(r){ return r.json().catch(function(){ return {}; }); })
    .then(function(data){
      if (!data || !data.ok) showMiss(data && data.message);
      else showForm(data);
    })
    .catch(function(){ showMiss(); });

  form.addEventListener('submit', function(event){
    event.preventDefault();
    var button = form.querySelector('button[type="submit"]');
    var phone = document.getElementById('sms-phone').value.trim();
    var agree = document.getElementById('sms-agree').checked;
    status.textContent = 'Saving…';
    button.disabled = true;
    fetch(base + '/sms-opt-in', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'Accept':'application/json'},
      body: JSON.stringify({token: token, phone: phone, agree: agree})
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data){
        if (!r.ok || !data.ok) throw new Error(data.message || data.error || 'Something went wrong.');
        form.hidden = true;
        done.hidden = false;
        done.focus();
      });
    }).catch(function(err){
      button.disabled = false;
      status.textContent = err.message;
    });
  });
})();
