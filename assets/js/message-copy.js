(function(){
  var KEY = 'aipa_office_token';
  var PAGES = {
    live_qa: 'https://goaipa.com/live-qa/',
    one_to_one: 'https://goaipa.com/ask-anything/',
    library: 'https://goaipa.com/library/'
  };
  var DEFAULTS = {
    sms_opt_in: {
      subject: 'Confirm your mobile number',
      body: 'Hello {{first_name}},\n\nIf we may text you about your home, open this link. It shows the name and email we have, and asks you to confirm your mobile number.\n\n{{sms_opt_in}}\n\nThe link stops working after you submit it.\n\nAging in Place Alliance\n833-AIPA-HUB'
    },
    invite_qa: {
      subject: 'Thank you for joining us today',
      body: 'Hi {{first_name}},\n\nThank you for coming to today\'s Live Q&A.\n\n[If they asked a question: You asked about [topic]. The short answer is [one or two sentences].]\n\nMany people find a private conversation is the easiest next step. An Ask Anything 1:1 is about 30 minutes, about your home and your plans, with no cost and no obligation.\n\nBook my 1:1: {{one_to_one}}\n\nWhenever you\'re ready, or not at all. Either is fine.\n\n[Host name]\n\nAging in Place Alliance\n833-AIPA-HUB'
    },
    invite_qa_sms: {
      subject: '',
      body: 'Hi {{first_name}}, it\'s [Host name]. Thanks for joining the Live Q&A. If you\'d like a private chat about your own home, you can book a 1:1 here: {{one_to_one}} Reply STOP to opt out.'
    },
    invite_visit: {
      subject: 'A home visit',
      body: 'Hello {{first_name}},\n\nThank you for the Ask Anything 1:1.\n\nThe next step is a home visit, if you want a contractor to look at the house.\n\nReply to this email or call 833-AIPA-HUB.\n\nAging in Place Alliance'
    },
    invite_visit_sms: {
      subject: '',
      body: 'Hi {{first_name}}, it\'s [Guide name]. I enjoyed our talk. Any questions since? When you\'re ready, you can book a measuring visit here: [Book a visit] Reply STOP to opt out.'
    },
    guide_followup: {
      subject: 'A guide: {{guide}}',
      body: '{{note}}\n\nPrint this guide:\n{{guide_pdf}}\n\nBook an Ask Anything 1:1:\n{{one_to_one}}\nOr call 833-AIPA-HUB.'
    },
    guide_followup_plain: {
      subject: 'Following up on our conversation',
      body: '{{note}}'
    },
    calculator: {
      subject: 'Your dead lead breakdown',
      body: 'Your dead lead breakdown\n\nLeads in a typical month: {{leads}}\nCost per lead: {{cost_per_lead}}\nClose rate: {{close_rate}}\nAverage job: {{job_value}}\nGross margin: {{gross_margin}}\nIf {{recovery_rate}} of the dead leads became jobs\n\nSpent on leads that never bought, last 2 years: {{spent}}\nRecovered revenue: {{revenue}}\nOur fees: {{fees}}\nNet found margin: {{net}}\n\nThese are illustrations based on your inputs, not a guarantee. We are new, and our pilot exists to measure real results with your leads.'
    }
  };
  var stored = null;
  var pending = null;
  var standingZoom = '';

  function rows(value){
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }
  function fill(text, tokens){
    var out = String(text == null ? '' : text);
    var bag = tokens || {};
    var first = String(bag.first_name || '').trim();
    if (!first) {
      out = out.split('Hello {{first_name}},').join('Hello,');
      out = out.split('Hi {{first_name}},').join('Hi,');
    }
    Object.keys(bag).forEach(function(key){
      out = out.split('{{' + key + '}}').join(bag[key] == null ? '' : String(bag[key]));
    });
    return out;
  }
  function get(key){
    var fallback = DEFAULTS[key] || {subject: '', body: ''};
    var row = stored && stored[key];
    if (!row) return {subject: fallback.subject, body: fallback.body};
    return {
      subject: String(row.subject || '').trim() ? row.subject : fallback.subject,
      body: String(row.body || '').trim() ? row.body : fallback.body
    };
  }
  function compose(key, tokens){
    var row = get(key);
    return {subject: fill(row.subject, tokens), body: fill(row.body, tokens)};
  }
  function load(){
    if (stored) return Promise.resolve(stored);
    if (pending) return pending;
    var CFG = window.AIPA_CONFIG || {};
    var base = (CFG.officeBase || '').replace(/\/$/, '');
    var token = sessionStorage.getItem(KEY) || '';
    if (!base || !token) {
      pending = Promise.resolve(null);
      return pending;
    }
    var headers = {Accept: 'application/json', Authorization: 'Bearer ' + token};
    pending = Promise.all([
      fetch(base + '/office/messages', {headers: headers}).then(function(response){
        return response.json().catch(function(){ return []; }).then(function(data){
          return response.ok ? data : null;
        });
      }),
      fetch(base + '/office/zoom', {headers: headers}).then(function(response){
        return response.json().catch(function(){ return {}; }).then(function(data){
          return response.ok ? data : {};
        });
      }).catch(function(){ return {}; })
    ]).then(function(result){
      var data = result[0];
      standingZoom = (result[1] && result[1].zoom_url) || '';
      if (!data) return null;
      stored = {};
      rows(data).forEach(function(row){
        if (row && row.key) stored[row.key] = row;
      });
      return stored;
    }).catch(function(){ return null; });
    return pending;
  }

  window.AIPA_MESSAGES = {
    pages: function(){
      return {
        live_qa: PAGES.live_qa,
        one_to_one: PAGES.one_to_one,
        library: PAGES.library,
        zoom: standingZoom,
        sms_opt_in: '',
        first_name: ''
      };
    },
    fill: fill,
    get: get,
    compose: compose,
    load: load
  };
})();
