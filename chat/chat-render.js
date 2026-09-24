(function (root) {
  var INLINE = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|\[([^\]\n]{1,300})\]\(([^()\s]+)\)|(https:\/\/[^\s<>"'`]+)/g;
  var LIST = /^\s{0,3}(?:[-*•]|\d{1,3}[.)])\s+(.*)$/;
  var ORDERED = /^\s{0,3}\d{1,3}[.)]\s+/;
  var FENCE = /^\s{0,3}```/;
  var HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;

  function el(tag, cls) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }

  function link(parent, label, href) {
    var url = null;
    try { url = new URL(href); } catch (e) {}
    if (!url || url.protocol !== 'https:') { parent.appendChild(document.createTextNode(label)); return; }
    var a = el('a');
    a.href = url.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    parent.appendChild(a);
  }

  function inline(parent, text) {
    var last = 0, m;
    INLINE.lastIndex = 0;
    while ((m = INLINE.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1] != null) {
        var code = el('code');
        code.textContent = m[1];
        parent.appendChild(code);
      } else if (m[2] != null) {
        var strong = el('strong');
        strong.textContent = m[2];
        parent.appendChild(strong);
      } else if (m[3] != null) {
        link(parent, m[3], m[4]);
      } else {
        var raw = m[5];
        var tail = (raw.match(/[.,;:!?)\]]+$/) || [''])[0];
        var bare = tail ? raw.slice(0, raw.length - tail.length) : raw;
        link(parent, bare, bare);
        if (tail) parent.appendChild(document.createTextNode(tail));
      }
      last = INLINE.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function paragraph(frag, lines) {
    if (!lines.length) return;
    var p = el('p');
    lines.forEach(function (line, i) {
      if (i) p.appendChild(el('br'));
      inline(p, line);
    });
    frag.appendChild(p);
  }

  function render(src) {
    var frag = document.createDocumentFragment();
    var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    var para = [], list = null, listOrdered = false;
    var i = 0;
    function flush() {
      paragraph(frag, para);
      para = [];
      if (list) { frag.appendChild(list); list = null; }
    }
    while (i < lines.length) {
      var line = lines[i];
      if (FENCE.test(line)) {
        flush();
        var body = [];
        i++;
        while (i < lines.length && !FENCE.test(lines[i])) { body.push(lines[i]); i++; }
        var pre = el('pre');
        var code = el('code');
        code.textContent = body.join('\n');
        pre.appendChild(code);
        frag.appendChild(pre);
        i++;
        continue;
      }
      if (!line.trim()) { flush(); i++; continue; }
      var item = LIST.exec(line);
      if (item) {
        paragraph(frag, para);
        para = [];
        var ordered = ORDERED.test(line);
        if (!list || listOrdered !== ordered) {
          if (list) frag.appendChild(list);
          list = el(ordered ? 'ol' : 'ul');
          listOrdered = ordered;
        }
        var li = el('li');
        inline(li, item[1]);
        list.appendChild(li);
        i++;
        continue;
      }
      if (list && /^\s{2,}\S/.test(line)) {
        var lastLi = list.lastChild;
        lastLi.appendChild(document.createTextNode(' '));
        inline(lastLi, line.trim());
        i++;
        continue;
      }
      if (list) { frag.appendChild(list); list = null; }
      var head = HEADING.exec(line);
      if (head) {
        paragraph(frag, para);
        para = [];
        var hp = el('p');
        var hs = el('strong');
        hs.textContent = head[1].replace(/\*\*/g, '');
        hp.appendChild(hs);
        frag.appendChild(hp);
        i++;
        continue;
      }
      para.push(line);
      i++;
    }
    flush();
    return frag;
  }

  root.NSP_CHAT_RENDER = Object.freeze({ render: render });
})(typeof self !== 'undefined' ? self : this);
