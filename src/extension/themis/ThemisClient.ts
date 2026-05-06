/* eslint-disable @typescript-eslint/naming-convention */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Cookie, CookieJar } from 'tough-cookie';
import FormData from 'form-data';
import * as fs from 'fs';
import {
    AssignmentOptionGroup,
    AssignmentTestCase,
    Assignment,
    CourseNode,
    LoggedInUserInformation,
    SubmissionResult,
    SubmissionSummary,
    TestCaseResult,
    ThemisStatus,
} from '../../protocol/protocol';
import { parse } from 'node-html-parser';
import { ExtensionContext } from 'vscode';
import { io, Socket } from 'socket.io-client';
const BASE_URL = "https://themis.housing.rug.nl";
class ThemisClient {
    private client: AxiosInstance;
    private cookieJar: CookieJar;
    private context: ExtensionContext;
    constructor(context: ExtensionContext) {
        this.cookieJar = new CookieJar();
        this.client = axios.create({
            baseURL: BASE_URL,
            maxRedirects: 0,
            validateStatus: () => true,
        });
        this.context = context;
        this.restoreSession();
    }
    
    private async restoreSession() {
        const raw = await this.context.secrets.get("themis-cookies");
        if (raw) {
            try {
                const cookies: string[] = JSON.parse(raw);
                console.log(`[THEMIS] restoreSession: Restoring ${cookies.length} cookies`);
                for (const c of cookies) {
                    const parsed = Cookie.parse(c);
                    if (parsed) {
                        this.cookieJar.setCookieSync(parsed, BASE_URL);
                        console.log(`[THEMIS] restoreSession: Restored cookie: ${parsed.key} (domain=${parsed.domain})`);
                    }
                }
            } catch (e) {
                console.error(`[THEMIS] restoreSession: Error restoring cookies:`, e);
            }
        } else {
            console.log(`[THEMIS] restoreSession: No stored cookies found`);
        }
    }
    private async persistSession() {
        try {
            const allCookies = this.cookieJar.getCookiesSync(BASE_URL);
            console.log(`[THEMIS] persistSession: Saving ${allCookies.length} cookies for ${BASE_URL}`);
            for (const c of allCookies) {
                console.log(`[THEMIS] persistSession: Saving cookie: ${c.key} (domain=${c.domain})`);
            }
            await this.context.secrets.store(
                "themis-cookies",
                JSON.stringify(allCookies.map(c => c.toString()))
            );
        } catch (e) {
            console.error(`[THEMIS] persistSession: Error saving cookies:`, e);
        }
    }
    private getCookieStringForUrl(url: string): string {
        try {
            const cookies = this.cookieJar.getCookieStringSync(url);
            if (cookies) {
                console.log(`[THEMIS] getCookieStringForUrl: Sending cookies for ${url}: ${cookies.substring(0, 200)}`);
            } else {
                console.log(`[THEMIS] getCookieStringForUrl: No cookies for ${url}`);
            }
            return cookies;
        } catch (e) {
            console.error(`[THEMIS] getCookieStringForUrl(${url}): Error:`, e);
            return "";
        }
    }
    private storeCookiesFromUrl(url: string, resp: AxiosResponse) {
        // CRITICAL: Use the raw Node.js response headers, NOT axios's headers.
        // Axios joins multiple Set-Cookie headers into a single comma-separated string,
        // which breaks cookie parsing. Node's http module always keeps set-cookie as an array.
        const rawRes = (resp as any).request?.res;
        const setCookieArray: string[] = rawRes?.headers?.["set-cookie"] || [];
        if (setCookieArray.length > 0) {
            console.log(`[THEMIS] storeCookiesFromUrl: Storing ${setCookieArray.length} cookie(s) from Set-Cookie headers for ${url}`);
            for (const raw of setCookieArray) {
                try {
                    const parsed = Cookie.parse(raw);
                    if (parsed) {
                        this.cookieJar.setCookieSync(parsed, url);
                        console.log(`[THEMIS] storeCookiesFromUrl: Stored ${parsed.key} (domain=${parsed.domain}, path=${parsed.path})`);
                    }
                } catch (e) {
                    console.error(`[THEMIS] storeCookiesFromUrl: Error parsing cookie from ${url}:`, e);
                }
            }
        }
    }
    private logAllCookies(label: string) {
        try {
            const urlsToCheck = [BASE_URL, "https://connect.surfconext.nl", "https://signon.rug.nl", "https://xfactor.rug.nl"];
            console.log(`[THEMIS] ${label}: Checking cookies for ${urlsToCheck.length} domains:`);
            for (const url of urlsToCheck) {
                const cookies = this.cookieJar.getCookieStringSync(url);
                console.log(`  ${url}: ${cookies ? cookies.substring(0, 150) : "(none)"}`);
            }
        } catch (e) {
            console.error(`[THEMIS] ${label}: Error logging cookies:`, e);
        }
    }
    
