const crypto = require("crypto");
function b64u(x){return Buffer.from(x).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
const fname = process.argv[2];
const now = Date.now();
const body = { tenantId: 999, p: fname, exp: now + 5*60*1000 };
const bodyBuf = Buffer.from(JSON.stringify(body), "utf8");
const sig = crypto.createHmac("sha256", process.env.TICKET_SECRET_FOR_SIGN).update(bodyBuf).digest();
console.log(b64u(bodyBuf)+"."+b64u(sig));
