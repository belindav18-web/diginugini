/* Gini Widget v2 — JSON-first loader (no Google latency) */
(function(){
  function css(str){ const s=document.createElement('style'); s.textContent=str; document.head.appendChild(s); }
  css(`
    .gini-launcher{position:fixed;bottom:20px;right:20px;z-index:2147483000;background:var(--gini-primary,#215C73);
      color:#fff;border:none;border-radius:999px;padding:12px 16px;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;font:600 14px/1 system-ui}
    .gini-panel{position:fixed;bottom:84px;right:20px;z-index:2147483001;width:380px;max-width:95vw;background:#fff;border-radius:16px;
      overflow:hidden;box-shadow:0 16px 44px rgba(0,0,0,.22);border:2px solid var(--gini-accent,#00B0B9)}
    .gini-head{background:var(--gini-primary,#215C73);color:#fff;padding:12px 14px;font:600 14px/1 system-ui;position:relative}
    .gini-close{position:absolute;top:8px;right:10px;background:transparent;border:none;color:#fff;font:700 18px/1 system-ui;cursor:pointer}
    .gini-body{background:#fff;padding:12px;height:420px;display:flex;flex-direction:column}
    .gini-msgs{flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:10px}
    .gini-msg{max-width:85%;padding:10px 12px;border-radius:12px;font:14px/1.4 system-ui}
    .gini-user{align-self:flex-end;background:#f1fafb;border:1px solid #d7eef0}
    .gini-bot{align-self:flex-start;background:#f7f9fb;border:1px solid #e7edf2}
    .gini-foot{display:flex;gap:8px;margin-top:10px}
    .gini-input{flex:1 1 auto;border:1px solid #d8dee5;border-radius:10px;padding:10px;font:14px/1.2 system-ui}
    .gini-send{background:var(--gini-accent,#00B0B9);border:none;border-radius:10px;padding:10px 12px;font:700 14px/1 system-ui;color:#001;cursor:pointer}
    .gini-small{font:12px/1.2 system-ui;color:#555}
  `);

  // very small CSV helper (kept in case you later pass sheetCsvUrl)
  function parseCSV(text){
    const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
    const header = lines[0].split(',').map(h=>h.trim());
    return lines.slice(1).map(line=>{
      const cells = line.split(',').map(c=>c.trim());
      const row = {}; header.forEach((h,i)=> row[h] = (cells[i]||'').trim());
      return row;
    });
  }

  async function fetchJSON(url){
    const r = await fetch(url, {mode:"cors", cache:"no-store"});
    if(!r.ok) throw new Error("KB JSON HTTP "+r.status);
    return await r.json();
  }
  async function fetchCSV(url){
    const r = await fetch(url, {mode:"cors", cache:"no-store"});
    if(!r.ok) throw new Error("CSV HTTP "+r.status);
    const txt = await r.text(); return parseCSV(txt);
  }

  function score(q, kbQ){
    const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2);
    const a = new Set(norm(q)), b = norm(kbQ); let hits=0;
    for(const w of b) if(a.has(w)) hits++;
    return hits / Math.max(3, b.length);
  }

  window.MySiteBot = {
    init: function(config){
      // theme
      document.documentElement.style.setProperty('--gini-primary', (config.theme?.primary)||'#215C73');
      document.documentElement.style.setProperty('--gini-accent',  (config.theme?.accents?.[0])||'#00B0B9');

      // UI
      const launcher = document.createElement('button');
      launcher.className = 'gini-launcher';
      launcher.textContent = 'Chat • Gini';
      document.body.appendChild(launcher);

      let panel=null, msgs=null, input=null;
      function say(html, who='bot'){
        const div=document.createElement('div');
        div.className = `gini-msg gini-${who}`;
        div.innerHTML = html;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
      }

      let kb=[], ready=false;

      async function loadKB(){
        console.time('kb-load');
        try {
          if (config.kbData && Array.isArray(config.kbData) && config.kbData.length){
            kb = config.kbData;
            console.log(`Gini: inline KB ready (${kb.length}) ✅`);
          } else if (config.kbUrl){
            kb = await fetchJSON(config.kbUrl);
            console.log(`Gini: loaded JSON KB (${kb.length}) ✅`);
          } else if (config.sheetCsvUrl){
            kb = await fetchCSV(config.sheetCsvUrl);
            console.log(`Gini: loaded CSV KB (${kb.length}) ✅`);
          } else {
            throw new Error('No kbUrl / kbData / sheetCsvUrl provided');
          }
          // filter out drafts if present
          kb = kb.filter(r => String(r.status||'').toLowerCase() !== 'draft');
          ready = true;
        } catch (e){
          console.error('Gini KB error ❌', e);
          throw e;
        } finally {
          console.timeEnd('kb-load');
        }
      }

      // start KB load immediately
      const load = loadKB();

      launcher.onclick = async ()=>{
        if(panel){ panel.remove(); panel=null; return; }
        panel = document.createElement('div');
        panel.className = 'gini-panel';
        panel.innerHTML = `
          <div class="gini-head">Gini <button class="gini-close" aria-label="Close">×</button></div>
          <div class="gini-body">
            <div class="gini-msgs"></div>
            <div class="gini-foot">
              <input class="gini-input" placeholder="Type your question…" />
              <button class="gini-send">Send</button>
            </div>
          </div>`;
        document.body.appendChild(panel);
        panel.querySelector('.gini-close').onclick = ()=>{ panel.remove(); panel=null; };
        msgs = panel.querySelector('.gini-msgs');
        input = panel.querySelector('.gini-input');
        const sendBtn = panel.querySelector('.gini-send');

        say(`<div>${config.welcomeMessage||"Hi! How can I help you today?"}</div>
             <div class="gini-small" style="margin-top:6px">Loading knowledge base…</div>`);
        try {
          await load; // wait for KB load once
          say(`<div class="gini-small">Knowledge base ready (${kb.length}) ✅</div>`);
        } catch (e){
          say(`<div>Couldn't load the knowledge base. Please try again or email <b>${config.handoff?.email||'wecare@diginu.com'}</b>.</div>
               <div class="gini-small">${String(e.message||e)}</div>`);
        }

        function send(){
          const q=(input.value||'').trim(); if(!q) return;
          say(q,'user'); input.value='';
          if(!ready || !kb.length){
            say(`<div>Still preparing the KB. If this persists, email <b>${config.handoff?.email||'wecare@diginu.com'}</b>.</div>`); 
            return;
          }
          // simple match on "question" field
          let best=null, bestScore=0;
          for(const row of kb){
            const s=score(q, row.question||'');
            if(s>bestScore){ bestScore=s; best=row; }
          }
          if(best && best.answer && bestScore>=0.34){
            let html = best.answer;
            if(best.source_url) html += `<div class="gini-small">Source: <a href="${best.source_url}" target="_blank" rel="noopener">link</a></div>`;
            say(html);
          } else {
            say(`<div>I'm not fully sure yet. Want me to email our team at <b>${config.handoff?.email||'wecare@diginu.com'}</b>?</div>`);
          }
        }
        input.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });
        sendBtn.onclick = send;
      };

      console.log('Gini: widget v2 mounted ✅');
    }
  };
})();
