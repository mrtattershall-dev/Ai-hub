async function callClaude(){
  document.getElementById('sendBtn').disabled=true; addThinking();
  const l=LESSONS[app.cur];
  const sys=`You are a game dev tutor in an interactive trainer (Vol 2 — Intermediate). The student is on "${l.title}" (${l.concept.title}): ${l.concept.desc}

Teach AI models and humans intermediate game patterns. Responses: 2–4 sentences max. Give tiny runnable snippets when helpful. Topics: sprite animation, particle pools, camera/viewport, A* pathfinding, finite state machines, scene managers. Be specific and encouraging.`;
  try {
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:sys,messages:history})});
    const data=await r.json();
    const reply=data.content?.map(b=>b.text||'').join('')||'No response.';
    rmThinking(); addMsg('ai',reply); history.push({role:'assistant',content:reply});
  } catch(e){ rmThinking(); addMsg('ai','Connection error — try again.'); }
  document.getElementById('sendBtn').disabled=false;
}