// ============================================================================
// NATHAN KIDS — Export de la fiche du jour (côté client, comme le prototype)
// ----------------------------------------------------------------------------
// - CSV (ouvrable dans Excel/LibreOffice) via un Blob téléchargé.
// - PDF via l'impression navigateur (fenêtre dédiée + window.print), qui
//   permet « Enregistrer en PDF ». Approche client conservée (API_SPEC : la
//   génération PDF/Excel reste côté client, rien à faire côté serveur).
// ============================================================================
const NKExport = (() => {
  const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n ?? 0);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const csvCell = (v) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function download(name, mime, content) {
    const blob = new Blob(["﻿" + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // d = objet renvoyé par sales_daily(); showProfit masque le bénéfice au staff.
  function toCSV(d, showProfit) {
    const rows = [];
    rows.push(["NATHAN KIDS — Fiche du jour", d.date]);
    rows.push([]);
    rows.push(["Recette", fmt(d.revenue)]);
    if (showProfit) rows.push(["Bénéfice", fmt(d.profit)]);
    rows.push(["Ventes", d.count]);
    rows.push(["Panier moyen", fmt(d.avgBasket)]);
    rows.push(["Crédits accordés", fmt(d.creditsGiven)]);
    rows.push([]);
    rows.push(["Mode de paiement", "Montant"]);
    (d.byPayment || []).forEach((b) => rows.push([b.method, fmt(b.amount)]));
    rows.push([]);
    rows.push(["Article", "Qté", "Montant"]);
    (d.itemsSold || []).forEach((i) => rows.push([i.name, i.qty, fmt(i.amount)]));
    rows.push([]);
    rows.push(["Heure", "Opération", "Paiement", "Montant"]);
    (d.operations || []).forEach((o) => rows.push([o.time, o.label, o.method, fmt(o.amount)]));
    return rows.map((r) => r.map(csvCell).join(";")).join("\n");
  }

  function csv(d, showProfit) {
    download(`nathan-kids_${d.date}.csv`, "text/csv;charset=utf-8", toCSV(d, showProfit));
  }

  function printPDF(d, showProfit, shopName) {
    const table = (head, body) =>
      `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
    const pay = (d.byPayment || []).map((b) => `<tr><td>${esc(b.method)}</td><td class="r">${fmt(b.amount)}</td></tr>`).join("");
    const items = (d.itemsSold || []).map((i) => `<tr><td>${esc(i.name)}</td><td class="c">${i.qty}</td><td class="r">${fmt(i.amount)}</td></tr>`).join("");
    const ops = (d.operations || []).map((o) => `<tr><td>${esc(o.time)}</td><td>${esc(o.label)}</td><td>${esc(o.method)}</td><td class="r">${fmt(o.amount)}</td></tr>`).join("");
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche du jour ${esc(d.date)}</title>
      <style>
        body{font-family:system-ui,Arial,sans-serif;color:#1e2330;padding:24px;max-width:720px;margin:auto}
        h1{color:#e8582c;margin:0} .date{color:#666;margin:2px 0 18px}
        .kpis{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:18px}
        .kpi{border:1px solid #e6e8ec;border-radius:10px;padding:10px 14px;min-width:130px}
        .kpi b{display:block;font-size:20px} .kpi span{color:#666;font-size:12px}
        table{width:100%;border-collapse:collapse;margin:8px 0 18px}
        th,td{border-bottom:1px solid #e6e8ec;padding:6px 8px;text-align:left;font-size:13px}
        th{background:#faf7f5} .r{text-align:right} .c{text-align:center}
        @media print{button{display:none}}
      </style></head><body>
      <h1>${esc(shopName || "NATHAN KIDS")}</h1>
      <div class="date">Fiche du jour — ${esc(d.date)}</div>
      <div class="kpis">
        <div class="kpi"><b>${fmt(d.revenue)} F</b><span>Recette</span></div>
        ${showProfit ? `<div class="kpi"><b>${fmt(d.profit)} F</b><span>Bénéfice</span></div>` : ""}
        <div class="kpi"><b>${d.count}</b><span>Ventes</span></div>
        <div class="kpi"><b>${fmt(d.avgBasket)} F</b><span>Panier moyen</span></div>
        <div class="kpi"><b>${fmt(d.creditsGiven)} F</b><span>Crédits</span></div>
      </div>
      <h3>Par mode de paiement</h3>${table(["Mode", "Montant"], pay || '<tr><td colspan="2">—</td></tr>')}
      <h3>Articles vendus</h3>${table(["Article", "Qté", "Montant"], items || '<tr><td colspan="3">—</td></tr>')}
      <h3>Opérations</h3>${table(["Heure", "Opération", "Paiement", "Montant"], ops || '<tr><td colspan="4">—</td></tr>')}
      <button onclick="window.print()">Imprimer / PDF</button>
      <script>setTimeout(function(){window.print()},350)<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return false;
    w.document.write(html);
    w.document.close();
    return true;
  }

  return { csv, printPDF, toCSV };
})();

if (typeof module !== "undefined") module.exports = NKExport;
