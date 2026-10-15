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
          var img = block.image ? '<img src="' + esc(block.image) + '" alt="' + esc(block.alt || '') + '">' : '';
          var shape = ' ratio-' + String(block.ratio || '3:4').replace(':', '-');
          return '<div class="guide-photo ' + block.type + shape + '">' + img + '<p>' + esc(block.text).replace(/\n/g, '<br>') + mark(block.footnote) + '</p></div>';
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
  function readingLine(text){
    var count = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    var n = Math.max(1, Math.round(count / 200));
    return 'About ' + n + (n === 1 ? ' minute' : ' minutes');
  }
  function readingText(article){
    var parts = [article.summary || ''];
    var blocks = parseBlocks(article.blocks);
    if (blocks.length) {
      blocks.forEach(function(block){
        if (block.text) parts.push(block.text);
        (block.items || []).forEach(function(item){ if (item && item.text) parts.push(item.text); });
      });
    } else if (article.body) parts.push(article.body);
    return parts.join(' ');
  }
  function robotsMeta(content){
    var robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', content);
  }
  function missing(){
    document.title = 'Guide not in the library | Aging in Place Alliance';
    robotsMeta('noindex');
    var canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.remove();
    root.innerHTML = '<h1>This guide is not in the library.</h1><p class="lede">It may be a draft, or it may have been retired. The rest of the library is still here.</p><p><a class="btn" href="/library/">Browse the library</a></p>';
  }
  function metaProp(name, content){
    var el = document.querySelector('meta[property="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }
  function publishGuide(slug, title, description){
    if (window.AIPA_NO_SPIDER) {
      robotsMeta('noindex, nofollow, noarchive, nosnippet');
      return;
    }
    robotsMeta('index, follow');
    var href = 'https://goaipa.com/library/article/?slug=' + encodeURIComponent(slug);
    var canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement('link');
      canon.rel = 'canonical';
      document.head.appendChild(canon);
    }
    canon.href = href;
    var shareTitle = title + ' | Aging in Place Alliance library';
    metaProp('og:type', 'article');
    metaProp('og:title', shareTitle);
    metaProp('og:description', description);
    metaProp('og:url', href);
    var ld = document.getElementById('guide-ld');
    if (!ld) {
      ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.id = 'guide-ld';
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: description,
      url: href,
      publisher: {
        '@type': 'Organization',
        name: 'Aging in Place Alliance',
        url: 'https://goaipa.com/'
      }
    });
  }

  var slug = '';
  var guideToken = '';
  try {
    var params = new URL(location.href).searchParams;
    slug = params.get('slug') || '';
    guideToken = params.get('t') || '';
  } catch (e) {}
  if (!slug || !CFG.apiBase) { missing(); return; }

  var sent = document.body.classList.contains('guide-sent');
  var api = CFG.apiBase.replace(/\/$/, '');
  function footerAsk(){
    if (!sent) return Promise.resolve(false);
    if (!guideToken) return Promise.resolve(true);
    return fetch(api + '/library/guide-footer?t=' + encodeURIComponent(guideToken), {headers:{'Accept':'application/json'}})
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(data){ return !!(data && data.ask); })
      .catch(function(){ return false; });
  }

  Promise.all([
    fetch(api + '/library/article?slug=' + encodeURIComponent(slug), {headers:{'Accept':'application/json'}})
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); }),
    footerAsk()
  ])
    .then(function(result){
      var article = result[0];
      var ask = !!result[1];
      if (!article || !article.title) { missing(); return; }
      document.title = article.title + ' | Aging in Place Alliance library';
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', article.summary || article.title);
      if (sent) {
        robotsMeta('noindex, nofollow');
        var href = 'https://goaipa.com/library/article/?slug=' + encodeURIComponent(slug);
        var canon = document.querySelector('link[rel="canonical"]');
        if (!canon) {
          canon = document.createElement('link');
          canon.rel = 'canonical';
          document.head.appendChild(canon);
        }
        canon.href = href;
      } else publishGuide(slug, article.title, article.summary || article.title);
      if (crumb && article.section_slug) {
        crumb.innerHTML = '<a href="/library/' + esc(article.section_slug) + '/">' + esc(article.section) + '</a>';
      }
      var bodyHtml = guideHtml(article);
      var body = bodyHtml ? '<div class="article-body">' + bodyHtml + '</div>' : '';
      var close = '';
      if (window.AIPA_CLOSE) {
        var sentence = esc((sent && ask) ? window.AIPA_CLOSE.sentLine(article) : window.AIPA_CLOSE.line(article))
          .replace('Live Q&amp;A', '<a class="link" href="/live-qa/">Live Q&amp;A</a>, <span data-qa-day>the next open session</span>')
          .replace('Ask Anything 1:1', '<a class="link" href="/ask-anything/">Ask Anything 1:1</a>');
        close = '<p class="guide-close">' + sentence + '</p>';
      }
      var printMark = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 9V2h12v7h2a2 2 0 0 1 2 2v6h-4v5H6v-5H2v-6a2 2 0 0 1 2-2h2zm2-5v3h8V4H8zm8 14v-4H8v4h8zM4 11v4h2v-2h12v2h2v-4H4z"/></svg>';
      var pdf = sent
        ? '<button type="button" class="tb-print" id="print-sent">' + printMark + 'Print this guide</button>'
        : (article.pdf_url
          ? '<a class="tb-print" href="' + esc(article.pdf_url) + '">' + printMark + 'Print this guide</a>'
          : '');
      var sheet = '<div class="titleblock"><div class="tb-seal"><span class="seal" aria-hidden="true">AIPA</span></div><div class="tb-topic"><span class="tb-name">' + esc(article.section || 'Guide') + '</span></div><div class="tb-time"><span class="tb-k">To read</span><span class="tb-meta"><span class="tb-read">' + esc(readingLine(readingText(article))) + '</span>' + pdf + '</span></div></div>';
      root.innerHTML =
        sheet +
        '<h1>' + esc(article.title) + '</h1>' +
        (article.summary ? '<p class="lede">' + esc(article.summary) + '</p>' : '') +
        body +
        close +
        '<p><a class="link" href="/library/' + esc(article.section_slug) + '/">More ' + esc(article.section).toLowerCase() + ' guides</a></p>';
      var printBtn = document.getElementById('print-sent');
      if (printBtn && window.AIPA_HANDOUT) {
        var guide = {
          title: article.title,
          summary: article.summary,
          section: article.section,
          blocks: parseBlocks(article.blocks),
          slug: article.slug || slug
        };
        var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.all([window.AIPA_HANDOUT.ready(), fontsReady]).catch(function(){});
        printBtn.addEventListener('click', function(){
          var label = printBtn.lastChild;
          var previous = label && label.nodeType === 3 ? label.textContent : '';
          printBtn.disabled = true;
          if (label && previous) label.textContent = 'Preparing…';
          var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
          Promise.all([window.AIPA_HANDOUT.ready(), fonts]).then(function(){
            var b64 = window.AIPA_HANDOUT.build(guide, {sent:ask});
            var binary = atob(b64);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            var url = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'}));
            location.href = url;
          }).catch(function(){
            printBtn.disabled = false;
            if (label && previous) label.textContent = previous;
          });
        });
      }
    })
    .catch(missing);
})();
