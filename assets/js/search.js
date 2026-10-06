/*
 * AIPA library search (shared by every page that has a search box)
 * ---------------------------------------------------------------
 * XANO: set window.AIPA_CONFIG.apiBase (in /assets/js/config.js) to the
 * Xano API group base URL. Empty = use /assets/data/library.json and the
 * local search below, which returns the same shape as the Xano endpoint.
 * Contract: xano/xano-search-notes.md
 *
 * Page hooks (all optional except #q):
 *   #q                      search input (inside a <form>)
 *   #results                results panel; data-section="slug" scopes search to one section
 *   #libgrid                content hidden while results are showing
 *   [data-q]                buttons that run a preset search
 */
(function(){
  var CFG = window.AIPA_CONFIG || {};
  var q=document.getElementById('q'); if(!q) return;
  var form=q.closest('form');
  var results=document.getElementById('results'), grid=document.getElementById('libgrid');
  var countEl=document.getElementById('rescount'), list=document.getElementById('reslist');
  var chipsEl=document.getElementById('chips'), altEl=document.getElementById('resalt'), emptyEl=document.getElementById('resempty');
  var fixedSection=results && results.dataset.section || '';
  var state={q:'',section:fixedSection}, timer=null, reqId=0, DATA=null;

  function loadData(){
    if(DATA) return Promise.resolve(DATA);
    var inline=document.getElementById('aipa-library-data');
    if(inline){DATA=JSON.parse(inline.textContent);return Promise.resolve(DATA);}
    return fetch(CFG.dataUrl||'/assets/data/library.json').then(function(r){return r.json();}).then(function(d){DATA=d;return d;});
  }

  var STOP=['the','and','for','how','much','what','does','do','is','are','my','our','a','an','to','of','in','on','with','can','i','we','it','who','when','where','why','won','t','s','about','get','need','should'];
  function norm(t){return (t||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();}
  function has(h,t){return (' '+h).indexOf(' '+t)>-1;}
  function stem(w){return w.length>4?w.replace(/(ing|es|s)$/,''):w;}

  /* Mirrors GET /library/search?q=&section=&page=&per_page= */
  function localSearch(query,section){
    return loadData().then(function(D){
      var nq=norm(query), terms=nq.split(' ').filter(function(w){return w.length>1 && STOP.indexOf(w)<0;});
      var expanded=[];
      D.synonyms.forEach(function(sy){ if((' '+nq+' ').indexOf(' '+sy.term+' ')>-1) expanded.push(sy.maps_to); });
      var all=terms.map(stem).concat(expanded.map(norm));
      var hits=[];
      D.articles.forEach(function(a){
        var T=norm(a.title), G=norm(a.tags.replace(/,/g,' ')), M=norm(a.summary), C=norm(a.section);
        var score=0, matchedAll=true;
        terms.forEach(function(raw){
          var t=stem(raw), s=0;
          if(has(T,t)) s+=5; if(has(G,t)) s+=3; if(has(M,t)) s+=1; if(has(C,t)) s+=2;
          if(!s) matchedAll=false; score+=s;
        });
        expanded.forEach(function(e){ e=norm(e); if(has(T,e)) score+=4; if(has(G,e)) score+=3; if(has(M,e)) score+=1; });
        if(nq.length>2 && has(T,nq)) score+=6;
        if(score>0 && (matchedAll || expanded.length || !terms.length)) hits.push({a:a,score:score});
      });
      if(!hits.length){
        D.articles.forEach(function(a){
          var hay=norm(a.title+' '+a.tags+' '+a.summary), s=0;
          all.forEach(function(t){ if(t && has(hay,t)) s++; });
          if(s) hits.push({a:a,score:s});
        });
      }
      hits.sort(function(x,y){return y.score-x.score;});
      var counts={}; hits.forEach(function(h){counts[h.a.section_slug]=(counts[h.a.section_slug]||0)+1;});
      var filtered=section?hits.filter(function(h){return h.a.section_slug===section;}):hits;
      return {
        query:query, expanded_terms:expanded, total:filtered.length, total_all_sections:hits.length,
        section_counts:counts, page:1, per_page:50, highlight_terms:all,
        items:filtered.map(function(h){var a=h.a;return {id:a.id,slug:a.slug,title:a.title,summary:a.summary,section:a.section,section_slug:a.section_slug,url:a.url,score:h.score};})
      };
    });
  }
  function remoteSearch(query,section){
    var u=CFG.apiBase.replace(/\/$/,'')+'/library/search?q='+encodeURIComponent(query)+(section?'&section='+encodeURIComponent(section):'')+'&page=1&per_page=50';
    return fetch(u,{headers:{'Accept':'application/json'}}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
      .catch(function(){return localSearch(query,section);});
  }
  function search(query,section){return CFG.apiBase?remoteSearch(query,section):localSearch(query,section);}

  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function hl(text,terms){
    var out=esc(text), ts=(terms||[]).filter(function(t){return t&&t.length>1;}).sort(function(a,b){return b.length-a.length;});
    if(!ts.length) return out;
    var re=new RegExp('\\b('+ts.map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|')+')','gi');
    return out.replace(re,'<mark>$1</mark>');
  }
  function sectionName(slug){return DATA && DATA.sections[slug] || '';}

  function render(res){
    var n=res.total, all=res.total_all_sections;
    var scope=fixedSection?' in '+sectionName(fixedSection):'';
    countEl.textContent = n? (n===1?'1 guide':n+' guides')+scope+' for \u201c'+res.query+'\u201d' : 'No guides'+scope+' for \u201c'+res.query+'\u201d';
    var alt=res.expanded_terms&&res.expanded_terms.length ? 'Also showing results for '+res.expanded_terms.join(', ')+'.' : '';
    if(fixedSection && all>n) alt+=(alt?' ':'')+(all-n)+' more in other sections.';
    altEl.innerHTML=esc(alt)+(fixedSection && all>n?' <a class="inline" href="/library/?q='+encodeURIComponent(res.query)+'">Search the whole library</a>':'');
    if(chipsEl){
      chipsEl.innerHTML='';
      if(all && !fixedSection){
        var mk=function(slug,label,ct){var b=document.createElement('button');b.type='button';b.className='chip';b.setAttribute('aria-pressed',String(state.section===slug));
          b.innerHTML=esc(label)+'<span class="ct">'+ct+'</span>';b.addEventListener('click',function(){state.section=slug;run(true);});chipsEl.appendChild(b);};
        mk('','All sections',all);
        Object.keys(DATA.sections).forEach(function(k){ if(res.section_counts[k]) mk(k,DATA.sections[k],res.section_counts[k]); });
      }
    }
    list.innerHTML=res.items.map(function(it){
      var href=it.slug?'/library/article/?slug='+encodeURIComponent(it.slug):it.url;
      return '<li><a href="'+esc(href)+'"><span class="sec">'+esc(it.section)+'</span><span><span class="t">'+hl(it.title,res.highlight_terms)+'</span><span class="sm">'+hl(it.summary,res.highlight_terms)+'</span></span></a></li>';
    }).join('');
    emptyEl.hidden=!!n;
  }
  function show(on){results.hidden=!on; if(grid) grid.classList.toggle('dim',on);}
  function syncURL(){try{var u=new URL(location.href);if(state.q)u.searchParams.set('q',state.q);else u.searchParams.delete('q');history.replaceState(null,'',u);}catch(e){}}

  function run(keepSection){
    state.q=q.value.trim(); if(!keepSection) state.section=fixedSection;
    if(!results){ /* page without a results panel (home hero on small builds): go to library */ return; }
    syncURL();
    if(!state.q){show(false);return;}
    var id=++reqId;
    loadData().then(function(){return search(state.q,state.section);}).then(function(res){ if(id!==reqId)return; show(true); render(res); });
  }

  var target=document.getElementById(form && form.dataset.scrollto || 'library');
  q.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(function(){run(false);},250);});
  if(form) form.addEventListener('submit',function(e){e.preventDefault();clearTimeout(timer);run(false);if(target)target.scrollIntoView();});
  var clr=document.getElementById('resclear'); if(clr) clr.addEventListener('click',function(){q.value='';run(false);q.focus();});
  document.querySelectorAll('[data-q]').forEach(function(b){b.addEventListener('click',function(){q.value=b.dataset.q;run(false);if(target)target.scrollIntoView();});});
  try{var init=new URL(location.href).searchParams.get('q');if(init){q.value=init;run(false);}}catch(e){}
})();
