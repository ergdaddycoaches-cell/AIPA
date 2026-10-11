(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.apiBase || '').replace(/\/$/, '');
  var table = document.getElementById('standards-table');
  if (!base || !table) return;

  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function list(value){
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }

  fetch(base + '/standards', {headers:{'Accept':'application/json'}})
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data){
      var items = list(data);
      if (!items.length) return;
      var order = [];
      var groups = {};
      items.forEach(function(row){
        var area = row.area || 'Other';
        if (!groups[area]) { groups[area] = []; order.push(area); }
        groups[area].push(row);
      });
      var html = order.map(function(area){
        var body = groups[area].map(function(row){
          var id = row.slug ? ' id="std-' + esc(row.slug) + '"' : '';
          return '<tr' + id + '><th scope="row">' + esc(row.label) + '</th><td class="num">' + esc(row.target) + '</td><td class="means">' + esc(row.means) + '</td><td class="src">' + esc(row.source) + '</td></tr>';
        }).join('');
        return '<tbody class="std-group"><tr><th colspan="4" scope="colgroup">' + esc(area) + '</th></tr>' + body + '</tbody>';
      }).join('');
      Array.prototype.slice.call(table.querySelectorAll('tbody')).forEach(function(body){ body.remove(); });
      table.insertAdjacentHTML('beforeend', html);
    })
    .catch(function(){});
})();
