(function(){
  function notesFor(blocks){
    var notes = [];
    (blocks || []).forEach(function(block){
      if (block.type === 'bullets') {
        (block.items || []).forEach(function(item){
          if (String(item.footnote || '').trim()) notes.push(String(item.footnote).trim());
        });
      } else if (String(block.footnote || '').trim()) {
        notes.push(String(block.footnote).trim());
      }
    });
    return notes;
  }
  function mark(notes, footnote){
    var text = String(footnote || '').trim();
    if (!text) return '';
    return ' ' + (notes.indexOf(text) + 1);
  }
  function qrImage(){
    if (!window.qrcode) return '';
    var code = window.qrcode(0, 'M');
    code.addData('https://goaipa.com/ask-anything/');
    code.make();
    var count = code.getModuleCount();
    var scale = 6;
    var canvas = document.createElement('canvas');
    canvas.width = count * scale;
    canvas.height = count * scale;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2A211C';
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (code.isDark(row, col)) ctx.fillRect(col * scale, row * scale, scale, scale);
      }
    }
    return canvas.toDataURL('image/png');
  }
  function build(guide){
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('The handout builder did not load.');
    var doc = new window.jspdf.jsPDF({unit:'pt', format:'letter'});
    var margin = 50;
    var pageW = 612;
    var pageH = 792;
    var inner = pageW - margin * 2;
    var y = margin;
    var blocks = guide.blocks || [];
    var notes = notesFor(blocks);
    function newPage(){ doc.addPage(); y = margin; }
    function room(height){ if (y + height > pageH - margin) newPage(); }
    function write(text, size, font, style, width, x, color){
      doc.setFont(font, style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      var lines = doc.splitTextToSize(String(text || ''), width);
      var lineH = size * 1.28;
      var height = lines.length * lineH;
      room(height);
      doc.text(lines, x, y + size);
      y += height;
      return height;
    }
    write('AGING IN PLACE ALLIANCE', 11, 'helvetica', 'bold', inner, margin, [122, 51, 25]);
    y += 16;
    write(String(guide.section || '').toUpperCase(), 11, 'helvetica', 'normal', inner, margin, [81, 70, 62]);
    y += 8;
    write(guide.title || 'Guide', 26, 'times', 'normal', inner, margin, [42, 33, 28]);
    y += 12;
    if (guide.summary) {
      write(guide.summary, 13, 'times', 'italic', inner, margin, [42, 33, 28]);
      y += 14;
    }
    blocks.forEach(function(block){
      if (block.type === 'headline') {
        y += 8;
        write(block.text, 18, 'times', 'bold', inner, margin, [42, 33, 28]);
        y += 8;
        return;
      }
      if (block.type === 'paragraph') {
        write(String(block.text || '') + mark(notes, block.footnote), 13, 'times', 'normal', inner, margin, [42, 33, 28]);
        y += 10;
        return;
      }
      if (block.type === 'bullets') {
        (block.items || []).forEach(function(item){
          if (!String(item.text || '').trim()) return;
          write('•  ' + item.text + mark(notes, item.footnote), 13, 'times', 'normal', inner - 8, margin + 8, [42, 33, 28]);
          y += 4;
        });
        y += 8;
        return;
      }
      if (block.type === 'photo-left' || block.type === 'photo-right') {
        var imgW = 150;
        var imgH = 200;
        var gap = 16;
        var textW = inner - imgW - gap;
        room(imgH + 8);
        var top = y;
        var imgX = block.type === 'photo-left' ? margin : margin + textW + gap;
        var textX = block.type === 'photo-left' ? margin + imgW + gap : margin;
        if (block.image) {
          try { doc.addImage(block.image, 'JPEG', imgX, top, imgW, imgH); }
          catch (err) { doc.setDrawColor(205, 191, 168); doc.rect(imgX, top, imgW, imgH); }
        }
        doc.setFont('times', 'normal');
        doc.setFontSize(13);
        doc.setTextColor(42, 33, 28);
        var lines = doc.splitTextToSize(String(block.text || '') + mark(notes, block.footnote), textW);
        doc.text(lines, textX, top + 14);
        y = top + Math.max(imgH, lines.length * 13 * 1.28) + 14;
      }
    });
    if (notes.length) {
      y += 8;
      write('Notes', 14, 'times', 'bold', inner, margin, [42, 33, 28]);
      y += 6;
      notes.forEach(function(note, index){
        write((index + 1) + '.  ' + note, 10, 'times', 'normal', inner, margin, [81, 70, 62]);
        y += 3;
      });
    }
    y += 16;
    room(130);
    doc.setDrawColor(205, 191, 168);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + inner, y);
    y += 14;
    var qr = qrImage();
    if (qr) {
      try { doc.addImage(qr, 'PNG', margin, y, 88, 88); } catch (err) {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(42, 33, 28);
    doc.text('Scan to book an Ask Anything 1:1', margin + 104, y + 22);
    doc.setFontSize(16);
    doc.text('833-AIPA-HUB', margin + 104, y + 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(81, 70, 62);
    doc.text('goaipa.com/ask-anything', margin + 104, y + 64);
    y += 108;
    room(36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(81, 70, 62);
    var legal = doc.splitTextToSize('General education, not medical, legal, or financial advice. For a question about a specific health condition, talk with a doctor or occupational therapist.', inner);
    doc.text(legal, margin, y);
    var uri = doc.output('datauristring');
    var comma = uri.indexOf(',');
    return comma === -1 ? uri : uri.slice(comma + 1);
  }
  window.AIPA_HANDOUT = { build: build, notesFor: notesFor };
})();
