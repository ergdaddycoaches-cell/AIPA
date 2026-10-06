(function(){
  var CFG = window.AIPA_CONFIG || {};
  var root = document.getElementById('guide');
  var crumb = document.getElementById('crumb-section');

  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  function missing(){
    document.title = 'Guide not in the library | Aging in Place Alliance';
    root.innerHTML = '<h1>This guide is not in the library.</h1><p class="lede">It may be a draft, or it may have been retired. The rest of the library is still here.</p><p><a class="btn" href="/library/">Browse the library</a></p>';
  }

  var slug = '';
  try { slug = new URL(location.href).searchParams.get('slug') || ''; } catch (e) {}
  if (!slug || !CFG.apiBase) { missing(); return; }

  fetch(CFG.apiBase.replace(/\/$/, '') + '/library/article?slug=' + encodeURIComponent(slug), {headers:{'Accept':'application/json'}})
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(article){
      if (!article || !article.title) { missing(); return; }
      document.title = article.title + ' | Aging in Place Alliance library';
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', article.summary || article.title);
      if (crumb && article.section_slug) {
        crumb.innerHTML = '<a href="/library/' + esc(article.section_slug) + '/">' + esc(article.section) + '</a>';
      }
      var paragraphs = String(article.body || '').split(/\n\s*\n/).map(function(p){ return p.trim(); }).filter(Boolean);
      var body = paragraphs.length
        ? '<div class="article-body">' + paragraphs.map(function(p){ return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</div>'
        : '';
      root.innerHTML =
        '<p class="facts"><span>' + esc(article.section) + '</span></p>' +
        '<h1>' + esc(article.title) + '</h1>' +
        (article.summary ? '<p class="lede">' + esc(article.summary) + '</p>' : '') +
        body +
        '<p><a class="link" href="/library/' + esc(article.section_slug) + '/">More ' + esc(article.section).toLowerCase() + ' guides</a></p>';
    })
    .catch(missing);
})();
