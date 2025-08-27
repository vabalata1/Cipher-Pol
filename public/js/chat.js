(function initChat(){
  if (typeof io === 'undefined') { return setTimeout(initChat, 100); }
  const root = document.getElementById('chat-root');
  if (!root) return;
  const code = root.getAttribute('data-code');
  const socket = io({ auth: { code } });
  const list = document.getElementById('messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const online = document.getElementById('online-users');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;
    socket.emit('chat:message', { content });
    input.value = '';
  });
  socket.on('chat:new', (msg) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${msg.code}</strong>: ${msg.content}`;
    list.insertBefore(li, list.firstChild);
  });
  socket.on('presence:update', (payload) => {
    if (!online) return;
    const users = (payload && payload.users) || [];
    online.innerHTML = '';
    users.forEach(u => {
      const li = document.createElement('li');
      const me = (u === code);
      li.textContent = u + (me ? ' (moi)' : '');
      li.style.color = me ? '#9fe29f' : '#d6d9de';
      online.appendChild(li);
    });
  });
})();


