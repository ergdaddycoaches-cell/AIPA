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
      '<h3>Reserve this time</h3>' +
      '<p class="note">' + esc(slot.title) + ' · ' + esc(when(slot)) + '</p>' +
      '<label for="signup-name">Your name</label>' +
      '<input id="signup-name" name="name" autocomplete="name" required>' +
      '<label for="signup-email">Email</label>' +
      '<input id="signup-email" name="email" type="email" autocomplete="email" required>' +
      '<label for="signup-phone">Cell phone <span class="optional">optional</span></label>' +
      '<input id="signup-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel">' +
      '<div id="guest-list"></div>' +
      '<button class="btn quiet add-guest" type="button" id="add-guest">Add a family member</button>' +
      '<p class="note">The more the merrier.</p>' +
      '<div class="actions">' +
        '<button class="btn" type="submit">Reserve this time</button>' +
        '<button class="btn quiet" type="button" id="signup-cancel">Cancel</button>' +
      '</div>' +
      '<p class="status-line" id="signup-msg" role="status"></p>' +
    '</form>';
  }

  function bindForm(slot){
    var form = document.getElementById('signup-form');
    var list = document.getElementById('guest-list');
    function addGuest(){
      var block = document.createElement('div');
      block.className = 'guest';
      block.innerHTML =
        '<label>Name<input class="guest-name" autocomplete="off" required></label>' +
        '<label>Email<input class="guest-email" type="email" autocomplete="off" required></label>' +
        '<label>Cell phone <span class="optional">optional</span><input class="guest-phone" type="tel" autocomplete="off" inputmode="tel"></label>' +
        '<button class="btn quiet remove-guest" type="button">Remove</button>';
      block.querySelector('.remove-guest').addEventListener('click', function(){ block.remove(); });
      list.appendChild(block);
      block.querySelector('.guest-name').focus();
    }
    document.getElementById('add-guest').addEventListener('click', addGuest);
    document.getElementById('signup-cancel').addEventListener('click', function(){
      openSlot = null;
      render(window.AIPA_FAMILY_MONTHS || []);
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var msg = document.getElementById('signup-msg');
      var button = form.querySelector('button[type="submit"]');
      var guests = [];
      list.querySelectorAll('.guest').forEach(function(block){
        guests.push({
          name: block.querySelector('.guest-name').value.trim(),
          email: block.querySelector('.guest-email').value.trim(),
          phone: block.querySelector('.guest-phone').value.trim()
        });
      });
      var payload = {
        meeting_id: slot.meeting_id,
        occurrence_at: slot.occurrence_at,
        name: document.getElementById('signup-name').value.trim(),
        email: document.getElementById('signup-email').value.trim(),
        phone: document.getElementById('signup-phone').value.trim(),
        guests: JSON.stringify(guests)
      };
      msg.textContent = 'Reserving this time…';
      button.disabled = true;
      fetch(base + '/family-session/signup', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify(payload)
      }).then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(data){
          if (!r.ok) throw new Error(data.message || data.error || 'Something went wrong.');
          return data;
        });
      }).then(function(data){
        var names = guests.map(function(guest){ return guest.name; }).filter(Boolean);
        var guestLine = names.length ? ' ' + names.join(', ') + (names.length === 1 ? ' is invited too.' : ' are invited too.') : '';
        var zoom = data.zoom_url ? ' <a href="' + esc(data.zoom_url) + '">Join on Zoom</a> when it starts.' : '';
        form.innerHTML = '<p class="status-line">This time is reserved for you.' + esc(guestLine) + zoom + '</p>';
      }).catch(function(err){
        button.disabled = false;
        msg.textContent = err.message;
      });
    });
    document.getElementById('signup-name').focus();
  }

  function render(list){
    window.AIPA_FAMILY_MONTHS = list;
    if (!list.length) {
      months.innerHTML = '';
      status.textContent = 'No Family 1:1 times are open in the next two months.';
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
            (selected ? formHtml(slot) : '<button class="btn" type="button" data-key="' + esc(key) + '">Reserve this time</button>') +
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

  fetch(base + '/family-session', {headers:{'Accept':'application/json'}})
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data){ render((data && data.months) || []); })
    .catch(function(){ status.textContent = 'The schedule did not load. Call 833-AIPA-HUB and we can save you a time.'; });
})();
