(function(){
  var blocks = [];
  var host = null;
  var crop = null;

  function uid(){ return Math.random().toString(36).slice(2, 9); }
  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function blank(type){
    if (type === 'headline') return {id:uid(), type:type, text:''};
    if (type === 'bullets') return {id:uid(), type:type, items:[{text:'', footnote:''}]};
    if (type === 'photo-left' || type === 'photo-right') return {id:uid(), type:type, text:'', footnote:'', image:''};
    return {id:uid(), type:'paragraph', text:'', footnote:''};
  }
  function parse(value){
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) { return []; }
  }
  function fromArticle(article){
    var stored = parse(article && article.blocks);
    if (stored.length) return stored.map(normalize);
    var body = String(article && article.body || '').trim();
    if (!body) return [];
    return body.split(/\n\s*\n/).map(function(part){
      return {id:uid(), type:'paragraph', text:part.trim(), footnote:''};
    }).filter(function(block){ return block.text; });
  }
  function normalize(block){
    var next = blank(block.type || 'paragraph');
    next.id = block.id || next.id;
    next.text = block.text || '';
    next.footnote = block.footnote || '';
    next.image = block.image || '';
    if (next.type === 'bullets') {
      next.items = (block.items && block.items.length ? block.items : [{text:'', footnote:''}]).map(function(item){
        return {text:item.text || '', footnote:item.footnote || ''};
      });
    }
    return next;
  }
  function plain(list){
    return (list || blocks).map(function(block){
      if (block.type === 'bullets') {
        return (block.items || []).map(function(item){
          return [item.text, item.footnote].filter(Boolean).join(' ');
        }).filter(Boolean).join('\n');
      }
      return [block.text, block.footnote].filter(Boolean).join('\n');
    }).filter(Boolean).join('\n\n');
  }
  function label(type){
    if (type === 'headline') return 'Headline';
    if (type === 'photo-left') return 'Paragraph, photo on the left';
    if (type === 'photo-right') return 'Paragraph, photo on the right';
    if (type === 'bullets') return 'Bulleted list';
    return 'Paragraph';
  }
  function field(block, name, value, tag, placeholder){
    var control = tag === 'textarea'
      ? '<textarea data-field="' + name + '" rows="4" placeholder="' + esc(placeholder || '') + '">' + esc(value || '') + '</textarea>'
      : '<input data-field="' + name + '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '">';
    return '<label>' + esc(name === 'footnote' ? 'Footnote' : 'Text') + control + '</label>';
  }
  function card(block, index){
    var body = '';
    if (block.type === 'bullets') {
      body = (block.items || []).map(function(item, itemIndex){
        return '<div class="bullet-row" data-item="' + itemIndex + '">' +
          '<label>Bullet<input data-field="text" value="' + esc(item.text) + '"></label>' +
          '<label>Footnote<input data-field="footnote" value="' + esc(item.footnote) + '" placeholder="Optional. Collected at the bottom."></label>' +
          '<button class="btn quiet" type="button" data-do="remove-item">Remove</button></div>';
      }).join('') + '<button class="btn quiet" type="button" data-do="add-item">Add a bullet</button>';
    } else if (block.type === 'headline') {
      body = '<label>Headline<input data-field="text" value="' + esc(block.text) + '"></label>';
    } else {
      body = '<label>Paragraph<textarea data-field="text" rows="4">' + esc(block.text) + '</textarea></label>' +
        '<label>Footnote<input data-field="footnote" value="' + esc(block.footnote) + '" placeholder="Optional. Collected at the bottom."></label>';
      if (block.type === 'photo-left' || block.type === 'photo-right') {
        body += '<div class="photo-pick">' +
          (block.image ? '<img src="' + esc(block.image) + '" alt="">' : '<p class="note">No photo yet.</p>') +
          '<button class="btn quiet" type="button" data-do="photo">' + (block.image ? 'Change photo' : 'Upload photo') + '</button></div>';
      }
    }
    return '<article class="guide-block" data-block="' + index + '"><header><h3>' + esc(label(block.type)) + '</h3><div>' +
      '<button class="btn quiet" type="button" data-do="up"' + (index === 0 ? ' disabled' : '') + '>Up</button>' +
      '<button class="btn quiet" type="button" data-do="down"' + (index === blocks.length - 1 ? ' disabled' : '') + '>Down</button>' +
      '<button class="btn quiet" type="button" data-do="remove">Remove</button></div></header>' + body + '</article>';
  }
  function paint(){
    if (!host) return;
    host.innerHTML = blocks.length
      ? blocks.map(card).join('')
      : '<p class="note">Add a headline, a paragraph, a photo, or a list. Footnotes on a paragraph or a bullet collect at the bottom of the handout.</p>';
  }
  function read(){ return blocks.map(normalize); }
  function mount(node, initial){
    host = node;
    blocks = (initial || []).map(normalize);
    paint();
  }
  function indexOf(node){
    var card = node.closest('[data-block]');
    return card ? Number(card.dataset.block) : -1;
  }
  function openCrop(file, index){
    var dialog = document.getElementById('crop-dialog');
    var canvas = document.getElementById('crop-canvas');
    var zoom = document.getElementById('crop-zoom');
    if (!dialog || !canvas || !file) return;
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function(){
      crop = {img:img, url:url, index:index, zoom:1, panX:0, panY:0, drag:null};
      zoom.value = '1';
      dialog.hidden = false;
      drawCrop();
    };
    img.src = url;
  }
  function drawCrop(){
    var canvas = document.getElementById('crop-canvas');
    if (!canvas || !crop) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.fillStyle = '#E7DCC7';
    ctx.fillRect(0, 0, w, h);
    var cover = Math.max(w / crop.img.width, h / crop.img.height) * crop.zoom;
    var dw = crop.img.width * cover;
    var dh = crop.img.height * cover;
    ctx.drawImage(crop.img, (w - dw) / 2 + crop.panX, (h - dh) / 2 + crop.panY, dw, dh);
  }
  function applyCrop(){
    var source = document.getElementById('crop-canvas');
    if (!source || !crop) return;
    var out = document.createElement('canvas');
    out.width = 900;
    out.height = 1200;
    var ctx = out.getContext('2d');
    var scale = 900 / source.width;
    var cover = Math.max(source.width / crop.img.width, source.height / crop.img.height) * crop.zoom * scale;
    var dw = crop.img.width * cover;
    var dh = crop.img.height * cover;
    ctx.drawImage(crop.img, (900 - dw) / 2 + crop.panX * scale, (1200 - dh) / 2 + crop.panY * scale, dw, dh);
    blocks[crop.index].image = out.toDataURL('image/jpeg', 0.85);
    closeCrop();
    paint();
  }
  function closeCrop(){
    var dialog = document.getElementById('crop-dialog');
    if (crop && crop.url) URL.revokeObjectURL(crop.url);
    crop = null;
    if (dialog) dialog.hidden = true;
  }
  document.addEventListener('click', function(event){
    var add = event.target.closest('[data-add]');
    if (add && host) {
      blocks.push(blank(add.dataset.add));
      paint();
      return;
    }
    if (!host || !host.contains(event.target)) {
      var apply = event.target.closest('#crop-apply');
      var cancel = event.target.closest('#crop-cancel');
      if (apply) applyCrop();
      if (cancel) closeCrop();
      return;
    }
    var button = event.target.closest('[data-do]');
    if (!button) return;
    var index = indexOf(button);
    if (index < 0) return;
    var action = button.dataset.do;
    if (action === 'remove') blocks.splice(index, 1);
    else if (action === 'up' && index > 0) blocks.splice(index - 1, 0, blocks.splice(index, 1)[0]);
    else if (action === 'down' && index < blocks.length - 1) blocks.splice(index + 1, 0, blocks.splice(index, 1)[0]);
    else if (action === 'add-item') blocks[index].items.push({text:'', footnote:''});
    else if (action === 'remove-item') {
      var row = button.closest('[data-item]');
      var itemIndex = row ? Number(row.dataset.item) : -1;
      if (itemIndex >= 0) blocks[index].items.splice(itemIndex, 1);
      if (!blocks[index].items.length) blocks[index].items.push({text:'', footnote:''});
    } else if (action === 'photo') {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', function(){
        if (input.files && input.files[0]) openCrop(input.files[0], index);
      });
      input.click();
      return;
    } else return;
    paint();
  });
  document.addEventListener('input', function(event){
    if (host && host.contains(event.target) && event.target.dataset.field) {
      var index = indexOf(event.target);
      if (index < 0) return;
      var item = event.target.closest('[data-item]');
      if (item) blocks[index].items[Number(item.dataset.item)][event.target.dataset.field] = event.target.value;
      else blocks[index][event.target.dataset.field] = event.target.value;
      return;
    }
    if (event.target.id === 'crop-zoom' && crop) {
      crop.zoom = Number(event.target.value) || 1;
      drawCrop();
    }
  });
  document.addEventListener('pointerdown', function(event){
    if (event.target.id !== 'crop-canvas' || !crop) return;
    crop.drag = {x:event.clientX, y:event.clientY, panX:crop.panX, panY:crop.panY};
    event.target.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove', function(event){
    if (!crop || !crop.drag) return;
    crop.panX = crop.drag.panX + (event.clientX - crop.drag.x);
    crop.panY = crop.drag.panY + (event.clientY - crop.drag.y);
    drawCrop();
  });
  document.addEventListener('pointerup', function(){ if (crop) crop.drag = null; });

  window.AIPA_GUIDE = { mount:mount, read:read, plain:plain, fromArticle:fromArticle };
})();
