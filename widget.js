async function fetchJSON(url){
  const r = await fetch(url, {mode:"cors", cache:"no-store"});
  if(!r.ok) throw new Error("KB JSON HTTP "+r.status);
  return await r.json();
}
async function fetchCSV(url){
  const r = await fetch(url, {mode:"cors", cache:"no-store"});
  if(!r.ok) throw new Error("CSV HTTP "+r.status);
  const txt = await r.text();
  return parseCSV(txt);
}

async function loadKB(config){
  if (config.kbData && Array.isArray(config.kbData) && config.kbData.length){
    console.log(`Gini: inline KB ready (${config.kbData.length}) ✅`);
    return config.kbData;
  }
  if (config.kbUrl){                        // ← JSON FIRST
    const data = await fetchJSON(config.kbUrl);
    console.log(`Gini: loaded JSON KB (${data.length}) ✅`);
    return data;
  }
  if (config.sheetCsvUrl){                  // ← fallback ONLY if you add it
    const data = await fetchCSV(config.sheetCsvUrl);
    console.log(`Gini: loaded CSV KB (${data.length}) ✅`);
    return data;
  }
  throw new Error("No kbUrl / kbData / sheetCsvUrl provided");
}

// during init:
let kb = [], ready = false;
loadKB(config)
  .then(rows => {
    kb = rows.filter(r => String(r.status||'').toLowerCase() !== 'draft');
    ready = true;
    console.log(`Gini: KB ready (${kb.length}) ✅`);
  })
  .catch(err => console.error("Gini: KB load error ❌", err));
