/**
 * Full interactive Themis OIDC login flow test.
 * Usage: node test_axios.js
 * Reads username from username.txt, password from password.txt, prompts for TOTP.
 */
const fs = require("fs");
const readline = require("readline");
const axiosModule = require("./node_modules/axios");
const axios = axiosModule.default;
const { Cookie, CookieJar } = require("./node_modules/tough-cookie");
const { parse: parseHtml } = require("./node_modules/node-html-parser");

const BASE_URL = "https://themis.housing.rug.nl";
const jar = new CookieJar();

function logCookies(label) {
  const domains = [BASE_URL, "https://connect.surfconext.nl", "https://signon.rug.nl", "https://xfactor.rug.nl"];
  console.log("\n--- cookies @ " + label + " ---");
  for (const d of domains) {
    const c = jar.getCookieStringSync(d);
    console.log("  " + d + ": " + (c || "(none)"));
  }
  console.log("---");
}

function storeCookies(url, resp) {
  const rawRes = resp.request && resp.request.res;

  // Always gather from rawHeaders flat array first (most reliable)
  let arr = [];
  if (rawRes && rawRes.rawHeaders) {
    const rh = rawRes.rawHeaders;
    for (let i = 0; i < rh.length; i += 2) {
      if (rh[i].toLowerCase() === "set-cookie") arr.push(rh[i + 1]);
    }
  }

  // Fallback: rawRes.headers["set-cookie"] (Node.js array)
  if (arr.length === 0 && rawRes && rawRes.headers && rawRes.headers["set-cookie"]) {
    const h = rawRes.headers["set-cookie"];
    arr = Array.isArray(h) ? h : [h];
  }

  // Final fallback: axios normalized (may lose cookies)
  if (arr.length === 0) {
    const ax = resp.headers["set-cookie"];
    if (ax) arr = Array.isArray(ax) ? ax : [ax];
  }

  // Debug: also print rawHeaders set-cookie count vs headers["set-cookie"]
  if (rawRes) {
    const rhCount = (rawRes.rawHeaders || []).reduce((n, h, i) => n + (i % 2 === 0 && h.toLowerCase() === "set-cookie" ? 1 : 0), 0);
    const hArr = rawRes.headers && rawRes.headers["set-cookie"];
    const hCount = Array.isArray(hArr) ? hArr.length : (hArr ? 1 : 0);
    if (rhCount !== hCount) {
      console.log("  [!!! MISMATCH] rawHeaders set-cookie count=" + rhCount + " vs headers count=" + hCount);
    }
  }

  console.log("  [storeCookies] " + arr.length + " Set-Cookie header(s) from " + url.substring(0, 80));
  for (const raw of arr) {
    console.log("    raw: " + raw.substring(0, 120));
    try {
      const c = Cookie.parse(raw);
      if (c) {
        jar.setCookieSync(c, url);
        console.log("    stored: " + c.key + " (domain=" + c.domain + ", path=" + c.path + ")");
      } else {
        console.log("    Cookie.parse returned null");
      }
    } catch (e) {
      console.log("    ERROR: " + e.message);
    }
  }
}

function getCookies(url) {
  return jar.getCookieStringSync(url) || "";
}

async function rawGet(url, referer) {
  console.log("\nGET " + url.substring(0, 120));
  const headers = {
    Cookie: getCookies(url),
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "cross-site" : "none",
    "Sec-Fetch-User": "?1",
    "Connection": "keep-alive",
  };
  if (referer) headers["Referer"] = referer;
  const resp = await axios.get(url, { maxRedirects: 0, validateStatus: () => true, headers });
  console.log("  -> " + resp.status + " " + (resp.headers["location"] || "").substring(0, 100));
  storeCookies(url, resp);
  return resp;
}

async function rawPost(url, body, contentType, referer) {
  console.log("\nPOST " + url.substring(0, 120));
  const headers = {
    Cookie: getCookies(url),
    "Content-Type": contentType,
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Connection": "keep-alive",
  };
  if (referer) { headers["Referer"] = referer; headers["Origin"] = new URL(referer).origin; }
  const resp = await axios.post(url, body, { maxRedirects: 0, validateStatus: () => true, headers });
  console.log("  -> " + resp.status + " " + (resp.headers["location"] || "").substring(0, 100));
  storeCookies(url, resp);
  return resp;
}

function resolveRedirect(resp, currentUrl) {
  const loc = resp.headers["location"];
  if (!loc) return null;
  if (loc.startsWith("http")) return loc;
  return new URL(loc, new URL(currentUrl).origin).href;
}

async function followRedirects(url, referer, maxHops) {
  maxHops = maxHops || 15;
  let cur = url, ref = referer;
  for (let i = 0; i < maxHops; i++) {
    const resp = await rawGet(cur, ref);
    if (resp.status >= 300 && resp.status < 400) {
      const next = resolveRedirect(resp, cur);
      if (!next) return { resp, url: cur };
      ref = cur; cur = next; continue;
    }
    return { resp, url: cur };
  }
  throw new Error("Too many redirects");
}

