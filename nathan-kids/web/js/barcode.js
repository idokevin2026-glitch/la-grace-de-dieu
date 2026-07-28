// ============================================================================
// NATHAN KIDS — EAN-13 (chiffre de contrôle valide)
// ----------------------------------------------------------------------------
// Le prototype fabriquait un code factice ('978' + id) sans clé de contrôle
// valide (BUSINESS_LOGIC.md §10). Ici on génère de VRAIS EAN-13 : préfixe
// interne 200–299 (réservé à l'usage interne des magasins) + clé calculée.
// ============================================================================
const NKBarcode = (() => {
  // Clé de contrôle EAN-13 à partir des 12 premiers chiffres.
  function checkDigit(first12) {
    const d = String(first12).replace(/\D/g, "");
    if (d.length !== 12) throw new Error("12 chiffres attendus");
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10;
  }

  // Vrai si `code` est un EAN-13 valide (13 chiffres + clé correcte).
  function isValid(code) {
    const d = String(code).replace(/\D/g, "");
    if (!/^\d{13}$/.test(d)) return false;
    return checkDigit(d.slice(0, 12)) === Number(d[12]);
  }

  // Génère un EAN-13 interne à partir d'une graine (ex. horodatage/compteur).
  function generate(seed) {
    const base = String(seed ?? Date.now()).replace(/\D/g, "");
    // '200' + 9 chiffres tirés de la graine = 12 chiffres
    const body = ("200" + base.padStart(9, "0").slice(-9)).slice(0, 12);
    return body + checkDigit(body);
  }

  return { checkDigit, isValid, generate };
})();

if (typeof module !== "undefined") module.exports = NKBarcode;
