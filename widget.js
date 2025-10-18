/* Gini Website Bot — widget.js (JSON-only, with logo in launcher) */
(function(){
  // ---- tiny helpers ----
  function css(t){const s=document.createElement('style');s.textContent=t;document.head.appendChild(s);}
  function el(h){const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild;}
  function log(){console.log('Gini:',...arguments);} function warn(){console.warn('Gini:',...arguments);} function err(){console.error('Gini:',...arguments);}

  // ---- styles ----
  css(`
    .gini-launcher{
      position:fixed;bottom:20px;right:20px;z-index:2147483000;
      background:var(--gini-primary,#215C73);color:#fff;border:none;border-radius:999px;
      padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;
      font:600 14px/1 system-ui;display:flex;align-items:center;gap:10px;
    }
    .gini-launcher:hover{ filter:brightness(1.05) }
    .gini-logo{
      width:22px;height:22px;object-fit:cover;border-radius:999px;
      background:#fff; /* white ring behind logo for contrast */
      padding:2px;border:2px solid var(--gini-accent,#00B0B9);
      box-sizing:content-box;
    }
    .gini-label{ display:inline-block; }
    .gini-panel{
      position:fixed;bottom:84px;right:20px;z-index:2147483001;width:380px;max-width:95vw;
      background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 16px 44px rgba(0,0,0,.22);
      border:2px solid var(--gini-accent,#00B0B9)
    }
    .gini-head{background:var(--gini-primary,#215C73);color:#fff;padding:12px 14px;font:600 14px/1 system-ui;position:relative}
    .gini-close{position:absolute;top:8px;right:10px;background:transparent;border:none;color:#fff;font:700 18px/1 system-ui;cursor:pointer}
    .gini-body{padding:12px;height:420px;display:flex;flex-direction:column}
    .gini-msgs{flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:10px}
    .gini-msg{max-width:85%;padding:10px 12px;border-radius:12px;font:14px/1.4 system-ui}
    .gini-user{align-self:flex-end;background:#f1fafb;border:1px solid #d7eef0}
    .gini-bot{align-self:flex-start;background:#f7f9fb;border:1px solid #e7edf2}
    .gini-foot{display:flex;gap:8px;margin-top:10px}
    .gini-input{flex:1;border:1px solid #d8dee5;border-radius:10px;padding:10px;font:14px/1.2 system-ui}
    .gini-send{background:var(--gini-accent,#00B0B9);border:none;border-radius:10px;padding:10px 12px;font:700 14px/1 system-ui;color:#001;cursor:pointer}
    .gini-small{font:12px/1.2 system-ui;color:#555}
  `);

  // ---- JSON loader only ----
  async function fetchJSON(url){
    const r = await fetch(url, { mode:'cors', cache:'no-store' });
    if (!r.ok) throw new Error('KB JSON HTTP '+r.status);
    return r.json();
  }

  // simple word-overlap matcher
  function score(q,kq){
    const norm=s=>s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2);
    const A=new Set(norm(q)), B=norm(kq); let hits=0; for(const w of B) if(A.has(w)) hits++;
    return hits/Math.max(3,B.length);
  }

  // ---- public API ----
  window.MySiteBot = {
    init: function(config){
      // theme
      document.documentElement.style.setProperty('--gini-primary', (config.theme?.primary)||'#215C73');
      document.documentElement.style.setProperty('--gini-accent',  (config.theme?.accents?.[0])||'#00B0B9');

      // launcher (logo + label "Gini")
      const launcher=document.createElement('button');
      launcher.className='gini-launcher';
      launcher.setAttribute('aria-label','Open Gini chat');

      // logo URL: use config.logoUrl if provided, else default to your GitHub path
      const defaultLogo = 'https://cdn.jsdelivr.net/gh/belindav18-web/diginugini@main/just%20the%20logo.jpeg';
      const logoUrl = config.logoUrl || defaultLogo;

      launcher.innerHTML = `
        <img class="gini-logo" src="${logoUrl}" alt="" />
        <span class="gini-label">Gini</span>
      `;

      // if logo fails, gracefully hide the img and keep text
      launcher.querySelector('.gini-logo').addEventListener('error', function(){
        this.style.display='none';
      });

      document.body.appendChild(launcher);

      let kb=[], ready=false, loadErr=null;

      async function loadKB(){
        console.time('kb-load');
        try{
          if (Array.isArray(config.kbData) && config.kbData.length){
            kb = config.kbData;
            log(`inline KB ready (${kb.length}) ✅`);
          } else if (config.kbUrl){
            kb = await fetchJSON(config.kbUrl);
            log(`loaded JSON KB (${kb.length}) ✅`);
          } else {
            throw new Error('No kbUrl / kbData provided (JSON-only build)');
          }
          kb = kb.filter(r => String(r.status||'').toLowerCase() !== 'draft');
          ready=true; loadErr=null;
        }catch(e){
          loadErr=e; ready=false; err('KB load error ❌', e);
        }finally{
          console.timeEnd('kb-load');
        }
      }
      const load = loadKB();

      launcher.onclick = async ()=>{
        const panel = (function(){
          const p=el(`
            <div class="gini-panel" role="dialog" aria-label="Gini chat">
              <div class="gini-head">Gini <button class="gini-close" aria-label="Close">×</button></div>
              <div class="gini-body">
                <div class="gini-msgs"></div>
                <div class="gini-foot">
                  <input class="gini-input" placeholder="Type your question…" />
                  <button class="gini-send">Send</button>
                </div>
              </div>
            </div>`);
          document.body.appendChild(p);
          p.querySelector('.gini-close').onclick=()=>p.remove();
          return p;
        })();

        const msgs=panel.querySelector('.gini-msgs'), input=panel.querySelector('.gini-input'), sendB=panel.querySelector('.gini-send');
        function say(html,who='bot'){ const d=document.createElement('div'); d.className=`gini-msg gini-${who}`; d.innerHTML=html; msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight; }

        say(`<div>${config.welcomeMessage||'Hi! How can I help you today?'}</div><div class="gini-small" style="margin-top:6px">Loading knowledge base…</div>`);
        await load;
        if(ready){ say(`<div class="gini-small">Knowledge base ready (${kb.length}) ✅</div>`); }
        else { say(`<div>Couldn’t load the knowledge base. Try again or email <b>${config.handoff?.email||'wecare@diginu.com'}</b>.</div><div class="gini-small">${loadErr ? (loadErr.message||String(loadErr)) : 'Unknown error'}</div>`); }

        function send(){
          const q=(input.value||'').trim(); if(!q) return;
          say(q,'user'); input.value='';
          if(!ready || !kb.length){ say(`<div>Still preparing the KB. If this persists, email <b>${config.handoff?.email||'wecare@diginu.com'}</b>.</div>`); return; }
          let best=null, bestScore=0; for(const row of kb){ const s=score(q,row.question||''); if(s>bestScore){ bestScore=s; best=row; } }
          if(best && best.answer && bestScore>=0.34){
            let html=best.answer;
            if(best.source_url) html += `<div class="gini-small">Source: <a href="${best.source_url}" target="_blank" rel="noopener">link</a></div>`;
            say(html);
          } else {
            say(`<div>I'm not fully sure yet. Want me to email our team at <b>${config.handoff?.email||'wecare@diginu.com'}</b>?</div>`);
          }
        }
        input.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });
        sendB.onclick = send;
      };

      log('widget mounted ✅ (JSON-only, logo launcher)');
    }
  };
})();
