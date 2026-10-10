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
    var n = notes.indexOf(text);
    return n < 0 ? '' : String(n + 1);
  }
  function photoBox(block){
    var parts = String(block.ratio || '3:4').split(':');
    var rw = Number(parts[0]) || 3;
    var rh = Number(parts[1]) || 4;
    var width = rh > rw ? 112 : 150;
    return {w: width, h: width * rh / rw};
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
  function readingLine(text){
    var count = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    var n = Math.max(1, Math.round(count / 200));
    return 'About ' + n + (n === 1 ? ' minute' : ' minutes');
  }
  function guideWords(guide){
    var parts = [guide.summary || ''];
    (guide.blocks || []).forEach(function(block){
      if (block.text) parts.push(block.text);
      (block.items || []).forEach(function(item){ if (item && item.text) parts.push(item.text); });
    });
    return parts.join(' ');
  }
  function wrapCanvas(ctx, text, maxW){
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = '';
    words.forEach(function(word){
      var next = cur ? cur + ' ' + word : word;
      if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = word; }
      else cur = next;
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }
  function titleCard(topic, readLine, width){
    var scale = 3;
    var timeW = 132;
    var sealW = 72;
    var pad = 14;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = '26px "VI Phong Lan Hoa", cursive';
    var topicMax = width - sealW - timeW - pad * 2;
    var topicSize = 26;
    while (topicSize > 15 && ctx.measureText(topic).width > topicMax) {
      topicSize -= 0.5;
      ctx.font = topicSize + 'px "VI Phong Lan Hoa", cursive';
    }
    ctx.font = '14px "VI Phong Lan Hoa", cursive';
    var readLines = wrapCanvas(ctx, readLine, timeW - pad * 2);
    var topicH = topicSize * 1.25;
    var readH = readLines.length * 18;
    var boxH = Math.max(76, 28 + Math.max(topicH, readH) + 16);
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(boxH * scale);
    ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FCF9F3';
    ctx.fillRect(4, 4, width - 8, boxH - 8);
    ctx.strokeStyle = '#CDBFA8';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(0.4, 0.4, width - 0.8, boxH - 0.8);
    ctx.strokeRect(4.4, 4.4, width - 8.8, boxH - 8.8);
    ctx.beginPath();
    ctx.moveTo(sealW, 4);
    ctx.lineTo(sealW, boxH - 4);
    ctx.moveTo(width - timeW, 4);
    ctx.lineTo(width - timeW, boxH - 4);
    ctx.stroke();
    var cx = sealW / 2;
    var cy = boxH / 2;
    ctx.beginPath();
    ctx.strokeStyle = '#2A211C';
    ctx.lineWidth = 1.15;
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2A211C';
    ctx.font = '500 11px Newsreader, Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.04em';
    ctx.fillText('AIPA', cx, cy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    ctx.fillStyle = '#51463E';
    ctx.font = '700 8px Helvetica, Arial, sans-serif';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.12em';
    ctx.fillText('TO READ', width - timeW + 12, 18);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    ctx.fillStyle = '#2A211C';
    ctx.font = topicSize + 'px "VI Phong Lan Hoa", cursive';
    ctx.textBaseline = 'middle';
    ctx.fillText(topic, sealW + pad, boxH / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.font = '14px "VI Phong Lan Hoa", cursive';
    readLines.forEach(function(line, index){
      ctx.fillText(line, width - timeW + 12, 40 + index * 18);
    });
    return { url: canvas.toDataURL('image/png'), h: boxH };
  }
  var FACE = 'Atkinson';
  var fontFiles = {
    normal: 'AtkinsonHyperlegible-Regular.ttf',
    bold: 'AtkinsonHyperlegible-Bold.ttf',
    italic: 'AtkinsonHyperlegible-Italic.ttf'
  };
  var fontCache = {};
  function bytesToBase64(buf){
    var bytes = new Uint8Array(buf);
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  function ready(){
    var styles = Object.keys(fontFiles);
    if (styles.every(function(style){ return fontCache[style]; })) return Promise.resolve();
    return Promise.all(styles.map(function(style){
      if (fontCache[style]) return;
      return fetch('/assets/fonts/' + fontFiles[style]).then(function(r){
        if (!r.ok) throw new Error('The reading font did not load.');
        return r.arrayBuffer();
      }).then(function(buf){ fontCache[style] = bytesToBase64(buf); });
    }));
  }
  function useFonts(doc){
    Object.keys(fontFiles).forEach(function(style){
      if (!fontCache[style]) throw new Error('The reading font did not load.');
      doc.addFileToVFS(fontFiles[style], fontCache[style]);
      doc.addFont(fontFiles[style], FACE, style);
    });
    doc.setFont(FACE, 'normal');
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
    useFonts(doc);
    var body = 14;
    var lead = 1.4;
    var qr = qrImage();
    var qrSize = 54;
    var footTop = pageH - 28 - qrSize;
    var floor = footTop - 18;
    function newPage(){ doc.addPage(); y = margin; }
    function room(height){ if (y + height > floor) newPage(); }
    function textLines(text, size, font, style, width){
      doc.setFont(font, style);
      doc.setFontSize(size);
      return doc.splitTextToSize(String(text || ''), width);
    }
    function write(text, size, font, style, width, x, color, sup){
      var lines = textLines(text, size, font, style, width - (sup ? 14 : 0));
      var lineH = size * 1.4;
      lines.forEach(function(line, index){
        room(lineH);
        doc.setFont(font, style);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        var baseline = y + size;
        doc.text(line, x, baseline);
        if (sup && index === lines.length - 1) {
          var end = x + doc.getTextWidth(line) + 1;
          doc.setFont(font, style);
          doc.setFontSize(8);
          doc.text(sup, end, baseline - 6);
        }
        y += lineH;
      });
      return lines.length * lineH;
    }
    function keepWith(block){
      if (!block) return body * lead * 2;
      if (block.type === 'photo-left' || block.type === 'photo-right') return photoBox(block).h + 14;
      if (block.type === 'headline') {
        var lines = textLines(block.text, 18, FACE, 'bold', inner);
        return 16 + lines.length * 18 * lead;
      }
      return body * lead * 2;
    }
    var card = titleCard(guide.section || 'Guide', readingLine(guideWords(guide)), inner);
    try { doc.addImage(card.url, 'PNG', margin, y, inner, card.h); } catch (err) {}
    y += card.h + 18;
    write(guide.title || 'Guide', 26, FACE, 'normal', inner, margin, [42, 33, 28]);
    y += 12;
    if (guide.summary) {
      write(guide.summary, 16, FACE, 'normal', inner, margin, [42, 33, 28]);
      if (y + 35 > floor) newPage();
      y += 18;
      doc.setDrawColor(42, 33, 28);
      doc.setLineWidth(1);
      doc.line(margin, y, margin + 72, y);
      y += 16;
    }
    blocks.forEach(function(block, index){
      if (block.type === 'headline') {
        var lines = textLines(block.text, 18, FACE, 'bold', inner);
        var headH = 16 + lines.length * 18 * lead;
        if (y > margin && y + headH + keepWith(blocks[index + 1]) > floor) newPage();
        y += 8;
        write(block.text, 18, FACE, 'bold', inner, margin, [42, 33, 28]);
        y += 8;
        return;
      }
      if (block.type === 'paragraph') {
        write(block.text, body, FACE, 'normal', inner, margin, [42, 33, 28], mark(notes, block.footnote));
        y += 10;
        return;
      }
      if (block.type === 'bullets') {
        (block.items || []).forEach(function(item){
          if (!String(item.text || '').trim()) return;
          var text = String(item.text || '');
          var sup = mark(notes, item.footnote);
          doc.setFont(FACE, 'normal');
          doc.setFontSize(body);
          var bulletW = doc.getTextWidth('•') + 8;
          var x = margin + 8;
          var lines = textLines(text, body, FACE, 'normal', inner - 8 - bulletW - (sup ? 14 : 0));
          var lineH = body * lead;
          lines.forEach(function(line, index){
            room(lineH);
            doc.setFont(FACE, 'normal');
            doc.setFontSize(body);
            doc.setTextColor(42, 33, 28);
            var baseline = y + body;
            if (index === 0) doc.text('•', x, baseline);
            doc.text(line, x + bulletW, baseline);
            if (sup && index === lines.length - 1) {
              var end = x + bulletW + doc.getTextWidth(line) + 1;
              doc.setFont(FACE, 'normal');
              doc.setFontSize(8);
              doc.text(sup, end, baseline - 6);
            }
            y += lineH;
          });
          y += 4;
        });
        y += 8;
        return;
      }
      if (block.type === 'photo-left' || block.type === 'photo-right') {
        var box = photoBox(block);
        var imgW = box.w;
        var imgH = box.h;
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
        doc.setFont(FACE, 'normal');
        doc.setFontSize(body);
        doc.setTextColor(42, 33, 28);
        var sup = mark(notes, block.footnote);
        var lines = doc.splitTextToSize(String(block.text || ''), textW - (sup ? 14 : 0));
        var lineH = body * lead;
        lines.forEach(function(line, index){
          var baseline = top + 14 + index * lineH;
          doc.setFont(FACE, 'normal');
          doc.setFontSize(body);
          doc.text(line, textX, baseline);
          if (sup && index === lines.length - 1) {
            var end = textX + doc.getTextWidth(line) + 1;
            doc.setFont(FACE, 'normal');
            doc.setFontSize(8);
            doc.text(sup, end, baseline - 6);
          }
        });
        y = top + Math.max(imgH, lines.length * lineH) + 14;
      }
    });
    if (notes.length) {
      if (y > margin && y + 8 + 16 * lead + 6 + 12 * lead > floor) newPage();
      y += 8;
      write('Notes', 16, FACE, 'bold', inner, margin, [42, 33, 28]);
      y += 6;
      notes.forEach(function(note, index){
        write((index + 1) + '.  ' + note, 12, FACE, 'normal', inner, margin, [81, 70, 62]);
        y += 3;
      });
    }
    var closeText = window.AIPA_CLOSE ? window.AIPA_CLOSE.line(guide) : '';
    if (closeText) {
      var frame = 4;
      var padX = 14;
      var padY = 12;
      var lineH = body * lead;
      var textW = inner - frame * 2 - padX * 2;
      var closeLines = textLines(closeText, body, FACE, 'normal', textW);
      var boxH = frame * 2 + padY + 10 + Math.max(0, closeLines.length - 1) * lineH + 10;
      if (y > margin && y + 18 + boxH + 52 > floor) newPage();
      y += 18;
      var top = y;
      doc.setFillColor(252, 249, 243);
      doc.setDrawColor(205, 191, 168);
      doc.setLineWidth(0.7);
      doc.rect(margin, top, inner, boxH, 'FD');
      doc.rect(margin + frame, top + frame, inner - frame * 2, boxH - frame * 2);
      doc.setFont(FACE, 'normal');
      doc.setFontSize(body);
      doc.setTextColor(42, 33, 28);
      var textY = top + frame + padY + 10;
      closeLines.forEach(function(line){
        doc.text(line, margin + frame + padX, textY);
        textY += lineH;
      });
      y = top + boxH;
    }
    y += 16;
    room(36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(81, 70, 62);
    var legal = doc.splitTextToSize('General education, not medical, legal, or financial advice. For a question about a specific health condition, talk with a doctor or occupational therapist.', inner);
    doc.text(legal, margin, y);
    var total = doc.getNumberOfPages();
    for (var page = 1; page <= total; page++) {
      doc.setPage(page);
      doc.setDrawColor(205, 191, 168);
      doc.setLineWidth(0.6);
      doc.line(margin, footTop - 10, margin + inner, footTop - 10);
      if (qr) {
        try { doc.addImage(qr, 'PNG', margin, footTop, qrSize, qrSize); } catch (err) {}
      }
      var mid = footTop + qrSize / 2 + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(42, 33, 28);
      var phoneX = margin + qrSize + 12;
      doc.text('833-AIPA-HUB', phoneX, mid);
      var urlX = phoneX + doc.getTextWidth('833-AIPA-HUB') + 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(81, 70, 62);
      doc.text('goaipa.com/ask-anything', urlX, mid);
      var label = page + ' of ' + total;
      doc.text(label, margin + inner - doc.getTextWidth(label), mid);
    }
    var uri = doc.output('datauristring');
    var comma = uri.indexOf(',');
    return comma === -1 ? uri : uri.slice(comma + 1);
  }
  window.AIPA_HANDOUT = { build: build, notesFor: notesFor, titleCard: titleCard, ready: ready };
})();
