(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.officeBase || '').replace(/\/$/, '');
  var KEY = 'aipa_office_token';

  function token(){ return sessionStorage.getItem(KEY) || ''; }
  function audioBlob(b64){
    var clean = String(b64 || '').replace(/\s/g, '');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:'audio/mpeg'});
  }
  function showLogin(){
    sessionStorage.removeItem(KEY);
    var login = document.getElementById('login-view');
    var desk = document.getElementById('desk');
    var signout = document.getElementById('signout');
    if (login) login.hidden = false;
    if (desk) desk.hidden = true;
    if (signout) signout.hidden = true;
  }
  function note(button, text){
    var next = button.nextElementSibling;
    if (next && next.classList.contains('play-status')) next.remove();
    var line = document.createElement('p');
    line.className = 'status-line play-status';
    line.setAttribute('role', 'status');
    line.textContent = text;
    button.insertAdjacentElement('afterend', line);
  }

  document.addEventListener('click', function(event){
    var button = event.target.closest ? event.target.closest('[data-play]') : null;
    if (!button || button.tagName !== 'BUTTON' || button.disabled) return;
    var side = button.getAttribute('data-play');
    var id = button.getAttribute('data-play-id');
    if (!side || !id) return;
    button.disabled = true;
    var label = button.textContent;
    button.textContent = 'Loading…';
    var next = button.nextElementSibling;
    if (next && next.classList.contains('play-status')) next.remove();
    fetch(base + '/office/recording?side=' + encodeURIComponent(side) + '&id=' + encodeURIComponent(id), {
      headers: {Accept:'application/json', Authorization:'Bearer ' + token()}
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data){
        if (r.status === 401) {
          showLogin();
          throw new Error('Sign in again.');
        }
        if (!r.ok || !data.audio) throw new Error(data.message || 'The recording did not load.');
        return audioBlob(data.audio);
      });
    }).then(function(blob){
      var audio = document.createElement('audio');
      audio.className = 'message-audio';
      audio.controls = true;
      audio.autoplay = true;
      audio.src = URL.createObjectURL(blob);
      button.replaceWith(audio);
    }).catch(function(err){
      button.disabled = false;
      button.textContent = label;
      note(button, err.message || 'The recording did not load.');
    });
  });
})();
