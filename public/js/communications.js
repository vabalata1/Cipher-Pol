(function(){
  const forms = document.querySelectorAll('.dm-form');
  const boxes = document.querySelectorAll('.messages[data-peer]');

  async function loadBox(peer) {
    try {
      const url = `/communications/messages?peer=${encodeURIComponent(peer)}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const box = document.querySelector(`.messages[data-peer="${peer}"]`);
      if (!box) return;
      box.innerHTML = '';
      const msgs = (data.messages || []);
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const div = document.createElement('div');
        const mine = (m.fromCode && window.currentUserCode && m.fromCode === window.currentUserCode);
        div.className = `dm-row${mine ? ' mine' : ''}`;
        if (mine) {
          div.innerHTML = `<span class=\"dm-content\">${escapeHtml(m.content)}</span><span class=\"dm-meta\">[${m.fromCode}]</span>`;
        } else {
          div.innerHTML = `<span class=\"dm-meta\">[${m.fromCode}]</span><span class=\"dm-content\">${escapeHtml(m.content)}</span>`;
        }
        box.appendChild(div);
      }
      box.scrollTop = box.scrollHeight;
    } catch {}
  }

  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  async function sendMessage(peer, content, csrfToken) {
    const res = await fetch('/communications/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ toCode: peer, content, _csrf: csrfToken })
    });
    return res.ok;
  }

  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const peer = form.getAttribute('data-peer');
      const input = form.querySelector('textarea[name="content"]');
      const tokenEl = form.querySelector('input[name="_csrf"]');
      const token = tokenEl ? tokenEl.value : undefined;
      const text = (input.value || '').trim();
      if (!text) return;
      const ok = await sendMessage(peer, text, token);
      if (ok) {
        input.value = '';
        await loadBox(peer);
      }
    });
  });

  // initial load
  boxes.forEach(b => loadBox(b.getAttribute('data-peer')));

  // periodic refresh
  setInterval(() => {
    boxes.forEach(b => loadBox(b.getAttribute('data-peer')));
  }, 4000);

  // attach confirm handler for clear-all form under CSP
  const clearForm = document.querySelector('form.dm-clear-all');
  if (clearForm) {
    clearForm.addEventListener('submit', (e) => {
      if (!confirm('Effacer toutes les discussions ?')) {
        e.preventDefault();
      }
    });
  }
})();
