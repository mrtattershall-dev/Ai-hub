function addMsg(role, text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `
    <div class="msg-avatar ${role}">${role === 'ai' ? '🤖' : '👤'}</div>
    <div class="msg-bubble ${role}">${text}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}