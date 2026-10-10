(function(){
  var topics = {
    'curbless-showers': 'curbless showers',
    'grab-bars': 'grab bars',
    'comfort-height-toilets': 'comfort-height toilets',
    'sit-down-vanities': 'a vanity you can sit at',
    'linear-drains': 'linear drains',
    'shower-benches': 'shower benches',
    'zero-step-entries': 'a zero-step entry',
    'ramps': 'ramps',
    'stairlifts': 'stairlifts',
    'home-elevators': 'a home elevator',
    'handrails': 'handrails',
    'safer-cooking': 'safer cooking',
    'reachable-kitchen': 'a kitchen you can reach',
    'main-floor-bedroom': 'a bedroom on the main floor',
    'night-paths': 'night lighting',
    'ceiling-lift-planning': 'a ceiling lift',
    'dcof-tile': 'slip-resistant tile',
    'flooring': 'flooring',
    'more-light': 'lighting',
    'glare-contrast': 'glare and contrast',
    'easy-hardware': 'easier hardware',
    'typical-costs': 'what a project costs',
    'medicare-advantage': 'Medicare Advantage',
    'medicaid-waivers': 'Medicaid waivers',
    'va-grants': 'VA housing grants',
    'medical-deduction': 'deducting a home change',
    'equity-insurance': 'paying for the work',
    'ada-and-homes': 'the ADA and your home',
    'permits': 'permits',
    'hoa-rights': 'an HOA',
    'contractor-questions': 'hiring a contractor',
    'raising-it': 'a parent who says they are fine',
    'siblings': 'getting siblings on the same page',
    'upgrades-not-decline': 'how to talk about the changes',
    'when-home-isnt-safe': 'when staying home is no longer safe',
    'home-vs-assisted-living': 'staying home or assisted living',
    'buyer-features': 'features buyers want',
    'resale-risks': 'resale',
    'appraisals': 'an appraisal'
  };
  function topic(guide){
    var slug = guide && guide.slug;
    if (slug && topics[slug]) return topics[slug];
    var title = String(guide && guide.title || '').split(':')[0].trim();
    if (!title) return 'this guide';
    return title.charAt(0).toLowerCase() + title.slice(1);
  }
  function line(guide){
    return 'If you have more questions about ' + topic(guide) + ', or about any other part of adapting your home, book a free Ask Anything 1:1 with an AIPA Guide. Nothing to sign.';
  }
  window.AIPA_CLOSE = { topic: topic, line: line };
})();
