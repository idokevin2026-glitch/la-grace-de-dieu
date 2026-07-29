// Test Node de l'utilitaire EAN-13 (node js/barcode.test.js)
const B = require("./barcode.js");
let pass = 0, fail = 0;
const a = (c, m) => (c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗", m)));
a(B.checkDigit("400638133393") === 1, "clé 400638133393 -> 1");
a(B.checkDigit("978020137962") === 4, "clé ISBN 9780201379624 -> 4");
a(B.isValid("4006381333931"), "EAN-13 valide accepté");
a(!B.isValid("4006381333930"), "mauvaise clé rejetée");
a(!B.isValid("123"), "trop court rejeté");
let ok = true;
for (let i = 0; i < 1000; i++) { const c = B.generate(i * 7 + 3); if (!B.isValid(c) || !c.startsWith("200")) { ok = false; break; } }
a(ok, "generate() : 1000 EAN-13 valides, préfixe interne 200");
console.log(`\n${pass} OK, ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
