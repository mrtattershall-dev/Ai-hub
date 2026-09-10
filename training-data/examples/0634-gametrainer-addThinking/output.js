function addThinking() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg'; div.id = 'thinkingMsg';
  div.innerHTML = `<div class="msg-avatar ai">🤖</div>
    <div class="msg-bubble ai"><div class="thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}