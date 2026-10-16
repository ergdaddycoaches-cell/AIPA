(function(){
  var KINDS = {
    title: 'field',
    section: 'field',
    summary: 'field',
    slug: 'field',
    tags: 'field',
    headline: 'headline',
    paragraph: 'paragraph',
    paragraph_image_left: 'photo-left',
    paragraph_image_right: 'photo-right',
    bullets: 'bullets'
  };
  var RATIOS = { '3:2': true, '4:3': true, '1:1': true, '3:4': true };

  function trimBlock(lines){
    var start = 0;
    var end = lines.length;
    while (start < end && !String(lines[start]).trim()) start++;
    while (end > start && !String(lines[end - 1]).trim()) end--;
    return lines.slice(start, end).join('\n').trim();
  }
  function oneLine(value){
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
  function splitFootnote(body, errors, line){
    var notes = [];
    var copy = [];
    String(body || '').split('\n').forEach(function(row){
      var note = row.match(/^\s*\^\s*(.*)$/);
      if (note) notes.push(note[1].trim());
      else copy.push(row);
    });
    if (notes.length > 1) errors.push('Line ' + line + ': a block can have one footnote. The last one was kept.');
    return { text: copy.join('\n').trim(), footnote: notes.length ? notes[notes.length - 1] : '' };
  }
  function splitPhotoAlt(body, errors, line){
    var alts = [];
    var copy = [];
    String(body || '').split('\n').forEach(function(row){
      var alt = row.match(/^\s*@\s*(.*)$/);
      if (alt) alts.push(alt[1].trim());
      else copy.push(row);
    });
    if (alts.length > 1) errors.push('Line ' + line + ': a photo can have one description. The last one was kept.');
    return { text: copy.join('\n').trim(), alt: alts.length ? alts[alts.length - 1] : '' };
  }
  function ratioOf(arg, errors, line){
    var value = oneLine(arg);
    if (!value) return '3:2';
    if (RATIOS[value]) return value;
    errors.push('Line ' + line + ': "' + value + '" is not a photo shape. Use 3:2, 4:3, 1:1, or 3:4.');
    return '3:2';
  }
  function bulletBlock(body, errors, line){
    var items = [];
    String(body || '').split('\n').forEach(function(row){
      if (!row.trim()) return;
      var noteLine = row.match(/^\s*\^\s*(.*)$/);
      if (noteLine) {
        if (!items.length) errors.push('Line ' + line + ': a footnote came before its bullet.');
        else if (items[items.length - 1].footnote) errors.push('Line ' + line + ': that bullet already had a footnote. The last one was kept.');
        if (items.length) items[items.length - 1].footnote = noteLine[1].trim();
        return;
      }
      var item = row.match(/^\s*[-*]\s+(.*)$/);
      if (!item) {
        errors.push('Line ' + line + ': "' + row.trim() + '" is not a bullet. Start the line with a dash.');
        return;
      }
      var both = item[1].match(/^(.*?)\s+\^\s+(.*)$/);
      if (both) items.push({ text: both[1].trim(), footnote: both[2].trim() });
      else items.push({ text: item[1].trim(), footnote: '' });
    });
    if (!items.length) {
      errors.push('Line ' + line + ': the bulleted list has no bullets.');
      return null;
    }
    return { type: 'bullets', items: items };
  }

  function parse(source){
    var text = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var lines = text.split('\n');
    var chunks = [];
    var current = null;
    var errors = [];
    lines.forEach(function(line, index){
      var tag = line.match(/^\[([A-Za-z0-9_]+)(?:\s+([^\]]+))?\]\s*$/);
      if (tag) {
        if (current) chunks.push(current);
        var name = tag[1].toLowerCase();
        current = {
          name: name,
          kind: KINDS[name] || '',
          arg: tag[2] ? tag[2].trim() : '',
          lines: [],
          line: index + 1
        };
        if (!current.kind) errors.push('Line ' + (index + 1) + ': [' + name + '] is not a markup tag.');
        return;
      }
      if (!current) {
        if (line.trim()) errors.push('Line ' + (index + 1) + ': that line came before the first tag, so it was skipped.');
        return;
      }
      current.lines.push(line);
    });
    if (current) chunks.push(current);

    var guide = { title: '', section: '', summary: '', slug: '', tags: '', blocks: [], errors: errors };
    var seen = {};
    var n = 0;
    chunks.forEach(function(chunk){
      if (!chunk.kind) return;
      var body = trimBlock(chunk.lines);
      if (chunk.kind === 'field') {
        if (chunk.name === 'title' || chunk.name === 'section' || chunk.name === 'slug') body = oneLine(body);
        if (chunk.name === 'tags') body = oneLine(body.replace(/\n+/g, ', '));
        if (seen[chunk.name]) errors.push('Line ' + chunk.line + ': [' + chunk.name + '] was already set. The first one was kept.');
        else {
          seen[chunk.name] = true;
          guide[chunk.name] = body;
        }
        if (!body) errors.push('Line ' + chunk.line + ': [' + chunk.name + '] is empty.');
        return;
      }
      if (!body) {
        errors.push('Line ' + chunk.line + ': [' + chunk.name + '] has no copy.');
        return;
      }
      n += 1;
      if (chunk.kind === 'bullets') {
        var list = bulletBlock(body, errors, chunk.line);
        if (list) {
          list.id = 'm' + n;
          guide.blocks.push(list);
        }
        return;
      }
      if (chunk.kind === 'headline') {
        guide.blocks.push({ id: 'm' + n, type: 'headline', text: oneLine(body) });
        return;
      }
      var split = splitFootnote(body, errors, chunk.line);
      var alt = '';
      if (chunk.kind === 'photo-left' || chunk.kind === 'photo-right') {
        var described = splitPhotoAlt(split.text, errors, chunk.line);
        split.text = described.text;
        alt = described.alt;
      } else if (/^\s*@/m.test(split.text)) {
        errors.push('Line ' + chunk.line + ': a photo description belongs on a photo block.');
      }
      if (!split.text) {
        errors.push('Line ' + chunk.line + ': [' + chunk.name + '] has no copy.');
        return;
      }
      var block = { id: 'm' + n, type: chunk.kind, text: split.text, footnote: split.footnote };
      if (chunk.kind === 'photo-left' || chunk.kind === 'photo-right') {
        block.image = '';
        block.ratio = ratioOf(chunk.arg, errors, chunk.line);
        block.alt = alt;
      }
      guide.blocks.push(block);
    });
    return guide;
  }

  function shiftLine(error, start){
    if (/^Line \d+/.test(error)) {
      return error.replace(/^Line (\d+)/, function(_, n){
        return 'Line ' + (start + Number(n) - 1);
      });
    }
    return 'Line ' + start + ': ' + error;
  }

  function parseMany(source){
    var text = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var lines = text.split('\n');
    var parts = [];
    var buf = [];
    var start = 1;
    function flush(){
      var chunk = buf.join('\n');
      buf = [];
      if (!String(chunk).trim()) return;
      var guide = parse(chunk);
      guide.line = start;
      guide.errors = guide.errors.map(function(error){ return shiftLine(error, start); });
      parts.push(guide);
    }
    lines.forEach(function(line, index){
      if (/^\s*\[article\]\s*$/i.test(line)) {
        flush();
        start = index + 2;
        return;
      }
      if (!buf.length) start = index + 1;
      buf.push(line);
    });
    flush();
    return parts;
  }

  window.AIPA_MARKUP = { parse: parse, parseMany: parseMany };
})();
