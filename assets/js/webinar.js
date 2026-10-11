(function(){
  var CFG = window.AIPA_CONFIG || {};
  var box = document.getElementById('seminar-schedule');
  if (!box || !CFG.apiBase || !window.AIPA_SEMINAR) return;

  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  fetch(CFG.apiBase.replace(/\/$/, '') + '/seminars', {headers:{'Accept':'application/json'}})
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data){
      if (!data) return;
      var html = '';
      if (data.zoom_url) {
        html += '<p><a class="btn" href="' + esc(data.zoom_url) + '">Join on Zoom</a></p>';
      }
      var meetings = data.meetings || [];
      if (meetings.length) {
        html += '<ul class="seminar-list">' + meetings.map(function(meeting){
          var link = meeting.zoom_url
            ? '<a href="' + esc(meeting.zoom_url) + '">' + esc(meeting.title) + '</a>'
            : esc(meeting.title);
          var length = meeting.duration_minutes ? ' · ' + meeting.duration_minutes + ' minutes' : '';
          var typeName = window.AIPA_SEMINAR.typeLabel(meeting.meeting_type);
          return '<li>' + (typeName ? '<span class="type">' + esc(typeName) + '</span>' : '') +
            '<span class="when">' + esc(window.AIPA_SEMINAR.format(meeting)) + length + '</span>' +
            link + (meeting.summary ? '<span class="detail">' + esc(meeting.summary) + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
      }
      box.innerHTML = html;
    })
    .catch(function(){});
})();
