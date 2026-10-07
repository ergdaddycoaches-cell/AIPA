(function(){
  var CFG = window.AIPA_CONFIG || {};
  var root = document.getElementById('guide');
  var crumb = document.getElementById('crumb-section');

  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  function parseBlocks(value){
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) { return []; }
  }
  function guideHtml(article){
    var blocks = parseBlocks(article.blocks);
    var notes = [];
    function mark(footnote){
      var text = String(footnote || '').trim();
      if (!text) return '';
      notes.push(text);
      return '<sup>' + notes.length + '</sup>';
    }
    var html = '';
    if (blocks.length) {
      html = blocks.map(function(block){
        if (block.type === 'headline') return '<h2>' + esc(block.text) + '</h2>';
        if (block.type === 'paragraph') return '<p>' + esc(block.text).replace(/\n/g, '<br>') + mark(block.footnote) + '</p>';
        if (block.type === 'photo-left' || block.type === 'photo-right') {
          var img = block.image ? '<img src="' + esc(block.image) + '" alt="">' : '';
          return '<div class="guide-photo ' + block.type + '">' + img + '<p>' + esc(block.text).replace(/\n/g, '<br>') + mark(block.footnote) + '</p></div>';
        }
        if (block.type === 'bullets') {
          return '<ul>' + (block.items || []).map(function(item){
            return '<li>' + esc(item.text) + mark(item.footnote) + '</li>';
          }).join('') + '</ul>';
        }
        return '';
      }).join('');
    } else {
      var paragraphs = String(article.body || '').split(/\n\s*\n/).map(function(p){ return p.trim(); }).filter(Boolean);
      html = paragraphs.map(function(p){ return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
    }
    if (notes.length) {
      html += '<section class="guide-notes"><h2>Notes</h2><ol>' + notes.map(function(note){
        return '<li>' + esc(note) + '</li>';
      }).join('') + '</ol></section>';
    }
    return html;
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
      var bodyHtml = guideHtml(article);
      var body = bodyHtml ? '<div class="article-body">' + bodyHtml + '</div>' : '';
      var pdf = article.pdf_url
        ? '<p class="print-guide"><a class="btn" href="' + esc(article.pdf_url) + '">Print this guide</a></p>'
        : '';
      root.innerHTML =
        '<p class="facts"><span>' + esc(article.section) + '</span></p>' +
        '<h1>' + esc(article.title) + '</h1>' +
        (article.summary ? '<p class="lede">' + esc(article.summary) + '</p>' : '') +
        pdf +
        body +
        '<p><a class="link" href="/library/' + esc(article.section_slug) + '/">More ' + esc(article.section).toLowerCase() + ' guides</a></p>';
    })
    .catch(missing);
})();
