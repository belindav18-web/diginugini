// Simple Diginu Bot Widget v1 - loads FAQ responses from Google Sheet
(function () {
  window.MySiteBot = {
    init: function (config) {
      const theme = config.theme || {};
      const sheetUrl = config.sheetCsvUrl;
      const handoffEmail = config.handoff?.email || '';

      // Create button
      const btn = document.createElement('button');
      btn.textContent = "Chat • Gini";
      btn.style.position = "fixed";
      btn.style.bottom = "20px";
      btn.style.right = "20px";
      btn.style.background = theme.primary || "#215C73";
      btn.style.color = "#fff";
      btn.style.border = "none";
      btn.style.padding = "12px 16px";
      btn.style.borderRadius = "50px";
      btn.style.cursor = "pointer";
      btn.style.zIndex = 99999;
      document.body.appendChild(btn);

      // Fetch knowledge base CSV
      async function fetchKB() {
        const res = await fetch(sheetUrl);
        return await res.text();
      }

      btn.onclick = async function () {
        alert("✅ Gini bot connected!\nWe’re loading your knowledge base now...");
      };

      fetchKB()
        .then(() => console.log("✅ Google Sheet connected"))
        .catch(() => console.error("❌ Could not load Google Sheet"));
    }
  };
})();
