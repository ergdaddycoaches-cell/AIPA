(function(){
  var CFG = window.AIPA_CONFIG || {};
  var api = (CFG.apiBase || '').replace(/\/$/, '');
  var root = document.getElementById('nurture');
  var token = '';
  try { token = new URL(location.href).searchParams.get('t') || ''; } catch (e) {}

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }
  function videoHtml(url){
    var raw = String(url || '').trim();
    if (!raw) return '';
    var youtube = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
    var src = youtube ? 'https://www.youtube.com/embed/' + youtube[1] : '';
    if (!src && /wistia/i.test(raw)) src = raw;
    if (src) return '<div class="nurture-video"><iframe src="' + esc(src) + '" title="A note from Shep" allow="autoplay; fullscreen" allowfullscreen></iframe></div>';
    if (/\.mp4(\?|$)/i.test(raw)) return '<div class="nurture-video"><video controls src="' + esc(raw) + '"><a href="' + esc(raw) + '">Watch the note</a></video></div>';
    return '<p><a class="btn" href="' + esc(raw) + '">Watch the note</a></p>';
  }
  function show(data, phase){
    var heading = data.name ? 'Hello ' + esc(data.name) : 'Hello';
    document.title = (data.name ? 'Hello ' + data.name : 'Hello') + ' | Aging in Place Alliance';
    var thanking = phase === 'thanks';
    var asking = !!data.ask_concern && !thanking;
    var listing = !asking && !thanking;
    var video = thanking ? '' : videoHtml(data.video_url);
    var invite = 'When you are ready to talk about your house, book a 1:1 Consult.';
    var book = data.show_book
      ? '<div class="nurture-book"><p class="nurture-invite">' + invite + '</p><p class="voice-cta"><a class="btn" href="/ask-anything/">Book a 1:1 Consult</a></p></div>'
      : '';
    var concerns = [
      {key: 'bathroom', label: 'The bathroom'},
      {key: 'around', label: 'Getting around the house'},
      {key: 'seeing', label: 'Seeing'},
      {key: 'hands', label: 'Using your hands'}
    ];
    var legend = (parseInt(data.request_count, 10) || 0) > 0
      ? 'Would you like to explore a new topic?'
      : 'What is on your mind first?';
    var concern = '<div id="concern-panel"' + (asking ? '' : ' hidden') + '>' +
      (asking
        ? '<form class="signup" id="concern-form"><fieldset><legend>' + legend + '</legend>' +
          concerns.map(function(item, index){
            return '<label class="check nurture-topic"><input type="radio" name="concern" value="' + item.key + '"' + (index === 0 ? ' required' : '') + '> <span><b class="nurture-title">' + item.label + '</b></span></label>';
          }).join('') +
          '<div class="actions"><button class="btn" type="submit">Start with this</button><button class="btn quiet" type="button" id="concern-skip">Not sure</button></div><p class="status-line" id="concern-status" role="status"></p></fieldset></form>'
        : '') +
      '</div>';
    var topics = data.topics || [];
    var articles = '';
    if (listing && data.stopped) {
      articles = '<p>This page is finished. The library is still here if you want to keep reading.</p>';
    } else if (listing && topics.length) {
      articles = '<form class="signup" id="nurture-form"><fieldset><legend>Which topic would you like to explore next?</legend>' +
        topics.map(function(topic, index){
          return '<label class="check nurture-topic"><input type="radio" name="article_id" value="' + topic.id + '"' + (index === 0 ? ' required' : '') + '> <span><b class="nurture-title">' + esc(topic.title) + '</b>' +
            (topic.summary ? '<span class="nurture-summary">' + esc(topic.summary) + '</span>' : '') + '</span></label>';
        }).join('') +
        '<div class="actions"><button class="btn" type="submit">Send me this guide</button></div><p class="status-line" id="nurture-status" role="status"></p></fieldset></form>';
    } else if (listing) {
      articles = '<p>There are no more topics on your page right now.</p>';
    }
    var articlePanel = '<div id="article-panel"' + (listing ? '' : ' hidden') + '>' + articles + '</div>';
    var thanks = '<div class="signup nurture-thanks" id="thanks-panel"' + (thanking ? '' : ' hidden') + '><h2 tabindex="-1">Thank you</h2><p>The guide is on its way. Check your email.</p></div>';
    root.innerHTML = '<h1 id="pt">' + heading + '</h1><p class="lede">Thank you for coming to the Live Q&amp;A.</p>' + video + concern + articlePanel + thanks + book;
    var concernForm = document.getElementById('concern-form');
    if (concernForm) concernForm.addEventListener('submit', saveConcern);
    var skip = document.getElementById('concern-skip');
    if (skip) skip.addEventListener('click', function(){ saveConcernKey('skip'); });
    var choose = document.getElementById('nurture-form');
    if (choose) choose.addEventListener('submit', submit);
    if (phase === 'thanks') {
      var thanksTitle = root.querySelector('#thanks-panel h2');
      if (thanksTitle) thanksTitle.focus();
    } else if (phase === 'guides') {
      var guideLegend = root.querySelector('#article-panel legend');
      if (guideLegend) { guideLegend.tabIndex = -1; guideLegend.focus(); }
    }
    if (data.video_url && !thanking) {
      fetch(api + '/nurture/seen', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify({t: token})
      }).catch(function(){});
    }
  }
  function saveConcern(event){
    event.preventDefault();
    var picked = root.querySelector('input[name="concern"]:checked');
    var status = document.getElementById('concern-status');
    if (!picked) { if (status) status.textContent = 'Choose one concern.'; return; }
    saveConcernKey(picked.value);
  }
  function saveConcernKey(key){
    var status = document.getElementById('concern-status');
    if (status) status.textContent = 'Saving…';
    fetch(api + '/nurture/concern', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'Accept':'application/json'},
      body: JSON.stringify({t: token, concern: key})
    }).then(function(response){
      return response.json().then(function(data){
        if (!response.ok) throw new Error((data && data.message) || 'That choice was not saved.');
        return data;
      });
    }).then(function(){
      return load('guides');
    }).catch(function(err){
      if (status) status.textContent = err.message;
    });
  }
  function submit(event){
    event.preventDefault();
    var status = document.getElementById('nurture-status');
    var picked = root.querySelector('input[name="article_id"]:checked');
    if (!picked) { status.textContent = 'Choose one topic.'; return; }
    status.textContent = 'Sending the guide…';
    fetch(api + '/nurture/choose', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'Accept':'application/json'},
      body: JSON.stringify({t: token, article_id: Number(picked.value)})
    }).then(function(response){
      return response.json().then(function(data){
        if (!response.ok) throw new Error((data && data.message) || (data && data.payload) || 'The guide was not sent.');
        return data;
      });
    }).then(function(){
      return load('thanks');
    }).catch(function(err){
      status.textContent = err.message;
    });
  }
  function load(phase){
    if (!api || !token) {
      root.innerHTML = '<h1 id="pt">Hello</h1><p>This link is missing its private code. Use the link from your email.</p>';
      return;
    }
    fetch(api + '/nurture?t=' + encodeURIComponent(token), {headers:{'Accept':'application/json'}})
      .then(function(response){
        return response.json().then(function(data){
          if (!response.ok) throw new Error((data && data.message) || 'That page was not found.');
          return data;
        });
      })
      .then(function(data){ show(data, phase); })
      .catch(function(err){
        root.innerHTML = '<h1 id="pt">Hello</h1><p>' + esc(err.message) + '</p>';
      });
  }
  load();
})();
