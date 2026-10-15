(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.apiBase || '').replace(/\/$/, '');
  if (!base) return;
  window.AIPA_NO_SPIDER = false;

  function apply(){
    var robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');
  }

  fetch(base + '/site/spiders', {headers:{'Accept':'application/json'}, cache:'no-store'})
    .then(function(response){
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(function(data){
      var on = !!(data && (data.block_spiders === true || data.block_spiders === 1));
      window.AIPA_NO_SPIDER = on;
      if (on) apply();
    })
    .catch(function(){});
})();
