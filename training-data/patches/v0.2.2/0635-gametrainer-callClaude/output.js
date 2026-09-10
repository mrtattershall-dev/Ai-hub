async function callClaude() {
  document.getElementById('sendBtn').disabled = true;
  addThinking();
  const lesson = LESSONS[app.currentLesson];
  const system = `You are an expert game development tutor embedded in an interactive HTML5 game trainer. The student is currently on the "${lesson.title}" module, learning about: ${lesson.concept.desc}

Your role: teach other AI models (and humans) how to build games using correct patterns. Keep responses SHORT (2-4 sentences max). Focus on: game loops, state management, input decoupling, canvas rendering, simple physics, collision detection. When giving code, give tiny runnable snippets. Be encouraging and specific.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system,
        messages: chatHistory
      })
    });
    const data = await res.json();
    const reply = data.content?.map(b => b.text||'').join('') || 'Sorry, I couldn\'t respond right now.';
    removeThinking();
    addMsg('ai', reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch(e) {
    removeThinking();
    addMsg('ai', 'Connection error — check your network and try again.');
  }
  document.getElementById('sendBtn').disabled = false;
}