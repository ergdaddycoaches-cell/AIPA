(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.apiBase || '').replace(/\/$/, '');
  var status = document.getElementById('slot-status');
  var months = document.getElementById('slot-months');
  if (!status || !months || !base || !window.AIPA_SEMINAR) return;

  var openSlot = null;

  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function when(slot){
    return window.AIPA_SEMINAR.format({
      starts_at: slot.occurrence_at,
      timezone: slot.timezone,
      kind: 'one_time'
    });
  }

  function formHtml(slot){
    return '<form class="signup" id="signup-form">' +
      '<h3>Sign up</h3>' +
      '<p class="note">' + esc(slot.title) + ' · ' + esc(when(slot)) + '</p>' +
      '<label for="signup-name">Your name</label>' +
      '<input id="signup-name" name="name" autocomplete="name" required>' +
      '<label for="signup-email">Email</label>' +
      '<input id="signup-email" name="email" type="email" autocomplete="email" required>' +
      '<label for="signup-phone">Cell phone <span class="optional">optional</span></label>' +
      '<input id="signup-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel">' +
      '<label class="check"><input id="signup-invite" type="checkbox"> Invite a family member</label>' +
      '<div id="guest-fields" hidden>' +
        '<label for="guest-name">Their name</label>' +
        '<input id="guest-name" name="guest_name" autocomplete="off">' +
        '<label for="guest-email">Their email</label>' +
        '<input id="guest-email" name="guest_email" type="email" autocomplete="off">' +
        '<label for="guest-phone">Their cell phone <span class="optional">optional</span></label>' +
        '<input id="guest-phone" name="guest_phone" type="tel" autocomplete="off" inputmode="tel">' +
      '</div>' +
      '<div class="actions">' +
        '<button class="btn" type="submit">Save my seat</button>' +
        '<button class="btn quiet" type="button" id="signup-cancel">Cancel</button>' +
      '</div>' +
      '<p class="status-line" id="signup-msg" role="status"></p>' +
    '</form>';
  }

  function bindForm(slot){
    var form = document.getElementById('signup-form');
    var invite = document.getElementById('signup-invite');
    var guest = document.getElementById('guest-fields');
    invite.addEventListener('change', function(){
      guest.hidden = !invite.checked;
      document.getElementById('guest-name').required = invite.checked;
      document.getElementById('guest-email').required = invite.checked;
    });
    document.getElementById('signup-cancel').addEventListener('click', function(){
      openSlot = null;
      render(window.AIPA_LIVE_QA_MONTHS || []);
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var msg = document.getElementById('signup-msg');
      var button = form.querySelector('button[type="submit"]');
      var payload = {
        meeting_id: slot.meeting_id,
        occurrence_at: slot.occurrence_at,
        name: document.getElementById('signup-name').value.trim(),
        email: document.getElementById('signup-email').value.trim(),
        phone: document.getElementById('signup-phone').value.trim(),
        guest_name: invite.checked ? document.getElementById('guest-name').value.trim() : '',
        guest_email: invite.checked ? document.getElementById('guest-email').value.trim() : '',
        guest_phone: invite.checked ? document.getElementById('guest-phone').value.trim() : ''
      };
      msg.textContent = 'Saving your seat…';
      button.disabled = true;
      fetch(base + '/live-qa/signup', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify(payload)
      }).then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(data){
          if (!r.ok) throw new Error(data.message || data.error || 'Something went wrong.');
          return data;
        });
      }).then(function(data){
        var guestLine = data.guest_name ? ' ' + data.guest_name + ' is invited too.' : '';
        var zoom = data.zoom_url ? ' <a href="' + esc(data.zoom_url) + '">Join on Zoom</a> when it starts.' : '';
        form.innerHTML = '<p class="status-line">You\'re signed up.' + esc(guestLine) + zoom + '</p>';
      }).catch(function(err){
        button.disabled = false;
        msg.textContent = err.message;
      });
    });
    document.getElementById('signup-name').focus();
  }

  function render(list){
    window.AIPA_LIVE_QA_MONTHS = list;
    if (!list.length) {
      months.innerHTML = '';
      status.textContent = 'No Live Q&A sessions are on the calendar in the next two months. Call 833-AIPA-HUB and we can save you a seat.';
      return;
    }
    status.textContent = '';
    months.innerHTML = list.map(function(month){
      return '<h2 class="slot-month">' + esc(month.label) + '</h2><ul class="slot-list">' +
        (month.slots || []).map(function(slot){
          var key = slot.meeting_id + '|' + slot.occurrence_at;
          var selected = openSlot && openSlot.meeting_id === slot.meeting_id && openSlot.occurrence_at === slot.occurrence_at;
          var length = slot.duration_minutes ? ' · ' + slot.duration_minutes + ' minutes' : '';
          return '<li class="slot"><span class="when">' + esc(when(slot)) + length + '</span>' +
            '<h3>' + esc(slot.title) + '</h3>' +
            (slot.summary ? '<p class="summary">' + esc(slot.summary) + '</p>' : '') +
            (selected ? formHtml(slot) : '<button class="btn" type="button" data-key="' + esc(key) + '">Sign up</button>') +
            '</li>';
        }).join('') + '</ul>';
    }).join('');
    months.querySelectorAll('button[data-key]').forEach(function(button){
      button.addEventListener('click', function(){
        var found = null;
        list.forEach(function(month){
          (month.slots || []).forEach(function(slot){
            if (slot.meeting_id + '|' + slot.occurrence_at === button.dataset.key) found = slot;
          });
        });
        openSlot = found;
        render(list);
      });
    });
    if (openSlot) bindForm(openSlot);
  }

  fetch(base + '/live-qa', {headers:{'Accept':'application/json'}})
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data){ render((data && data.months) || []); })
    .catch(function(){ status.textContent = 'The schedule did not load. Call 833-AIPA-HUB and we can save you a seat.'; });
})();
