(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.apiBase || '').replace(/\/$/, '');
  var token = new URLSearchParams(location.search).get('t') || '';
  var lead = document.getElementById('pay-lead');
  var list = document.getElementById('pay-list');

  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function money(cents){
    var n = Number(cents) || 0;
    var abs = Math.abs(n);
    var whole = Math.floor(abs / 100);
    var c = abs % 100;
    var s = String(whole);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ',';
      out += s.charAt(i);
    }
    return '$' + out + '.' + (c < 10 ? '0' : '') + c;
  }
  function when(value){
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return '';
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[Number(match[2]) - 1] + ' ' + Number(match[3]) + ', ' + match[1];
  }
  function lines(packet){
    var bits = [];
    if (packet.email) bits.push(esc(packet.email));
    if (packet.phone) bits.push(esc(packet.phone));
    var city = [packet.city, packet.state].filter(Boolean).join(', ');
    if (packet.zip) city = city ? city + ' ' + packet.zip : packet.zip;
    [packet.address_1, packet.address_2, city].filter(Boolean).forEach(function(line){
      bits.push(esc(line));
    });
    return bits.length ? '<address>' + bits.join('<br>') + '</address>' : '';
  }
  function guests(packet){
    var people = Array.isArray(packet.guests) ? packet.guests.slice() : [];
    if (!people.length && (packet.guest_name || packet.guest_email || packet.guest_phone)) {
      people.push({name: packet.guest_name, email: packet.guest_email, phone: packet.guest_phone});
    }
    people = people.filter(function(person){ return person && (person.name || person.email || person.phone); });
    if (!people.length) return '';
    return '<p><b>Also coming</b><br>' + people.map(function(person){
      return esc([person.name, person.email, person.phone].filter(Boolean).join(' · '));
    }).join('<br>') + '</p>';
  }
  function packetHtml(packet){
    if (!packet) return '';
    var notes = [];
    if (packet.summary) notes.push(packet.summary);
    if (packet.notes) notes.push(packet.notes);
    if (packet.visit_readiness) notes.push(packet.visit_readiness);
    if (packet.readiness_note) notes.push(packet.readiness_note);
    return '<h2>' + esc(packet.name || 'Home visit lead') + '</h2>' +
      lines(packet) +
      guests(packet) +
      (notes.length ? '<p>' + notes.map(function(note){ return esc(note); }).join('</p><p>') + '</p>' : '');
  }
  function card(bill){
    var date = when(bill.created_at);
    var open = bill.status === 'open' && Number(bill.amount_cents) > 0;
    var amount = Number(bill.amount_cents) > 0 ? money(bill.amount_cents) : 'Nothing due';
    var head = bill.released && bill.packet ? packetHtml(bill.packet) : '<h2>' + esc(bill.label || 'Charge') + '</h2>';
    var job = bill.kind === 'job' && Number(bill.job_cents) > 0 ? '<p>Job total ' + money(bill.job_cents) + '</p>' : '';
    return '<article class="pay-card">' + head +
      '<p>' + (date ? esc(date) + ' · ' : '') + amount + (bill.status === 'paid' ? ' · Paid' : '') + '</p>' +
      job +
      (open ? '<button class="btn" type="button" data-pay="' + bill.id + '">Pay</button><p class="status-line" id="pay-note-' + bill.id + '" role="status"></p>' : '') +
      (bill.kind === 'lead' && !bill.released ? '<p>Notes and contact information are released after this lead fee is paid.</p>' : '') +
      '</article>';
  }
  function render(data){
    var bills = data && Array.isArray(data.bills) ? data.bills : [];
    lead.textContent = data && data.contractor ? 'Bills for ' + data.contractor + '.' : 'Your bills.';
    if (!bills.length) {
      list.innerHTML = '<p>Nothing is due yet.</p>';
      return;
    }
    list.innerHTML = bills.map(card).join('');
  }
  function pay(id){
    var note = document.getElementById('pay-note-' + id);
    if (note) note.textContent = 'Checking Stripe…';
    fetch(base + '/pay', {
      method: 'POST',
      headers: {'Accept':'application/json', 'Content-Type':'application/json'},
      body: JSON.stringify({t: token, bill_id: id})
    }).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(data){
      if (note) note.textContent = data.message || 'Stripe is not connected yet.';
    }).catch(function(){
      if (note) note.textContent = 'Stripe is not connected yet.';
    });
  }
  list.addEventListener('click', function(event){
    var button = event.target.closest('[data-pay]');
    if (!button) return;
    pay(Number(button.getAttribute('data-pay')));
  });
  if (!token || !base) {
    lead.textContent = 'This page needs the link from Aging in Place Alliance.';
    return;
  }
  fetch(base + '/pay?t=' + encodeURIComponent(token), {headers:{'Accept':'application/json'}})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(data){
      if (!r.ok) throw new Error(data.message || data.error || 'That pay page was not found.');
      return data;
    }); })
    .then(render)
    .catch(function(err){ lead.textContent = err.message; });
})();
