/*
 * Replaces the static guide lists with published articles from Xano.
 * If the request fails, the lists already in the HTML stay as they are.
 */
(function(){
  var CFG = window.AIPA_CONFIG || {};
  if (!CFG.apiBase) return;
  var vols = document.querySelectorAll('#libgrid .vol');
  var guides = document.querySelector('ol.guides');
  if (!vols.length && !guides) return;

  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  fetch(CFG.apiBase.replace(/\/$/, '') + '/library/articles', {headers:{'Accept':'application/json'}})
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(items){
      if (!Array.isArray(items)) return;
      var by = {};
      items.forEach(function(article){
        var slug = article.section_slug;
        if (!by[slug]) by[slug] = [];
        by[slug].push(article);
      });

      vols.forEach(function(vol){
        var heading = vol.querySelector('h3 a');
        var list = vol.querySelector('ul');
        if (!heading || !list) return;
        var match = (heading.getAttribute('href') || '').match(/\/library\/([a-z0-9-]+)\/?$/);
        if (!match) return;
        var listed = by[match[1]] || [];
        if (!listed.length) return;
        list.innerHTML = listed.map(function(article){
          return '<li><a href="' + esc(article.url) + '">' + esc(article.title) + '</a></li>';
        }).join('');
      });

      if (guides) {
        var scope = document.getElementById('results');
        var section = scope && scope.dataset.section;
        if (!section) return;
        var rows = by[section] || [];
        if (!rows.length) return;
        guides.innerHTML = rows.map(function(article, index){
          return '<li><a href="' + esc(article.url) + '"><span class="no">' + (index + 1) + '</span><span>' +
            (index === 0 ? '<span class="start">Start here</span>' : '') +
            '<span class="t">' + esc(article.title) + '</span><span class="sm">' + esc(article.summary) + '</span></span></a></li>';
        }).join('');
        var count = document.querySelector('.facts span b');
        if (count) count.textContent = String(rows.length);
      }
    })
    .catch(function(){});
})();
