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
    .gini-head{background:var(--gini-primary,#215C73);color:#fff;padding:12px 14px;font:800 16px/1 system-ui;position:relative}
    .gini-close{position:absolute;top:8px;right:10px;background:#215C73;border:none;color:#fff;font:700 18px/1 system-ui;cursor:pointer}
    .gini-body{padding:12px;height:420px;display:flex;flex-direction:column}
    .gini-msgs{flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:10px}
    .gini-msg{max-width:85%;padding:10px 12px;border-radius:12px;font:14px/1.4 system-ui}
    .gini-user{align-self:flex-end;background:#f1fafb;border:1px solid #d7eef0}
    .gini-bot{align-self:flex-start;background:#f7f9fb;border:1px solid #e7edf2}
    .gini-foot{display:flex;gap:8px;margin-top:10px}
    .gini-input{flex:1;border:1px solid #d8dee5;border-radius:10px;padding:10px;font:14px/1.2 system-ui}
    .gini-send{background:var(--gini-accent,#215C73);border:none;border-radius:10px;padding:10px 12px;font:700 14px/1 system-ui;color:#001;cursor:pointer}
    .gini-small{font:12px/1.2 system-ui;color:#555}
  `);

  // ---- JSON loader only ----
  async function fetchJSON(url){
    const r = await fetch(url, { mode:'cors', cache:'no-store' });
    if (!r.ok) throw new Error('KB JSON HTTP '+r.status);
    return r.json();
  }

  // ---- robust matcher (normalization + aliases + scoring) ----
  const DEFAULT_CONF_THRESHOLD = 0.28; // tune 0.25–0.35

  const norm = s => (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const tokens = s => new Set(norm(s).split(' ').filter(Boolean));

  function jaccard(aSet, bSet){
    if (!aSet.size || !bSet.size) return 0;
    let inter = 0;
    for (const t of aSet) if (bSet.has(t)) inter++;
    return inter / (aSet.size + bSet.size - inter);
  }

  function scoreAgainstItem(qTokens, item){
    let best = jaccard(qTokens, tokens(item.question || ""));
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    for (const a of aliases){
      const s = jaccard(qTokens, tokens(a));
      if (s > best) best = s;
    }
    return best;
  }

  function findKbAnswer(q, items, threshold){
    const qTokens = tokens(q);
    let best = { score: 0, item: null };
    for (const it of items){
      const s = scoreAgainstItem(qTokens, it);
      if (s > best.score) best = { score: s, item: it };
    }

    // Optional lightweight fallback (substring) only if close but just under threshold
    if ((!best.item || best.score < threshold) && items.length){
      const qn = norm(q);
      const hit = items.find(it => qn.includes(norm(it.question || "")));
      if (hit) return { item: hit, score: best.score };
    }

    return (best.item && best.score >= threshold) ? best : null;
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

      // ---- KB state ----
      let kbItems = [];  // always an array of entries
      let kbMeta  = {};  // optional { source, generated }
      let ready=false, loadErr=null;

      async function loadKB(){
        console.time('kb-load');
        try{
          let raw;
          if (Array.isArray(config.kbData) && config.kbData.length){
            raw = config.kbData;
            log(`inline KB provided (${raw.length})`);
          } else if (config.kbUrl){
            raw = await fetchJSON(config.kbUrl);
            log(`fetched KB from ${config.kbUrl}`);
          } else {
            throw new Error('No kbUrl / kbData provided (JSON-only build)');
          }

          // Support both shapes:
          // 1) legacy: [ {id,question,aliases,answer,...}, ... ]
          // 2) modern: { generated, source, items: [ ... ] }
          if (Array.isArray(raw)) {
            kbItems = raw;
            kbMeta = { source: 'legacy-array' };
          } else if (raw && Array.isArray(raw.items)) {
            kbItems = raw.items;
            kbMeta = { source: raw.source || 'kb', generated: raw.generated || '' };
          } else {
            throw new Error('KB JSON shape not recognized (expect array or {items:[]})');
          }

          // Filter drafts + normalize aliases field to array
          kbItems = kbItems
            .filter(r => String(r.status||'').toLowerCase() !== 'draft')
            .map(r => ({ ...r, aliases: Array.isArray(r.aliases) ? r.aliases : [] }));

          ready=true; loadErr=null;
          log(`KB ready: items=${kbItems.length}`, kbMeta);
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

        say(`<div>${config.welcomeMessage||
