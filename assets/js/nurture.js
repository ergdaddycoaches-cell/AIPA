(function(){
  var CFG = window.AIPA_CONFIG || {};
  var api = (CFG.apiBase || '').replace(/\/$/, '');
  var root = document.getElementById('nurture');
  var token = '';
  var notice = '';
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
  function show(data){
    var heading = data.name ? 'Hello ' + esc(data.name) : 'Hello';
    document.title = (data.name ? 'Hello ' + data.name : 'Hello') + ' | Aging in Place Alliance';
    var video = videoHtml(data.video_url);
    var invite = 'When you are ready to talk about your house, book a 1:1 Consult.';
    var book = data.show_book
      ? '<div class="nurture-book"><p class="nurture-invite">' + invite + '</p><p class="voice-cta"><a class="btn" href="/ask-anything/">Book a 1:1 Consult</a></p></div>'
      : '';
    var topics = data.topics || [];
    var form = '';
    if (!data.stopped && topics.length) {
      form = '<form class="signup" id="nurture-form"><fieldset><legend>Which topic would you like to explore next?</legend>' +
        topics.map(function(topic, index){
          return '<label class="check nurture-topic"><input type="radio" name="article_id" value="' + topic.id + '"' + (index === 0 ? ' required' : '') + '> <span><b class="nurture-title">' + esc(topic.title) + '</b>' +
            (topic.summary ? '<span class="nurture-summary">' + esc(topic.summary) + '</span>' : '') + '</span></label>';
        }).join('') +
        '<div class="actions"><button class="btn" type="submit">Send me this guide</button></div><p class="status-line" id="nurture-status" role="status"></p></fieldset></form>';
    } else if (!data.stopped) {
      form = '<p>There are no more topics on your page right now.</p>';
    } else {
      form = '<p>This page is finished. The library is still here if you want to keep reading.</p>';
    }
    var note = notice ? '<p role="status">' + esc(notice) + '</p>' : '';
    notice = '';
    root.innerHTML = '<h1 id="pt">' + heading + '</h1><p class="lede">Thank you for coming to the Live Q&amp;A.</p>' + note + video + form + book;
    var choose = document.getElementById('nurture-form');
    if (choose) choose.addEventListener('submit', submit);
    if (data.video_url) {
      fetch(api + '/nurture/seen', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify({t: token})
      }).catch(function(){});
    }
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
      notice = 'The guide is on its way. Check your email.';
      return load();
    }).catch(function(err){
      status.textContent = err.message;
    });
  }
  function load(){
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
      .then(show)
      .catch(function(err){
        root.innerHTML = '<h1 id="pt">Hello</h1><p>' + esc(err.message) + '</p>';
      });
  }
  load();
})();