    /** Browser-like headers required by SURFconext to issue a SESSION cookie. */
    private browserHeaders(referer?: string, isCrossOrigin = false): Record<string, string> {
        return {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": referer ? (isCrossOrigin ? "cross-site" : "same-origin") : "none",
            "Sec-Fetch-User": "?1",
            "Connection": "keep-alive",
        };
    }
    private async rawGet(url: string, referer?: string): Promise<AxiosResponse> {
        console.log(`[THEMIS] rawGet: ${url.substring(0, 150)}`);
        const isCross = !!(referer && new URL(url).hostname !== new URL(referer).hostname);
        const resp = await axios.get(url, {
            maxRedirects: 0,
            validateStatus: () => true,
            headers: {
                Cookie: this.getCookieStringForUrl(url),
                ...this.browserHeaders(referer, isCross),
                ...(referer ? { Referer: referer } : {}),
            },
        });
        console.log(`[THEMIS] rawGet: Response status=${resp.status}, content-length=${typeof resp.data === "string" ? resp.data.length : "?"}`);
        this.storeCookiesFromUrl(url, resp);
        return resp;
    }
    private async rawPost(url: string, data: string, contentType: string, referer?: string): Promise<AxiosResponse> {
        console.log(`[THEMIS] rawPost: ${url.substring(0, 150)}`);
        const isCross = !!(referer && new URL(url).hostname !== new URL(referer).hostname);
        const resp = await axios.post(url, data, {
            maxRedirects: 0,
            validateStatus: () => true,
            headers: {
                Cookie: this.getCookieStringForUrl(url),
                "Content-Type": contentType,
                ...this.browserHeaders(referer, isCross),
                ...(referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
            },
        });
        console.log(`[THEMIS] rawPost: Response status=${resp.status}, content-length=${typeof resp.data === "string" ? resp.data.length : "?"}`);
        this.storeCookiesFromUrl(url, resp);
        return resp;
    }
    private resolveRedirect(resp: AxiosResponse, currentUrl: string): string | null {
        const loc = resp.headers["location"];
        if (!loc) { return null; }
        if (loc.startsWith("http")) { return loc; }
        const base = new URL(currentUrl);
        return new URL(loc, base.origin).href;
    }
    /** Follow a chain of 302 redirects, returning the final non-redirect response. */
    private async followRedirects(url: string, referer?: string, maxHops = 15): Promise<{ resp: AxiosResponse; url: string }> {
        let currentUrl = url;
        let currentReferer = referer;
        for (let i = 0; i < maxHops; i++) {
            const resp = await this.rawGet(currentUrl, currentReferer);
            if (resp.status >= 300 && resp.status < 400) {
                const next = this.resolveRedirect(resp, currentUrl);
                if (!next) { return { resp, url: currentUrl }; }
                currentReferer = currentUrl;
                currentUrl = next;
                continue;
            }
            return { resp, url: currentUrl };
        }
        throw new Error("Too many redirects in OIDC flow");
    }
    private async get(path: string) {
        const url = `${BASE_URL}${path}`;
        const resp = await this.rawGet(url);
        // Follow single redirect if needed
        if (resp.status >= 300 && resp.status < 400) {
            const next = this.resolveRedirect(resp, url);
            if (next && next.startsWith(BASE_URL)) {
                return this.rawGet(next, url);
            }
        }
        return resp;
    }
    private async post(path: string, data: any, extraHeaders?: Record<string, string>) {
        const url = `${BASE_URL}${path}`;
        const resp = await this.client.post(path, data, {
            headers: { Cookie: this.getCookieStringForUrl(url), ...extraHeaders }
        });
        this.storeCookiesFromUrl(url, resp);
        return resp;
    }
    
    public checkLoggedInPage(html: string): LoggedInUserInformation | null {
        // Themis renders: <a href="/user" class="iconize user">Name (s1234567)</a>
        // Themis renders: <a href="/user" class="iconize user">Name (s1234567)</a>
        // Student numbers (s) are 7 digits; staff/personnel (p) numbers may be 6 digits.
        const match = /<a href="\/user"[^>]*>([^<(]+)\(([sp][0-9]{3,9})\)<\/a>/i.exec(html);
        if (!match) {
            console.debug("[THEMIS] checkLoggedInPage: No logged-in pattern found in HTML");
            return null;
        }
        const name = match[1].trim();
        const studentId = match[2].toUpperCase();
        console.debug(`[THEMIS] checkLoggedInPage: Found logged-in user: ${studentId} (${name})`);
        return { name, studentId };
    }
    /**
     * Full OIDC login flow:
     * 1. GET /log/in/oidc  → 302 to SURFconext OIDC authorize
     * 2. Follow redirects through SURFconext → engine → signon.rug.nl
     * 3. Auto-submit SAML form to signon.rug.nl
     * 4. Auto-submit credential form → get login page
     * 5. POST credentials (Ecom_User_ID, Ecom_Password)
     * 6. Follow redirect to xfactor.rug.nl for TOTP
     * 7. POST TOTP code
     * 8. Follow SAML responses back through SURFconext → Themis callback
     * 9. Extract session cookie
     */
    public async login(username: string, password: string, totp: string): Promise<LoggedInUserInformation | null> {
        try {
            console.log(`[THEMIS] Starting login flow for user: ${username}`);
            this.logAllCookies("login START");
            
            // Step 1: Initiate OIDC flow at Themis
            console.log("[THEMIS] Step 1: GET /log/in/oidc");
            const oidcStart = await this.rawGet(`${BASE_URL}/log/in/oidc`, BASE_URL);
            console.log(`[THEMIS] Step 1 response: status=${oidcStart.status}`);
            this.logAllCookies("Step 1 AFTER /log/in/oidc");
            
            let nextUrl = this.resolveRedirect(oidcStart, `${BASE_URL}/log/in/oidc`);
            if (!nextUrl) { 
                console.error("[THEMIS] Step 1: No redirect found in response");
                return null; 
            }
            console.log(`[THEMIS] Step 1: Resolved redirect to: ${nextUrl.substring(0, 100)}...`);
            // Step 2: Follow redirects through SURFconext (authorize → saml2/authenticate → engine SSO)
            console.log("[THEMIS] Step 2: Following redirects through SURFconext...");
            this.logAllCookies("Step 2 BEFORE redirects");
            const { resp: engineResp, url: engineUrl } = await this.followRedirects(nextUrl, `${BASE_URL}/`);
            console.log(`[THEMIS] Step 2: Followed ${nextUrl === engineUrl ? 0 : 1}+ redirects, final status=${engineResp.status}, final URL=${engineUrl.substring(0, 100)}...`);
            this.logAllCookies("Step 2 AFTER redirects");
            console.log(`[THEMIS] Step 2: Response headers:`, JSON.stringify(engineResp.headers, null, 2).substring(0, 1000));
            if (engineResp.status === 200 && typeof engineResp.data === "string") {
                console.log(`[THEMIS] Step 2: Full response body (${engineResp.data.length} chars):\n${engineResp.data}`);
            }
            // Step 3: Parse auto-submit SAML form (SURFconext engine → signon.rug.nl)
            console.log("[THEMIS] Step 3: Extracting SAML form from engine response");
            var bodyStr = String(engineResp.data);
            console.log(`[THEMIS] Step 3: Response data type=${typeof engineResp.data}, length=${bodyStr.length} chars`);
            console.log(`[THEMIS] Step 3: Full response body:\n${bodyStr}`);
            let formData = this.extractFormData(engineResp.data);
            let resp: AxiosResponse;
            if (!formData) {
                console.log("[THEMIS] Step 3: extractFormData returned null, trying fallbacks...");
                // Fallback: check for meta-refresh redirect
                const metaRefresh = bodyStr.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["']\d+;\s*url=([^"']+)["']/i)
                    || bodyStr.match(/content=["']\d+;\s*url=([^"']+)["'][^>]+http-equiv=["']refresh["']/i);
                if (metaRefresh) {
                    console.log(`[THEMIS] Step 3: Found meta-refresh redirect to ${metaRefresh[1]}`);
                }
                // Fallback: window.location JavaScript redirect
                const jsRedirect = bodyStr.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
                if (jsRedirect) {
                    console.log(`[THEMIS] Step 3: Found window.location redirect to ${jsRedirect[1]}`);
                }
                // Fallback: SAMLRequest as redirect-binding URL in the page
                const samlRedirect = bodyStr.match(/href=["'](https?:[^"']*SAMLRequest=[^"']+)["']/i);
                if (samlRedirect) {
                    console.log(`[THEMIS] Step 3: Found SAML redirect URL`);
                }
                const fallbackUrl = metaRefresh?.[1] || jsRedirect?.[1] || samlRedirect?.[1];
                if (fallbackUrl) {
                    const resolvedFallback = fallbackUrl.startsWith("http")
                        ? fallbackUrl
                        : new URL(fallbackUrl, new URL(engineUrl).origin).href;
                    console.log(`[THEMIS] Step 3: Using fallback redirect to ${resolvedFallback.substring(0, 150)}`);
                    resp = await this.rawGet(resolvedFallback, engineUrl);
                    console.log(`[THEMIS] Step 3: Fallback redirect response status=${resp.status}, content-length=${typeof resp.data === "string" ? resp.data.length : "?"}`);
                    if (typeof resp.data === "string") {
                        console.log(`[THEMIS] Step 3: Fallback response body:\n${resp.data.substring(0, 2000)}`);
                    }
                    // Follow any further redirects from this fallback
                    let fbUrl = resolvedFallback;
                    let hops = 0;
                    while (resp.status >= 300 && resp.status < 400 && hops++ < 10) {
                        const next = this.resolveRedirect(resp, fbUrl);
                        if (!next) { break; }
                        console.log(`[THEMIS] Step 3: Following fallback redirect (hop ${hops}) to ${next.substring(0, 100)}...`);
                        fbUrl = next;
                        resp = await this.rawGet(fbUrl, fbUrl);
                        console.log(`[THEMIS] Step 3: Fallback hop ${hops} status=${resp.status}`);
                    }
                    // Try extracting form from the result
                    formData = this.extractFormData(resp.data);
                    if (!formData) {
                        console.error(`[THEMIS] Step 3: Still no form data after fallback.`);
                        if (typeof resp.data === "string") {
                            console.error(`[THEMIS] Step 3: Fallback response body:\n${resp.data}`);
                        }
                        return null;
                    }
                    console.log(`[THEMIS] Step 3: Form found after fallback, action=${formData.action.substring(0, 100)}..., fields=${Object.keys(formData.fields).join(", ")}`);
                } else {
                    console.error("[THEMIS] Step 3: No form data and no fallback redirect found in engine response");
                    console.error(`[THEMIS] Step 3: Page contains 'error' = ${bodyStr.includes("error")}`);
                    console.error(`[THEMIS] Step 3: Page contains 'No session' = ${bodyStr.includes("No session")}`);
                    console.error(`[THEMIS] Step 3: Page contains 'form' = ${bodyStr.includes("form")}`);
                    return null;
                }
            } else {
                console.log(`[THEMIS] Step 3: SAML form extracted, action=${formData.action.substring(0, 100)}..., fields=${Object.keys(formData.fields).join(", ")}`);
            }
            // Submit SAML request to RUG signon
            console.log("[THEMIS] Step 3: Submitting SAML form to RUG signon...");
            resp = await this.rawPost(
                formData.action,
                new URLSearchParams(formData.fields).toString(),
                "application/x-www-form-urlencoded",
                engineUrl,
            );
            console.log(`[THEMIS] Step 3: SAML submission status=${resp.status}`);
            // Step 4: Follow auto-submit to credential form
            // signon.rug.nl returns another auto-submit form
            console.log("[THEMIS] Step 4: Extracting credential form from signon response");
            console.log(`[THEMIS] Step 4: Response status=${resp.status}, content-length=${typeof resp.data === "string" ? resp.data.length : "?"}`);
            if (typeof resp.data === "string") {
                console.log(`[THEMIS] Step 4: Response body (first 1500 chars):\n${resp.data.substring(0, 1500)}`);
            }
            formData = this.extractFormData(resp.data);
            if (formData) {
                console.log(`[THEMIS] Step 4: Found auto-submit form, action=${formData.action.substring(0, 100)}..., fields=${Object.keys(formData.fields).join(", ")}`);
                // Resolve relative action URL
                const actionUrl = formData.action.startsWith("http")
                    ? formData.action
                    : new URL(formData.action, "https://signon.rug.nl").href;
                console.log(`[THEMIS] Step 4: Submitting auto-submit form to ${actionUrl.substring(0, 100)}...`);
                resp = await this.rawPost(
                    actionUrl,
                    new URLSearchParams(formData.fields).toString(),
                    "application/x-www-form-urlencoded",
                    "https://signon.rug.nl/nidp/saml2/sso",
                );
                console.log(`[THEMIS] Step 4: Auto-submit response status=${resp.status}`);
            } else if (resp.status >= 300 && resp.status < 400) {
                console.log(`[THEMIS] Step 4: No form found, following redirect`);
                const redir = this.resolveRedirect(resp, "https://signon.rug.nl/nidp/saml2/sso");
                if (redir) {
                    console.log(`[THEMIS] Step 4: Resolved redirect to ${redir.substring(0, 100)}...`);
                    resp = await this.rawGet(redir, "https://signon.rug.nl/nidp/saml2/sso");
                    console.log(`[THEMIS] Step 4: Redirect response status=${resp.status}`);
                    if (typeof resp.data === "string") {
                        console.log(`[THEMIS] Step 4: Redirect response body (first 1500 chars):\n${resp.data.substring(0, 1500)}`);
                    }
                }
            } else {
                console.log(`[THEMIS] Step 4: No auto-submit form found, response status=${resp.status}`);
                if (typeof resp.data === "string") {
                    console.log(`[THEMIS] Step 4: Response body (first 1500 chars):\n${resp.data.substring(0, 1500)}`);
                }
            }
            // Step 5: POST credentials to RUG login form
            // The response should be the login form with Ecom_User_ID and Ecom_Password
            console.log("[THEMIS] Step 5: Extracting credential form for username/password submission");
            formData = this.extractFormData(resp.data);
            const credentialFields: Record<string, string> = {};
            if (formData) {
                console.log(`[THEMIS] Step 5: Found credential form, action=${formData.action.substring(0, 100)}..., fields=${Object.keys(formData.fields).join(", ")}`);
                Object.assign(credentialFields, formData.fields);
            }
            credentialFields["Ecom_User_ID"] = username;
            credentialFields["Ecom_Password"] = password;
            credentialFields["option"] = "credential";
            console.log(`[THEMIS] Step 5: Credential fields to submit: ${Object.keys(credentialFields).join(", ")}`);
            // Determine the POST URL for credentials
            let credPostUrl = "https://signon.rug.nl/nidp/saml2/sso?id=100&sid=0&option=credential&sid=0";
            if (formData && formData.action) {
                credPostUrl = formData.action.startsWith("http")
                    ? formData.action
                    : new URL(formData.action, "https://signon.rug.nl").href;
            }
            console.log(`[THEMIS] Step 5: Submitting credentials to ${credPostUrl.substring(0, 100)}...`);
            resp = await this.rawPost(
                credPostUrl,
                new URLSearchParams(credentialFields).toString(),
                "application/x-www-form-urlencoded",
                "https://signon.rug.nl/nidp/saml2/sso",
            );
            console.log(`[THEMIS] Step 5: Credential submission response status=${resp.status}`);
            // Step 6: Handle TOTP / xfactor.rug.nl
            // After credentials, signon returns an auto-submit form that redirects to xfactor.
            // We must follow that auto-submit to reach the real TOTP entry page (which has input name="nffc"),
            // THEN submit nffc=totp to the contractcontinue URL.
            console.log("[THEMIS] Step 6: Looking for xfactor TOTP page (nffc input)");
            let currentUrl = credPostUrl;
            // Follow auto-submit forms (and redirects) until we land on the nffc TOTP page
            for (let hop = 0; hop < 5; hop++) {
                const bs = typeof resp.data === "string" ? resp.data : "";
                if (bs.includes('name="nffc"') || bs.includes("name='nffc'")) {
                    console.log("[THEMIS] Step 6: xfactor TOTP page reached");
                    break;
                }
                if (resp.status >= 300 && resp.status < 400) {
                    const loc = this.resolveRedirect(resp, currentUrl);
                    if (!loc) { break; }
                    currentUrl = loc;
                    resp = await this.rawGet(loc, currentUrl);
                    continue;
                }
                const intermediateForm = this.extractFormData(bs);
                if (intermediateForm) {
                    const isAutoSubmit = bs.includes("document.forms[0].submit") || bs.includes(".submit()");
                    if (isAutoSubmit || intermediateForm.action) {
                        const actionUrl = intermediateForm.action.startsWith("http")
                            ? intermediateForm.action
                            : new URL(intermediateForm.action, new URL(currentUrl).origin).href;
                        console.log(`[THEMIS] Step 6: Auto-submit to ${actionUrl.substring(0, 100)}...`);
                        resp = await this.rawPost(
                            actionUrl,
                            new URLSearchParams(intermediateForm.fields).toString(),
                            "application/x-www-form-urlencoded",
                            currentUrl,
                        );
                        currentUrl = actionUrl;
                        continue;
                    }
                }
                console.log("[THEMIS] Step 6: No path to TOTP page found");
                break;
            }
            bodyStr = typeof resp.data === "string" ? resp.data : "";
            if (bodyStr.includes('name="nffc"') || bodyStr.includes("name='nffc'")) {
                console.log("[THEMIS] Step 6: TOTP required (nffc), submitting TOTP code");
                const totpForm = this.extractFormData(bodyStr);
                const totpFields: Record<string, string> = {};
                if (totpForm) {
                    Object.assign(totpFields, totpForm.fields);
                }
                totpFields["nffc"] = totp;
                totpFields["option"] = "credential";
                console.log(`[THEMIS] Step 6: TOTP fields: ${Object.keys(totpFields).join(", ")}`);
                let totpAction = currentUrl;
                if (totpForm && totpForm.action) {
                    totpAction = totpForm.action.startsWith("http")
                        ? totpForm.action
                        : new URL(totpForm.action, new URL(currentUrl).origin).href;
                }
                console.log(`[THEMIS] Step 6: Submitting TOTP to ${totpAction.substring(0, 100)}...`);
                resp = await this.rawPost(
                    totpAction,
                    new URLSearchParams(totpFields).toString(),
                    "application/x-www-form-urlencoded",
                    currentUrl,
                );
                console.log(`[THEMIS] Step 6: TOTP submission response status=${resp.status}`);
                currentUrl = totpAction;
            } else {
                console.log("[THEMIS] Step 6: No TOTP page detected, proceeding to SAML callback");
            }
            // Step 7: Follow the chain back through SAML responses → SURFconext → Themis
            console.log("[THEMIS] Step 7: Following SAML response chain back to Themis");
            let lastVisitedUrl = "";
            for (let bounce = 0; bounce < 15; bounce++) {
                console.log(`[THEMIS] Step 7 (bounce ${bounce}): URL=${currentUrl.substring(0, 100)}, status=${resp.status}`);
                if (resp.status >= 300 && resp.status < 400) {
                    const loc = this.resolveRedirect(resp, currentUrl);
                    if (!loc) { break; }
                    currentUrl = loc;
                    resp = await this.rawGet(currentUrl, currentUrl);
                    continue;
                }
                const html = typeof resp.data === "string" ? resp.data : "";
                // Follow any form (SAML POST binding or xfactor contractcontinue)
                const autoForm = this.extractFormData(html);
                if (autoForm && autoForm.action) {
                    const action = autoForm.action.startsWith("http")
                        ? autoForm.action
                        : new URL(autoForm.action, new URL(currentUrl).origin).href;
                    console.log(`[THEMIS] Step 7 (bounce ${bounce}): Auto-submit to ${action.substring(0, 100)}`);
                    resp = await this.rawPost(
                        action,
                        new URLSearchParams(autoForm.fields).toString(),
                        "application/x-www-form-urlencoded",
                        currentUrl,
                    );
                    currentUrl = action;
                    continue;
                }
                // No form and no redirect — if we're not at Themis yet, retry once for JSESSIONID rotation
                if (currentUrl !== lastVisitedUrl && !currentUrl.startsWith(BASE_URL)) {
                    console.log(`[THEMIS] Step 7 (bounce ${bounce}): No form/redirect; retrying for session rotation`);
                    lastVisitedUrl = currentUrl;
                    resp = await this.rawGet(currentUrl, currentUrl);
                    continue;
                }
                // Check if we landed on Themis
                if (currentUrl.startsWith(BASE_URL)) {
                    const user = this.checkLoggedInPage(html);
                    if (user) {
                        console.log(`[THEMIS] Step 7: Login successful! User: ${user.studentId} (${user.name})`);
                        await this.persistSession();
                        return user;
                    }
                    console.log(`[THEMIS] Step 7 (bounce ${bounce}): At Themis but not logged in yet`);
                }
                console.log(`[THEMIS] Step 7 (bounce ${bounce}): No further processing possible, breaking`);
                break;
            }
            // Final check: see if the session is valid now
            console.log("[THEMIS] Step 8: Final login check");
            const check = await this.checkLogin();
            if (check) {
                console.log(`[THEMIS] Login successful! User: ${check.studentId} (${check.name})`);
                await this.persistSession();
            } else {
                console.log("[THEMIS] Final login check failed");
            }
            return check;
        } catch (err: any) {
            console.error("[THEMIS] Login flow failed with error:", err.message || err);
            console.error("[THEMIS] Error details:", err.stack || "no stack trace");
            return null;
        }
    }
    /** Extract form action and all hidden fields from an HTML auto-submit form. */
    private extractFormData(html: string): { action: string; fields: Record<string, string> } | null {
        if (typeof html !== "string") { return null; }
        const root = parse(html);
        const form = root.querySelector("form");
        if (!form) { return null; }
        const action = form.getAttribute("action") || "";
        const fields: Record<string, string> = {};
        for (const input of form.querySelectorAll("input")) {
            const name = input.getAttribute("name");
            const value = input.getAttribute("value") || "";
            if (name) {
                fields[name] = value;
            }
        }
        return { action, fields };
    }
    public async checkLogin(): Promise<LoggedInUserInformation | null> {
        try {
            console.debug("[THEMIS] checkLogin: GET /course/");
            const resp = await this.get("/course/");
            console.debug(`[THEMIS] checkLogin: Response status=${resp.status}`);
            const user = this.checkLoggedInPage(resp.data);
            if (user) {
                console.debug(`[THEMIS] checkLogin: Verified logged-in user: ${user.studentId}`);
            } else {
                console.debug("[THEMIS] checkLogin: Not logged in");
            }
            return user;
        } catch (err: any) {
            console.error("[THEMIS] checkLogin error:", err.message || err);
            return null;
        }
    }
    public async logout(): Promise<boolean> {
        try {
            console.log("[THEMIS] logout: Calling /log/out");
            await this.get("/log/out");
            console.log("[THEMIS] logout: /log/out succeeded");
        } catch (err: any) {
            console.error("[THEMIS] logout: Error calling /log/out:", err.message || err);
        }
        this.cookieJar = new CookieJar();
        console.log("[THEMIS] logout: Cleared cookies");
        await this.context.secrets.delete("themis-cookies");
        console.log("[THEMIS] logout: Deleted stored session");
        return true;
    }
    
    public async getNavigation(path: string): Promise<CourseNode[]> {
        const resp = await this.get(`/api/navigation${path}`);
        const data = resp.data;
        // The navigation API returns a JSON array of child nodes.
        // Each entry: { path, title, submitable, isExam, visible }
        let items: any[];
        if (typeof data === "string") {
            try {
                items = JSON.parse(data);
            } catch {
                console.error("[THEMIS] getNavigation: Failed to parse JSON response");
                return [];
            }
        } else if (Array.isArray(data)) {
            items = data;
        } else {
            console.error("[THEMIS] getNavigation: Unexpected response type", typeof data);
            return [];
        }
        return items.map((item: any) => {
            const submittable = !!item.submitable;
            let icon = "ass-group";
            if (submittable) {
                icon = item.isQuiz ? "quiz" : "ass-submitable";
            } else if (item.isExam) {
                icon = "ass-exam";
            }
            return {
                title: item.title || "",
                path: item.path || "",
                submittable,
                icon,
                isExam: !!item.isExam,
                isQuiz: !!item.isQuiz,
                visible: item.visible !== false,
                childrenLoaded: submittable,
            } as CourseNode;
        });
    }
    
    public async getAssignment(path: string): Promise<Assignment> {
        const resp = await this.get(`/course${path}`);
        const root = parse(resp.data);
        // Parse config options
        const configEl = root.querySelector(".ass-config");
        const optionGroups: AssignmentOptionGroup[] = [];
        let currentGroup: AssignmentOptionGroup = { name: "General", options: [] };
        if (configEl) {
            for (const child of configEl.childNodes) {
                const el = parse(child.toString());
                const groupTitle = el.querySelector(".cfg-group-title");
                if (groupTitle) {
                    if (currentGroup.options.length > 0) {
                        optionGroups.push(currentGroup);
                    }
                    currentGroup = { name: groupTitle.text.trim(), options: [] };
                    continue;
                }
                const cfgLine = el.querySelector(".cfg-line");
                if (cfgLine) {
                    // temmies confirms: key = .cfg-key, value = .cfg-val
                    const key = cfgLine.querySelector(".cfg-key");
                    const val = cfgLine.querySelector(".cfg-val");
                    if (key && key.text.trim()) {
                        const keyTip = key.querySelector(".tip[data-title]");
                        const keyDescription = keyTip?.getAttribute("data-title")?.trim();
                        const keyLabel = keyTip?.text.trim()
                            || key.text.trim().split(/\s{2,}|\n/)[0].trim();
                        let value = val ? val.text.trim() : "";
                        let files: { name: string; url: string }[] | undefined;
                        if (val) {
                            // Dates are in .tip[data-title] with ISO string, or <time datetime>
                            const tipDate = val.querySelector(".tip[data-title]");
                            if (tipDate) {
                                const dt = tipDate.getAttribute("data-title") || "";
                                if (/^\d{4}-\d{2}-\d{2}T/.test(dt)) { value = dt; }
                            } else {
                                const timeEl = val.querySelector("time[datetime]");
                                if (timeEl) { value = timeEl.getAttribute("datetime") || value; }
                            }
                            // File links (Downloads / Reference / Insertable / Overridable rows
                            // render as <a href="/file..." data-path="name">name</a>, possibly
                            // wrapped in a <details><summary>...</summary> when above a threshold).
                            const fileLinks = val.querySelectorAll('a[href^="/file"]');
                            if (fileLinks.length > 0) {
                                files = fileLinks.map(a => ({
                                    name: a.getAttribute("data-path")?.trim() || a.text.trim(),
                                    url: a.getAttribute("href") || "",
                                })).filter(f => f.url);
                                if (files.length === 0) { files = undefined; }
                            }
                        }
                        currentGroup.options.push({
                            name: keyLabel.replace(/:$/, ""),
                            value,
                            description: keyDescription,
                            files,
                        });
                    }
                }
            }
            if (currentGroup.options.length > 0) {
                optionGroups.push(currentGroup);
            }
        }
        // Parse test cases from the "Test cases" subsection (temmies-compatible)
        // <div class="subsec round shade"> → <h4 class="info">Test cases</h4> → <div class="cfg-line"><a href="...">N.in</a>
        const testCases: AssignmentTestCase[] = [];
        const subsections = root.querySelectorAll(".subsec.round.shade");
        for (const sub of subsections) {
            const header = sub.querySelector("h4.info");
            if (!header || !header.text.includes("Test")) { continue; }
            // Group files by test number (strip .in / .out extension)
            const tcMap = new Map<string, { input: string; output: string }>();
            for (const link of sub.querySelectorAll(".cfg-line a")) {
                const href = link.getAttribute("href") || "";
                const filename = href.split("/").pop()?.split("?")[0] || "";
                const base = filename.replace(/\.(in|out)$/, "");
                if (!base) { continue; }
                if (!tcMap.has(base)) { tcMap.set(base, { input: "", output: "" }); }
                const tc = tcMap.get(base)!;
                if (filename.endsWith(".in")) { tc.input = href; }
                else if (filename.endsWith(".out")) { tc.output = href; }
            }
            // Stable sort by numeric prefix (1, 2, 10, ...)
            const sorted = [...tcMap.entries()].sort((a, b) => {
                const na = parseInt(a[0]) || 0;
                const nb = parseInt(b[0]) || 0;
                return na !== nb ? na - nb : a[0].localeCompare(b[0]);
            });
            for (const [base, tc] of sorted) {
                testCases.push({ name: base, hint: "", visible: true, input: tc.input, output: tc.output });
            }
            break; // only use first matching section
        }
        // Parse grade/score
        let grade: string | undefined;
        const gradeEl = root.querySelector(".grade, .score, .points, .ass-grade");
        if (gradeEl) {
            grade = gradeEl.text.trim();
        }
        // Parse deadline from config options
        let deadline: string | undefined;
        for (const group of optionGroups) {
            for (const opt of group.options) {
                if (opt.name.toLowerCase().includes("deadline") || opt.name.toLowerCase().includes("due")) {
                    deadline = opt.value;
                    break;
                }
            }
            if (deadline) { break; }
        }
        return {
            node: { title: "", path, submittable: true, icon: "code" },
            options: optionGroups,
            testCases,
            grade,
            deadline,
        };
    }
    
    public async submitFiles(assignmentPath: string, filePaths: string[]): Promise<{ success: boolean; error?: string; resultsPath?: string }> {
        // Normalize path: strip any accidental /course prefix (if navigation API returned it)
        const normalizedPath = assignmentPath.startsWith('/course/')
            ? assignmentPath.slice('/course'.length)
            : assignmentPath;
        console.log(`[THEMIS] submitFiles: assignmentPath="${assignmentPath}", normalized="${normalizedPath}"`);
        // The CSRF token is baked into the form action URL as a query parameter:
        // action="/submit/PATH?_csrf=TOKEN&sudo=STUDENTID"
        // Extract that exact URL from the assignment page.
        const page = await this.get(`/course${normalizedPath}`);
        // Normalize to string — axios may return a Buffer when Content-Encoding: gzip
        const pageStr: string = typeof page.data === 'string' ? page.data : page.data.toString('utf8');
        console.log(`[THEMIS] submitFiles: GET /course${normalizedPath} → status=${page.status}, dataType=${typeof page.data}, length=${pageStr.length}, hasForm=${pageStr.includes('action="/submit/')}, isLoggedIn=${pageStr.includes('/log/out')}`);
        const root = parse(pageStr);
        const submitForm = root.querySelector("form[action*='/submit/']");
        if (!submitForm) {
            // Give a more specific error based on page content
            if (page.status >= 300 || !pageStr.includes('ass-config')) {
                return { success: false, error: "Not logged in or the assignment page could not be loaded. Please log in again via the Themis sidebar." };
            }
            return { success: false, error: "The assignment is not open for submissions (no submit form found). Check the submission deadline on Themis." };
        }
        const formAction = submitForm.getAttribute("action") || "";
        // Detect language from form metadata (data-suffixes maps extension→lang, data-languages is default lang)
        const defaultLang = submitForm.getAttribute("data-languages") || "";
        const suffixesRaw = submitForm.getAttribute("data-suffixes") || "{}";
        let suffixMap: Record<string, string> = {};
        try { suffixMap = JSON.parse(suffixesRaw); } catch { /* ignore */ }
        // Determine judge language from submitted file extensions
        let judgeLanguage = defaultLang || "none";
        for (const fp of filePaths) {
            const ext = fp.slice(fp.lastIndexOf(".") + 1).toLowerCase();
            if (suffixMap[ext]) { judgeLanguage = suffixMap[ext]; break; }
        }
        const form = new FormData();
        for (const fp of filePaths) {
            form.append("files[]", fs.createReadStream(fp));
        }
        // These fields are required for Themis to start the judge
        form.append("judgenow", "true");
        form.append("judgeLanguage", judgeLanguage);
        try {
            const url = `${BASE_URL}${formAction}`;
            const resp = await axios.post(url, form, {
                headers: {
                    Cookie: this.getCookieStringForUrl(url),
                    ...form.getHeaders(),
                },
                maxRedirects: 0,
                validateStatus: () => true,
            });
            this.storeCookiesFromUrl(url, resp);
            if (resp.status === 302 || resp.status === 301) {
                const location = resp.headers["location"] || "";
                return { success: true, resultsPath: location };
            }
            // Check for error in response body
            if (resp.status >= 400) {
                const pageRoot = parse(resp.data);
                const errorEl = pageRoot.querySelector(".error, .alert-danger, .alert");
                const errorMsg = errorEl ? errorEl.text.trim() : `Submission failed (HTTP ${resp.status})`;
                return { success: false, error: errorMsg };
            }
            // 200 with redirect in body means success — try to find results link
            if (typeof resp.data === "string") {
                const locMatch = resp.data.match(/href="(\/stats[^"]+)"/);
                if (locMatch) {
                    return { success: true, resultsPath: locMatch[1] };
                }
            }
            return { success: true, resultsPath: `/stats${assignmentPath}/@latest` };
        } catch (err: any) {
            return { success: false, error: err.message || "Submission failed" };
        }
    }
    
    public async getSubmissionHistory(assignmentPath: string): Promise<SubmissionSummary[]> {
        const resp = await this.get(`/stats${assignmentPath}`);
        const root = parse(resp.data);
        const submissions: SubmissionSummary[] = [];
        const THEMIS_STATUSES = [
            "passed", "failed", "error", "pending", "queued", "none",
            "compilerr", "runtimerr", "timeout", "outlimit", "diff", "deadline",
        ];
        // Helper to extract Themis status from element's class attribute
        const extractStatus = (el: any): string => {
            const classAttr = el?.getAttribute?.("class") || "";
            const classes = classAttr.split(/\s+/);
            for (const cls of classes) {
                if (THEMIS_STATUSES.includes(cls)) { return cls; }
            }
            return "unknown";
        };
        // Each submission on the stats page is a <section class="submission border {status}">
        const sections = root.querySelectorAll("section.submission");
        for (const section of sections) {
            // Status from CSS classes
            const status = extractStatus(section);
            // Link: <a href="/submission{path}"> inside header
            const link = section.querySelector("a[href*='/submission']");
            const href = link?.getAttribute("href") || "";
            const title = link ? link.text.trim() : "";
            // Score/percentage from <text class="percentage">
            const pctEl = section.querySelector("text.percentage");
            const score = pctEl ? pctEl.text.trim() : undefined;
            // Date from Details cfg-container: "Submitted on" config line
            let date = title;
            const cfgLines = section.querySelectorAll(".cfg-line");
            for (const cfg of cfgLines) {
                const key = cfg.querySelector(".cfg-key");
                const val = cfg.querySelector(".cfg-val");
                if (key && val && key.text.trim().includes("Submitted")) {
                    date = val.text.trim();
                    break;
                }
            }
            if (href) {
                submissions.push({ path: href, date, status, score });
            }
        }
        return submissions;
    }
    
    public async fetchRawFile(urlOrPath: string): Promise<string> {
        const rawUrl = new URL(urlOrPath, BASE_URL);
        if (rawUrl.pathname.startsWith('/file/') && rawUrl.searchParams.get('raw') !== 'true') {
            rawUrl.searchParams.set('raw', 'true');
        }
        const url = rawUrl.toString();
        const resp = await axios.get(url, {
            headers: { Cookie: this.getCookieStringForUrl(url) },
            responseType: 'text',
            validateStatus: () => true,
        });
        this.storeCookiesFromUrl(url, resp);
        if (resp.status !== 200) {
            throw new Error(`Failed to fetch ${url}: HTTP ${resp.status}`);
        }
        return typeof resp.data === 'string' ? resp.data : resp.data.toString('utf8');
    }
    
    public async downloadTestInputs(assignmentPath: string): Promise<{ name: string; content: string }[]> {
        const normalizedPath = assignmentPath.startsWith('/course/')
            ? assignmentPath.slice('/course'.length)
            : assignmentPath;
        const resp = await this.get(`/course${normalizedPath}`);
        const pageStr = typeof resp.data === 'string' ? resp.data : resp.data.toString('utf8');
        const root = parse(pageStr);
        const results: { name: string; content: string }[] = [];
        // Find the "Test cases" subsection (same structure as getAssignment)
        const subsections = root.querySelectorAll(".subsec.round.shade");
        let tcLinks: string[] = [];
        for (const sub of subsections) {
            const header = sub.querySelector("h4.info");
            if (!header || !header.text.includes("Test")) { continue; }
            for (const link of sub.querySelectorAll(".cfg-line a")) {
                const href = link.getAttribute("href");
                if (href) { tcLinks.push(href); }
            }
            break;
        }
        for (const href of tcLinks) {
            const name = href.split("/").pop()?.split("?")[0] || "file";
            try {
                const content = await this.fetchRawFile(href);
                results.push({ name, content });
            } catch { /* skip failed downloads */ }
        }
        return results;
    }
    
    public async getResults(path: string): Promise<SubmissionResult> {
        // path may be /stats/... or /submission/.../@ submissions/...
        const resp = await this.get(path);
        const html: string = resp.data;
        return this.parseResults(html);
    }
    public parseResults(html: string): SubmissionResult {
        const root = parse(html);
        // All Themis statuses as defined by the judge server
        const THEMIS_STATUSES: ThemisStatus[] = [
            "passed", "failed", "error", "pending", "queued", "none",
            "compilerr", "runtimerr", "timeout", "outlimit", "diff", "deadline",
        ];
        // Helper to extract Themis status from element's class attribute
        const extractStatus = (el: any): ThemisStatus => {
            const classAttr = el?.getAttribute?.("class") || "";
            const classes = classAttr.split(/\s+/);
            for (const cls of classes) {
                if (THEMIS_STATUSES.includes(cls as ThemisStatus)) {
                    return cls as ThemisStatus;
                }
            }
            return "pending";
        };
        // Trust Themis: the rendered submission's <section class="submission border {{status}}">
        // is the source of truth for the overall status. No fallbacks, no aggregation across
        // test cases — those would race ahead of the server's own state machine.
        const section = root.querySelector("section.submission");
        let overallStatus: ThemisStatus = "pending";
        if (section) {
            overallStatus = extractStatus(section);
        }
                let percentage: number | undefined;
        const pctEl = root.querySelector("text.percentage");
        if (pctEl) {
            const pctMatch = pctEl.text.trim().match(/(\d+(?:\.\d+)?)/);
            if (pctMatch) { percentage = parseFloat(pctMatch[1]); }
        }
                const testCases: TestCaseResult[] = [];
        const rows = root.querySelectorAll("tr.sub-casetop");
        for (const row of rows) {
            // Test name: <td class="sub-casename"><strong>name</strong></td>
            const nameEl = row.querySelector("td.sub-casename strong");
            const name = nameEl ? nameEl.text.trim() : "Test";
            // Each test case spans 4 sibling rows (sub-casetop + 3 follow-ups).
            // Walk forward in the parent's children to scoop up the case-* file links.
            let inputUrl: string | undefined;
            let expectedUrl: string | undefined;
            let actualUrl: string | undefined;
            let errorUrl: string | undefined;
            let diffUrl: string | undefined;
            const parent = (row as any).parentNode;
            if (parent && Array.isArray(parent.childNodes)) {
                const siblings = parent.childNodes.filter((n: any) => n.tagName === "TR");
                const idx = siblings.indexOf(row);
                if (idx >= 0) {
                    const block = siblings.slice(idx, idx + 4);
                    const pickHref = (el: any) => el?.getAttribute?.("href") || undefined;
                    for (const tr of block) {
                        if (!inputUrl)    { inputUrl    = pickHref(tr.querySelector("a.case-stdin")); }
                        if (!expectedUrl) { expectedUrl = pickHref(tr.querySelector("a.case-refout")); }
                        if (!actualUrl)   { actualUrl   = pickHref(tr.querySelector("a.case-stdout")); }
                        if (!errorUrl)    { errorUrl    = pickHref(tr.querySelector("a.case-stderr")); }
                        if (!diffUrl)     { diffUrl     = pickHref(tr.querySelector("a.case-diff")); }
                    }
                }
            }
            // Status: <td class="status-icon {status}"> — extract status from class
            const statusTd = row.querySelector("td.status-icon");
            let status: ThemisStatus = "pending";
            if (statusTd) {
                status = extractStatus(statusTd);
            }
            // Message & grade from td.status-icon text content: "Status Name: message | grade"
            let message: string | undefined;
            let grade: string | undefined;
            if (statusTd) {
                const text = statusTd.text.trim();
                // Format: "Status Name: message | grade" or "Status Name | grade"
                const pipeIdx = text.lastIndexOf("|");
                if (pipeIdx >= 0) {
                    grade = text.slice(pipeIdx + 1).trim() || undefined;
                }
                const mainText = pipeIdx >= 0 ? text.slice(0, pipeIdx).trim() : text;
                const colonIdx = mainText.indexOf(":");
                if (colonIdx >= 0) {
                    message = mainText.slice(colonIdx + 1).trim() || undefined;
                }
            }
            // Hint: in the next <tr>, look for <span id="show-hint-text-{name}" hidden>
            let hint: string | undefined;
            const hintSpans = root.querySelectorAll(`span[id^="show-hint-text-"]`);
            for (const span of hintSpans) {
                if (span.getAttribute("id") === `show-hint-text-${name}`) {
                    const strong = span.querySelector("strong");
                    hint = strong ? strong.text.trim() : span.text.replace(/^Hint:\s*/i, "").trim();
                    if (!hint) { hint = undefined; }
                    break;
                }
            }
            testCases.push({ name, status, message, grade, hint, inputUrl, expectedUrl, actualUrl, errorUrl, diffUrl });
        }
                const messagesEl = root.querySelector("ul.sub-messages");
        let summary: string | undefined;
        if (messagesEl) {
            summary = messagesEl.text.trim() || undefined;
        }
        if (!summary && percentage !== undefined) {
            summary = `${percentage}%`;
        }
        return { status: overallStatus, testCases, summary, percentage };
    }
    
    private socket: Socket | null = null;
    private watchedPath: string | null = null;
    public watchResults(path: string, onUpdate: (result: SubmissionResult) => void): void {
        this.unwatchResults();
        // Themis' socket server runs Path(data.path) and joins rooms based on the canonical
        // assignment-relative path. Route prefixes like "/submission" or "/stats" must be
        // stripped, otherwise they'd be parsed as part of the assignment and we'd join the
        // wrong room (and never receive judging updates).
        const watchPath = path
            .replace(/^\/submission(?=\/)/, "")
            .replace(/^\/stats(?=\/)/, "");
        const cookies = this.getCookieStringForUrl(BASE_URL);
        this.socket = io(`${BASE_URL}/submission`, {
            transports: ["websocket", "polling"],
            extraHeaders: { Cookie: cookies },
            withCredentials: true,
        });
        this.watchedPath = watchPath;
        this.socket.on("connect", () => {
            console.log("[THEMIS] socket.io connected, watching", watchPath);
            this.socket!.emit("watch", { path: watchPath, op: "replace", open: "true" });
        });
        this.socket.on("submission", (data: any) => {
            console.log("[THEMIS] socket.io submission event received");
            if (data && data.html) {
                const result = this.parseResults(data.html);
                onUpdate(result);
            }
        });
        this.socket.on("disconnect", () => {
            console.log("[THEMIS] socket.io disconnected");
        });
        this.socket.on("connect_error", (err: any) => {
            console.error("[THEMIS] socket.io connect_error:", err.message);
        });
    }
    public unwatchResults(): void {
        if (this.socket) {
            if (this.watchedPath) {
                this.socket.emit("unwatch", { path: this.watchedPath });
            }
            this.socket.disconnect();
            this.socket = null;
            this.watchedPath = null;
        }
    }
}
export default ThemisClient;