window.AIPA_SEMINAR = {
  zones: {
    'America/Honolulu': 'Hawaii',
    'America/Los_Angeles': 'Pacific',
    'America/Denver': 'Mountain',
    'America/Chicago': 'Central',
    'America/New_York': 'Eastern'
  },
  types: {
    contractor_orientation: 'Contractor Orientation',
    contractor_deep_dive: 'Contractor Deep Dive',
    live_qa: 'Live Q&A',
    family_1_1: 'Ask Anything 1:1',
    ad_hoc: 'Ad Hoc'
  },
  typeLabel: function(value){
    return this.types[value] || '';
  },
  date: function(startsAt){
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startsAt || ''));
    if (!match) return 'Date not set';
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[+match[2] - 1] + ' ' + (+match[3]) + ', ' + match[1];
  },
  format: function(meeting){
    var start = String(meeting.starts_at || '');
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(start);
    if (!match) return 'Date not set';
    var year = +match[1], month = +match[2], day = +match[3], hour = +match[4], minute = +match[5];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    var suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';
    var clock = (hour % 12 || 12) + ':' + (minute < 10 ? '0' : '') + minute + ' ' + (hour < 12 ? 'AM' : 'PM');
    var zone = this.zones[meeting.timezone] || '';
    var when = clock + (zone ? ' ' + zone : '');
    if (meeting.kind === 'recurring' && meeting.frequency === 'weekly') return 'Every ' + weekday + ' at ' + when;
    if (meeting.kind === 'recurring' && meeting.frequency === 'every_two_weeks') return 'Every other ' + weekday + ' at ' + when;
    if (meeting.kind === 'recurring' && meeting.frequency === 'monthly') return 'Monthly on the ' + day + suffix + ' at ' + when;
    return months[month - 1] + ' ' + day + ', ' + year + ' at ' + when;
  }
};