function extractForm(html) {
  if (typeof html !== "string") return null;
  const root = parseHtml(html);
  const form = root.querySelector("form");
  if (!form) return null;
  const action = form.getAttribute("action") || "";
  const fields = {};
  for (const input of form.querySelectorAll("input")) {
    const name = input.getAttribute("name");
    const value = input.getAttribute("value") || "";
    if (name) fields[name] = value;
  }
  return { action, fields };
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  const username = fs.readFileSync("username.txt", "utf8").trim();
  const password = fs.readFileSync("password.txt", "utf8").trim();
  console.log("Username:", username);

  // Step 1: Initiate OIDC at Themis
  console.log("\n=== STEP 1: GET /log/in/oidc ===");
  const step1 = await rawGet(BASE_URL + "/log/in/oidc", BASE_URL);
  logCookies("after step 1");
  let nextUrl = resolveRedirect(step1, BASE_URL + "/log/in/oidc");
  if (!nextUrl) { console.error("No redirect from /log/in/oidc"); return; }
  console.log("FULL oidc/authorize URL:\n" + nextUrl);

  // Step 2: Follow SURFconext redirects to engine/signon
  console.log("\n=== STEP 2: Follow SURFconext redirects ===");
  const { resp: engineResp, url: engineUrl } = await followRedirects(nextUrl, BASE_URL + "/");
  logCookies("after step 2");
  console.log("Final URL:", engineUrl.substring(0, 120));
  console.log("Final status:", engineResp.status);
  if (typeof engineResp.data === "string" && engineResp.data.length < 3000) {
    console.log("Body:\n" + engineResp.data);
  } else if (typeof engineResp.data === "string") {
    console.log("Body (first 1500):\n" + engineResp.data.substring(0, 1500));
  }

  // Step 3: Auto-submit SAML form to signon.rug.nl
  console.log("\n=== STEP 3: SAML form to signon.rug.nl ===");
  let formData = extractForm(engineResp.data);
  if (!formData) { console.error("No SAML form found in engine response"); return; }
  console.log("Form action:", formData.action.substring(0, 100));
  console.log("Form fields:", Object.keys(formData.fields).join(", "));
  let resp = await rawPost(
    formData.action,
    new URLSearchParams(formData.fields).toString(),
    "application/x-www-form-urlencoded",
    engineUrl
  );
  logCookies("after step 3");

  // Step 4: Handle signon.rug.nl auto-submit form
  console.log("\n=== STEP 4: signon auto-submit form ===");
  console.log("Status:", resp.status);
  if (typeof resp.data === "string") console.log("Body (first 1000):\n" + resp.data.substring(0, 1000));
  formData = extractForm(resp.data);
  let currentUrl = formData ? formData.action : "";
  if (formData) {
    const actionUrl = formData.action.startsWith("http")
      ? formData.action
      : new URL(formData.action, "https://signon.rug.nl").href;
    console.log("Auto-submit to:", actionUrl.substring(0, 100));
    resp = await rawPost(
      actionUrl,
      new URLSearchParams(formData.fields).toString(),
      "application/x-www-form-urlencoded",
      "https://signon.rug.nl/nidp/saml2/sso"
    );
    currentUrl = actionUrl;
  } else if (resp.status >= 300 && resp.status < 400) {
    const redir = resolveRedirect(resp, "https://signon.rug.nl");
    if (redir) { resp = await rawGet(redir, "https://signon.rug.nl"); currentUrl = redir; }
  }
  logCookies("after step 4");

  // Step 5: POST credentials
  console.log("\n=== STEP 5: POST credentials ===");
  console.log("Status:", resp.status);
  if (typeof resp.data === "string") console.log("Body (first 1000):\n" + resp.data.substring(0, 1000));
  formData = extractForm(resp.data);
  const credFields = {};
  if (formData) Object.assign(credFields, formData.fields);
  credFields["Ecom_User_ID"] = username;
  credFields["Ecom_Password"] = password;
  credFields["option"] = "credential";
  let credUrl = formData && formData.action
    ? (formData.action.startsWith("http") ? formData.action : new URL(formData.action, "https://signon.rug.nl").href)
    : "https://signon.rug.nl/nidp/saml2/sso?id=100&sid=0&option=credential&sid=0";
  console.log("POST to:", credUrl.substring(0, 100));
  console.log("Fields:", Object.keys(credFields).join(", "));
  resp = await rawPost(credUrl, new URLSearchParams(credFields).toString(), "application/x-www-form-urlencoded", credUrl);
  currentUrl = credUrl;
  logCookies("after step 5");

  // Follow any redirect after credentials
  if (resp.status >= 300 && resp.status < 400) {
    const loc = resolveRedirect(resp, currentUrl);
    if (loc) { resp = await rawGet(loc, currentUrl); currentUrl = loc; }
  }

  // Step 6: Handle xfactor TOTP
  // After credentials, signon returns an auto-submit form to xfactor/oauth2/grant.
  // We must first follow that to reach the REAL TOTP entry page (which has nffc input),
  // THEN submit nffc=TOTP_CODE to contractcontinue.
  console.log("\n=== STEP 6: TOTP handling ===");
  let bodyStr = typeof resp.data === "string" ? resp.data : "";

  // Follow any auto-submit forms that lead to xfactor until we reach the TOTP entry page
  let xfactorHops = 0;
  while (xfactorHops++ < 5) {
    bodyStr = typeof resp.data === "string" ? resp.data : "";
    const hasNffc = bodyStr.includes('name="nffc"') || bodyStr.includes("name='nffc'");
    if (hasNffc) {
      console.log("[xfactor TOTP page reached]");
      break;
    }
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resolveRedirect(resp, currentUrl);
      if (loc) { resp = await rawGet(loc, currentUrl); currentUrl = loc; continue; }
    }
    const nextForm = extractForm(bodyStr);
    const isAutoSubmit = nextForm && (bodyStr.includes("document.forms[0].submit") || bodyStr.includes(".submit()"));
    if (isAutoSubmit) {
      const actionUrl = nextForm.action.startsWith("http") ? nextForm.action : new URL(nextForm.action, new URL(currentUrl).origin).href;
      console.log("Auto-submit to:", actionUrl.substring(0, 100));
      resp = await rawPost(actionUrl, new URLSearchParams(nextForm.fields).toString(), "application/x-www-form-urlencoded", currentUrl);
      currentUrl = actionUrl;
      continue;
    }
    console.log("[No path to TOTP page found] Status:", resp.status, "URL:", currentUrl.substring(0, 100));
    console.log("Body (first 1500):", bodyStr.substring(0, 1500));
    break;
  }

  bodyStr = typeof resp.data === "string" ? resp.data : "";
  const hasTotpForm = bodyStr.includes('name="nffc"') || bodyStr.includes("name='nffc'");
  if (hasTotpForm) {
    const totp = await prompt("Enter TOTP code (nffc): ");
    const totpFormData = extractForm(bodyStr);
    const totpFields = {};
    if (totpFormData) {
      Object.assign(totpFields, totpFormData.fields);
      console.log("xfactor form fields:", Object.keys(totpFields).join(", "));
    }
    totpFields["nffc"] = totp;
    totpFields["option"] = "credential";
    let totpAction = currentUrl;
    if (totpFormData && totpFormData.action) {
      totpAction = totpFormData.action.startsWith("http")
        ? totpFormData.action
        : new URL(totpFormData.action, new URL(currentUrl).origin).href;
    }
    console.log("TOTP POST to:", totpAction.substring(0, 100));
    resp = await rawPost(totpAction, new URLSearchParams(totpFields).toString(), "application/x-www-form-urlencoded", currentUrl);
    currentUrl = totpAction;
    logCookies("after TOTP");
  } else {
    console.log("[SKIP] No TOTP form (nffc) detected, continuing...");
  }

  // Step 7: Follow SAML response chain back to Themis
  console.log("\n=== STEP 7: SAML response chain back to Themis ===");
  let lastUrl = "";
  for (let bounce = 0; bounce < 15; bounce++) {
    console.log("\nbounce " + bounce + ": URL=" + currentUrl.substring(0, 100) + " status=" + resp.status);
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resolveRedirect(resp, currentUrl);
      if (!loc) break;
      resp = await rawGet(loc, currentUrl);
      currentUrl = loc;
      continue;
    }
    const html = typeof resp.data === "string" ? resp.data : "";
    // Check for any auto-submit form
    const autoForm = extractForm(html);
    if (autoForm && autoForm.action) {
      const action = autoForm.action.startsWith("http")
        ? autoForm.action
        : new URL(autoForm.action, new URL(currentUrl).origin).href;
      console.log("Auto-submit to:", action.substring(0, 100));
      resp = await rawPost(action, new URLSearchParams(autoForm.fields).toString(), "application/x-www-form-urlencoded", currentUrl);
      currentUrl = action;
      continue;
    }
    // No form — if we got a new session cookie and are at the same non-Themis URL, retry (JSESSIONID rotation)
    if (currentUrl === lastUrl || currentUrl.startsWith(BASE_URL)) {
      if (currentUrl.startsWith(BASE_URL)) {
        const match = /logged in as ([sp][0-9]{7})/i.exec(html);
        if (match) { console.log("\n*** LOGIN SUCCESSFUL: " + match[1] + " ***"); break; }
        console.log("At Themis but not logged in. Body:\n" + html.substring(0, 1000));
      }
      break;
    }
    // Same URL different times = retry once (JSESSIONID rotation case)
    console.log("No form or redirect; retrying same URL for session rotation...");
    lastUrl = currentUrl;
    resp = await rawGet(currentUrl, currentUrl);
    continue;
  }

  logCookies("FINAL");
}

main().catch(e => { console.error("FATAL:", e.message, e.stack); });

