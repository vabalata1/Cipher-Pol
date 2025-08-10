(function initChat(){
  if (typeof io === 'undefined') { return setTimeout(initChat, 100); }
  const root = document.getElementById('chat-root');
  if (!root) return;
  const code = root.getAttribute('data-code');
  const socket = io({ auth: { code } });
  const list = document.getElementById('messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
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
})();


