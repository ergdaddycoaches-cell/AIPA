(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.apiBase || '').replace(/\/$/, '');
  var live = document.getElementById('glossary-live');
  var az = document.getElementById('glossary-az');
  if (!base || !live) return;

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

  fetch(base + '/glossary', {headers:{'Accept':'application/json'}})
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data){
      var items = rows(data);
      if (!items.length) return;
      var groups = {};
      items.forEach(function(row){
        var letter = String(row.term || '').charAt(0).toUpperCase();
        if (!letter || letter < 'A' || letter > 'Z') letter = '#';
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(row);
      });
      var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      if (az) {
        az.innerHTML = letters.map(function(letter){
          return groups[letter]
            ? '<li><a href="#letter-' + letter + '">' + letter + '</a></li>'
            : '<li><span aria-hidden="true">' + letter + '</span></li>';
        }).join('');
      }
      var html = letters.filter(function(letter){ return groups[letter]; }).map(function(letter){
        var defs = groups[letter].map(function(row){
          var see = row.see_slug && row.see_title
            ? '<span class="see">Read more: <a class="inline" href="/library/article/?slug=' + encodeURIComponent(row.see_slug) + '">' + esc(row.see_title) + '</a></span>'
            : '';
          return '<div id="term-' + esc(row.slug) + '"><dt>' + esc(row.term) + '</dt><dd>' + esc(row.definition) + see + '</dd></div>';
        }).join('');
        return '<h2 class="gl-letter" id="letter-' + letter + '">' + letter + '</h2><dl class="gl-list">' + defs + '</dl>';
      }).join('');
      var note = live.querySelector('.note-band');
      live.innerHTML = html + (note ? note.outerHTML : '');
    })
    .catch(function(){});
})();
