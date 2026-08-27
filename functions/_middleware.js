const ACCESS_CODE = "taproot";
const COOKIE = "rc_auth";

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // Login submission
  if (request.method === "POST" && url.pathname === "/__auth") {
    const form = await request.formData();
    const code = (form.get("code") || "").toString().trim().toLowerCase();
    if (code === ACCESS_CODE) {
      return new Response(null, {
        status: 302,
        headers: {
          "Set-Cookie": `${COOKIE}=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
          "Location": "/",
        },
      });
    }
    return gate("That code was not recognized. Please try again.");
  }

  const cookie = request.headers.get("Cookie") || "";
  if (cookie.split(";").some((c) => c.trim() === `${COOKIE}=ok`)) {
    return next();
  }
  return gate();
}

function gate(message = "") {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Richland Connected History</title>
<style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:Georgia,serif;background:#1f3a2e;color:#f3ead6}
  .card{background:#f3ead6;color:#1f3a2e;padding:2.2rem 2rem;border-radius:10px;
    width:320px;box-shadow:0 10px 40px rgba(0,0,0,.35);text-align:center}
  h1{font-size:1.2rem;margin:.2rem 0 1rem}
  input{width:100%;padding:.6rem;border:1px solid #b7a97f;border-radius:6px;
    font-size:1rem;box-sizing:border-box}
  button{margin-top:.9rem;width:100%;padding:.6rem;border:0;border-radius:6px;
    background:#c8a028;color:#1f3a2e;font-weight:bold;font-size:1rem;cursor:pointer}
  .msg{color:#8a2b2b;font-size:.85rem;margin-top:.6rem;min-height:1rem}
</style></head><body>
  <form class="card" method="POST" action="/__auth">
    <h1>Richland Connected History</h1>
    <input name="code" type="password" placeholder="Access code" autofocus>
    <button type="submit">Enter</button>
    <div class="msg">${message}</div>
  </form>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
