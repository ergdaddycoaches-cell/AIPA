(function(){
  var CFG = window.AIPA_CONFIG || {};
  var base = (CFG.apiBase || '').replace(/\/$/, '');
  var screen = document.getElementById('screen-form');
  var miss = document.getElementById('screen-miss');
  var callback = document.getElementById('callback-form');
  var next = document.getElementById('callback-next');
  var status = document.getElementById('screen-status');
  if (!screen || !miss || !callback || !next) return;

  var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  function clipUtm(value){
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  }
  function readUtms(){
    var params = new URLSearchParams(window.location.search);
    var found = {};
    var any = false;
    utmKeys.forEach(function(key){
      found[key] = clipUtm(params.get(key));
      if (found[key]) any = true;
    });
    try {
      if (any) sessionStorage.setItem('aipa_contractor_utm', JSON.stringify(found));
      else {
        var saved = JSON.parse(sessionStorage.getItem('aipa_contractor_utm') || '{}');
        utmKeys.forEach(function(key){ found[key] = clipUtm(saved[key]); });
      }
    } catch (err) {}
    return found;
  }
  var utm = readUtms();
  utmKeys.forEach(function(key){
    var input = document.getElementById(key);
    if (input) input.value = utm[key] || '';
  });

  var keys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];
  var pass = {q1:'yes', q2:'yes', q3:'yes', q4:'yes', q5:'yes', q6:'yes', q7:'yes', q8:'no', q9:'yes', q10:'yes'};
  var track = document.getElementById('q-track');
  var slides = track ? Array.prototype.slice.call(track.children) : [];
  var slide = 0;
  var prevBtn = document.getElementById('q-prev');
  var count = document.getElementById('q-count');

  function showSlide(next){
    if (!track || !slides.length) return;
    slide = Math.max(0, Math.min(slides.length - 1, next));
    var box = track.closest('.wrap') || track.parentElement;
    var width = box.clientWidth;
    slides.forEach(function(item){
      item.style.flex = '0 0 ' + width + 'px';
      item.style.width = width + 'px';
      item.style.maxWidth = width + 'px';
    });
    track.style.transform = 'translateX(' + (-slide * width) + 'px)';
    if (count) count.textContent = 'Question ' + (slide + 1) + ' of ' + slides.length;
    var marks = document.querySelectorAll('#q-marks span');
    marks.forEach(function(mark, i){
      mark.classList.toggle('on', !!answer(keys[i]));
      mark.classList.toggle('here', i === slide);
    });
    if (prevBtn) prevBtn.hidden = slide === 0;
  }
  window.addEventListener('resize', function(){ showSlide(slide); });
  if (prevBtn) prevBtn.addEventListener('click', function(){ showSlide(slide - 1); });
  function advance(input){
    var card = input.closest('.tool-q');
    var at = slides.indexOf(card);
    if (at < 0) return;
    if (at === slides.length - 1) showResult();
    else showSlide(at + 1);
  }
  if (track) {
    screen.addEventListener('click', function(e){
      var label = e.target.closest('.picks label');
      if (!label || !screen.contains(label)) return;
      var input = label.querySelector('input');
      if (input && input.checked) advance(input);
    });
    screen.addEventListener('change', function(e){
      if (!e.target || e.target.type !== 'radio') return;
      advance(e.target);
    });
  }
  showSlide(0);

  function answer(name){
    var picked = screen.querySelector('input[name="' + name + '"]:checked');
    return picked ? picked.value : '';
  }
  function passed(){
    return keys.every(function(name){ return answer(name) === pass[name]; });
  }
  function payload(){
    return {
      name: document.getElementById('cb-name').value.trim(),
      company: document.getElementById('cb-company').value.trim(),
      phone: document.getElementById('cb-phone').value.trim(),
      email: document.getElementById('cb-email').value.trim(),
      google_reviews: answer('q1') === 'yes',
      average_project: answer('q2') === 'yes',
      close_rate: answer('q3') === 'yes',
      cold_leads: answer('q4') === 'yes',
      not_really_cold: answer('q5') === 'yes',
      peer_conversations: answer('q6') === 'yes',
      family_differences: answer('q7') === 'yes',
      estimators_nurture: answer('q8') === 'yes',
      third_party: answer('q9') === 'yes',
      commission_only: answer('q10') === 'yes',
      utm_source: (document.getElementById('utm_source') || {}).value || '',
      utm_medium: (document.getElementById('utm_medium') || {}).value || '',
      utm_campaign: (document.getElementById('utm_campaign') || {}).value || '',
      utm_term: (document.getElementById('utm_term') || {}).value || '',
      utm_content: (document.getElementById('utm_content') || {}).value || ''
    };
  }

  function showResult(){
    var missing = keys.filter(function(name){ return !answer(name); });
    if (missing.length) {
      status.textContent = 'Answer every question.';
      var card = screen.querySelector('input[name="' + missing[0] + '"]');
      var at = slides.indexOf(card && card.closest('.tool-q'));
      if (at > -1) showSlide(at);
      if (card) card.focus();
      return;
    }
    status.textContent = '';
    screen.hidden = true;
    if (passed()) {
      callback.hidden = false;
      document.getElementById('cb-name').focus();
    } else {
      miss.hidden = false;
    }
  }

  document.getElementById('retake').addEventListener('click', function(){
    screen.reset();
    miss.hidden = true;
    callback.hidden = true;
    screen.hidden = false;
    status.textContent = '';
    showSlide(0);
  });

  callback.addEventListener('submit', function(e){
    e.preventDefault();
    var msg = document.getElementById('callback-status');
    var button = callback.querySelector('button[type="submit"]');
    if (!passed()) {
      screen.hidden = true;
      callback.hidden = true;
      miss.hidden = false;
      return;
    }
    if (!base) {
      msg.textContent = 'Something went wrong.';
      return;
    }
    msg.textContent = 'Sending…';
    button.disabled = true;
    fetch(base + '/contractor-callback', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'Accept':'application/json'},
      body: JSON.stringify(payload())
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data){
        if (!r.ok) throw new Error(data.message || data.error || 'Something went wrong.');
        return data;
      });
    }).then(function(){
      callback.hidden = true;
      next.hidden = false;
      var qualify = document.getElementById('screen-title');
      if (qualify) qualify.hidden = true;
      var section = document.getElementById('screening');
      if (section) section.setAttribute('aria-labelledby', 'callback-next-title');
      var head = document.getElementById('callback-next-title');
      if (head) head.focus();
    }).catch(function(err){
      button.disabled = false;
      msg.textContent = err.message;
    });
  });
})();
