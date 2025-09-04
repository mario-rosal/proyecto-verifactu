const crypto = require("crypto");
function b64u(x){return Buffer.from(x).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
const header = b64u(JSON.stringify({alg:"HS256",typ:"JWT"}));
const now = Math.floor(Date.now()/1000);
const payloadObj = { tenantId: 999, sub:"u", email:"u@x", role:"ADMIN", iat: now, exp: now + 300 };
const payload = b64u(JSON.stringify(payloadObj));
const data = header + "." + payload;
const sig = b64u(crypto.createHmac("sha256", process.env.JWT_FOR_SIGN).update(data).digest());
console.log(data + "." + sig);
