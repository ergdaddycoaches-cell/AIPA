(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.apiBase || '').replace(/\/$/, '');
  var status = document.getElementById('slot-status');
  var months = document.getElementById('slot-months');
  if (!status || !months || !base || !window.AIPA_SEMINAR) return;

  var openSlot = null;
  var viewIndex = 0;
  var selectedDay = '';
  var focusTarget = '';

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
      '<label for="signup-zip">ZIP code of the house</label>' +
      '<input id="signup-zip" name="house_zip" inputmode="numeric" autocomplete="postal-code" required maxlength="10">' +
      '<p class="note">The house you want to talk about.</p>' +
      '<div id="guest-list"></div>' +
      '<button class="btn quiet add-guest" type="button" id="add-guest">Add someone else</button>' +
      '<p class="note">Anyone who should hear it can join.</p>' +
      '<label class="check consent"><input id="signup-consent" type="checkbox" required> This conversation may be transcribed so we can follow up with a guide from the library. It stays inside Aging in Place Alliance.</label>' +
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
      focusTarget = 'reserve';
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
        house_zip: document.getElementById('signup-zip').value.trim(),
        guests: JSON.stringify(guests),
        recording_consent: document.getElementById('signup-consent').checked
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

  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function parts(slot){
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(slot.occurrence_at || '');
    if (!match) return null;
    return {y: +match[1], m: +match[2], d: +match[3], h: +match[4], mi: +match[5]};
  }
  function face(slot){
    var p = parts(slot);
    if (!p) return {time: '', zone: ''};
    return {
      time: (p.h % 12 || 12) + ':' + (p.mi < 10 ? '0' : '') + p.mi + ' ' + (p.h < 12 ? 'AM' : 'PM'),
      zone: window.AIPA_SEMINAR.zones[slot.timezone] || ''
    };
  }
  function clock(slot){
    var when = face(slot);
    return when.zone ? when.time + ' ' + when.zone : when.time;
  }
  var shortZones = {Hawaii: 'HT', Pacific: 'PT', Mountain: 'MT', Central: 'CT', Eastern: 'ET'};
  function tileClock(slot){
    var when = face(slot);
    var short = shortZones[when.zone] || when.zone;
    return short ? when.time + ' ' + short : when.time;
  }
  function markHtml(daySlots){
    return daySlots.map(function(slot){
      return '<span class="when-bit">' + esc(tileClock(slot)) + '</span>';
    }).join('');
  }
  function weekday(p){
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  }
  function monthName(p){
    return ['January','February','March','April','May','June','July','August','September','October','November','December'][p.m - 1];
  }
  function dayPanel(slots){
    var head = parts(slots[0]);
    var items = slots.map(function(slot){
      var key = slot.meeting_id + '|' + slot.occurrence_at;
      var selected = openSlot && openSlot.meeting_id === slot.meeting_id && openSlot.occurrence_at === slot.occurrence_at;
      var length = slot.duration_minutes ? ' · ' + slot.duration_minutes + ' minutes' : '';
      return '<li class="slot"><span class="when">' + esc(clock(slot) + length) + '</span>' +
        '<h3>' + esc(slot.title) + '</h3>' +
        (slot.summary ? '<p class="summary">' + esc(slot.summary) + '</p>' : '') +
        (selected ? formHtml(slot) : '<button class="btn" type="button" data-key="' + esc(key) + '">Reserve this time</button>') +
        '</li>';
    }).join('');
    return '<div class="day-panel" id="day-panel"><h3>' + esc(weekday(head) + ', ' + monthName(head) + ' ' + head.d) + '</h3><ul class="slot-list">' + items + '</ul></div>';
  }
  function render(list){
    window.AIPA_FAMILY_MONTHS = list;
    if (!list.length) {
      months.innerHTML = '';
      status.textContent = 'No Ask Anything 1:1 times are open in the next two months.';
      return;
    }
    if (viewIndex < 0) viewIndex = 0;
    if (viewIndex > list.length - 1) viewIndex = list.length - 1;
    var month = list[viewIndex];
    var slots = (month.slots || []).slice().sort(function(a, b){
      return String(a.occurrence_at).localeCompare(String(b.occurrence_at));
    });
    var sample = parts(slots[0] || {}) || {y: 0, m: 1, d: 1};
    var byDay = {};
    slots.forEach(function(slot){
      var key = String(slot.occurrence_at || '').slice(0, 10);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(slot);
    });
    if (selectedDay && !byDay[selectedDay]) selectedDay = '';
    var firstDow = new Date(Date.UTC(sample.y, sample.m - 1, 1)).getUTCDay();
    var daysInMonth = new Date(Date.UTC(sample.y, sample.m, 0)).getUTCDate();
    var cells = '';
    var i;
    for (i = 0; i < firstDow; i++) cells += '<span class="cal-day pad" aria-hidden="true"></span>';
    for (var day = 1; day <= daysInMonth; day++) {
      var key = sample.y + '-' + pad(sample.m) + '-' + pad(day);
      var daySlots = byDay[key] || [];
      if (!daySlots.length) {
        cells += '<span class="cal-day quiet" aria-hidden="true"><span class="num">' + day + '</span></span>';
        continue;
      }
      var spoken = daySlots.length === 1 ? 'one open time at ' + clock(daySlots[0]) : daySlots.length + ' open times';
      cells += '<button type="button" class="cal-day open" data-day="' + key + '" aria-pressed="' + (selectedDay === key) + '" aria-label="' +
        esc(weekday(parts(daySlots[0])) + ', ' + monthName(sample) + ' ' + day + ', ' + spoken) + '"><span class="num">' + day + '</span><span class="mark">' + markHtml(daySlots) + '</span></button>';
    }
    status.textContent = '';
    months.innerHTML =
      '<div class="month-cal">' +
      '<div class="cal-nav">' +
      '<button type="button" id="cal-prev"' + (viewIndex === 0 ? ' disabled' : '') + '>Previous</button>' +
      '<h2 id="cal-label">' + esc(month.label || (monthName(sample) + ' ' + sample.y)) + '</h2>' +
      '<button type="button" id="cal-next"' + (viewIndex === list.length - 1 ? ' disabled' : '') + '>Next</button>' +
      '</div>' +
      '<div class="cal-grid" aria-labelledby="cal-label">' +
      ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function(name){
        return '<div class="cal-dow" aria-hidden="true">' + name + '</div>';
      }).join('') +
      cells +
      '</div>' +
      (selectedDay && byDay[selectedDay] ? dayPanel(byDay[selectedDay]) : '') +
      '</div>';
    document.getElementById('cal-prev').addEventListener('click', function(){
      if (viewIndex === 0) return;
      viewIndex -= 1;
      selectedDay = '';
      openSlot = null;
      focusTarget = 'prev';
      render(list);
    });
    document.getElementById('cal-next').addEventListener('click', function(){
      if (viewIndex >= list.length - 1) return;
      viewIndex += 1;
      selectedDay = '';
      openSlot = null;
      focusTarget = 'next';
      render(list);
    });
    months.querySelectorAll('button[data-day]').forEach(function(button){
      button.addEventListener('click', function(){
        selectedDay = button.dataset.day;
        if (openSlot && String(openSlot.occurrence_at || '').slice(0, 10) !== selectedDay) openSlot = null;
        focusTarget = 'day';
        render(list);
      });
    });
    months.querySelectorAll('button[data-key]').forEach(function(button){
      button.addEventListener('click', function(){
        var found = null;
        slots.forEach(function(slot){
          if (slot.meeting_id + '|' + slot.occurrence_at === button.dataset.key) found = slot;
        });
        openSlot = found;
        focusTarget = '';
        render(list);
      });
    });
    if (openSlot) bindForm(openSlot);
    else if (focusTarget === 'day') {
      var reserve = months.querySelector('button[data-key]');
      var panel = document.getElementById('day-panel');
      if (reserve) reserve.focus();
      if (panel) panel.scrollIntoView({block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    } else if (focusTarget === 'reserve') {
      var again = months.querySelector('button[data-key]');
      if (again) again.focus();
    } else if (focusTarget === 'prev' || focusTarget === 'next') {
      var nav = document.getElementById(focusTarget === 'prev' ? 'cal-prev' : 'cal-next');
      if (nav) nav.focus();
    }
    focusTarget = '';
  }

  fetch(base + '/family-session', {headers:{'Accept':'application/json'}})
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data){ render((data && data.months) || []); })
    .catch(function(){ status.textContent = 'The schedule did not load. Call 833-AIPA-HUB and we can save you a time.'; });
})();
