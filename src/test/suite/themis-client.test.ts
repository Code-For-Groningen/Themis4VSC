import * as assert from 'assert';

/**
 * Unit tests for ThemisClient parsing logic.
 * Tests the HTML parsing, form extraction, and result parsing
 * without needing a live Themis connection.
 * 
 * Run: npx mocha --require ts-node/register src/test/suite/themis-client.test.ts
 */


import { parse } from 'node-html-parser';

function extractFormData(html: string): { action: string; fields: Record<string, string> } | null {
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

function checkLoggedInPage(html: string): { name: string; studentId: string } | null {
    const match = /logged in as ([sp][0-9]{7})/i.exec(html);
    if (!match) { return null; }
    const studentId = match[1].toUpperCase();
    const nameMatch = html.match(/<a href="\/user"[^>]*>([^<]+)<\/a>/);
    const name = nameMatch ? nameMatch[1].trim() : studentId;
    return { name, studentId };
}

function parseNavigation(html: string): Array<{ title: string; path: string; submittable: boolean; icon: string }> {
    const root = parse(html);
    const links = root.querySelectorAll("a");
    const nodes: Array<{ title: string; path: string; submittable: boolean; icon: string }> = [];

    for (const link of links) {
        const href = link.getAttribute("href") || "";
        const navHref = link.getAttribute("data-navhref") || "";
        const classes = link.getAttribute("class") || "";
        const title = link.text.trim();
        if (!title) { continue; }

        const submittable = classes.includes("ass-submitable");
        let icon = "folder";
        const iconMatch = classes.match(/iconize\s+(\S+)/);
        if (iconMatch) { icon = iconMatch[1]; }

        let nodePath = "";
        if (navHref) {
            nodePath = navHref.replace(/^\/api\/navigation/, "");
        } else if (href) {
            nodePath = href.replace(/^\/course/, "");
        }

        nodes.push({ title, path: nodePath, submittable, icon });
    }
    return nodes;
}

function parseResults(html: string): { status: string; testCases: Array<{ name: string; status: string; details?: string }>; summary?: string } {
    const root = parse(html);
    const testCases: Array<{ name: string; status: string; details?: string }> = [];
    const rows = root.querySelectorAll("tr.cell-result, tr[class*='result'], .test-result");

    for (const row of rows) {
        const statusEl = row.querySelector(".status, td:first-child");
        const nameEl = row.querySelector(".test-name, td:nth-child(2)");
        const detailEl = row.querySelector(".output, td:nth-child(3)");

        const statusText = (statusEl ? statusEl.text.trim() : "").toLowerCase();
        let status = "pending";
        if (statusText.includes("pass") || statusText.includes("accept")) { status = "passed"; }
        else if (statusText.includes("fail") || statusText.includes("wrong") || statusText.includes("reject")) { status = "failed"; }
        else if (statusText.includes("error") || statusText.includes("crash")) { status = "error"; }
        else if (statusText.includes("run")) { status = "running"; }

        testCases.push({
            name: nameEl ? nameEl.text.trim() : "Test",
            status,
            details: detailEl ? detailEl.text.trim() : undefined,
        });
    }

    let overallStatus = "done";
    const statusIndicator = root.querySelector(".submission-status, .status-indicator, .judge-status");
    if (statusIndicator) {
        const text = statusIndicator.text.trim().toLowerCase();
        if (text.includes("error")) { overallStatus = "error"; }
        else if (text.includes("compil")) { overallStatus = "compiling"; }
        else if (text.includes("run")) { overallStatus = "running"; }
        else if (text.includes("judg")) { overallStatus = "judging"; }
    }

    const summaryEl = root.querySelector(".submission-summary, .verdict");
    const summary = summaryEl ? summaryEl.text.trim() : undefined;

    return { status: overallStatus, testCases, summary };
}


describe('ThemisClient Parsing Tests', () => {

    describe('extractFormData', () => {
        it('extracts action and hidden fields from auto-submit form', () => {
            const html = `
                <html><body onload="document.forms[0].submit()">
                    <form method="post" action="https://signon.rug.nl/nidp/saml2/sso">
                        <input type="hidden" name="SAMLRequest" value="PHNhbWxwOk...base64...">
                        <input type="hidden" name="RelayState" value="abc123">
                    </form>
                </body></html>`;
            const result = extractFormData(html);
            assert.ok(result);
            assert.strictEqual(result.action, "https://signon.rug.nl/nidp/saml2/sso");
            assert.strictEqual(result.fields["SAMLRequest"], "PHNhbWxwOk...base64...");
            assert.strictEqual(result.fields["RelayState"], "abc123");
        });

        it('extracts credential form fields', () => {
            const html = `
                <form name="IDPLogin" method="POST" action="/nidp/saml2/sso?id=100&sid=0&option=credential&sid=0">
                    <input type="hidden" name="option" value="credential">
                    <input type="hidden" name="target" value="https://myuniversity.rug.nl">
                    <input type="text" name="Ecom_User_ID" value="">
                    <input type="password" name="Ecom_Password" value="">
                </form>`;
            const result = extractFormData(html);
            assert.ok(result);
            assert.strictEqual(result.action, "/nidp/saml2/sso?id=100&sid=0&option=credential&sid=0");
            assert.strictEqual(result.fields["option"], "credential");
            assert.strictEqual(result.fields["target"], "https://myuniversity.rug.nl");
            assert.strictEqual(result.fields["Ecom_User_ID"], "");
            assert.strictEqual(result.fields["Ecom_Password"], "");
        });

        it('returns null for html without form', () => {
            const html = '<html><body><p>No form here</p></body></html>';
            const result = extractFormData(html);
            assert.strictEqual(result, null);
        });

        it('returns null for non-string input', () => {
            const result = extractFormData(undefined as any);
            assert.strictEqual(result, null);
        });

        it('handles empty form', () => {
            const html = '<form action="/test"></form>';
            const result = extractFormData(html);
            assert.ok(result);
            assert.strictEqual(result.action, "/test");
            assert.deepStrictEqual(result.fields, {});
        });
    });

    describe('checkLoggedInPage', () => {
        it('detects student login', () => {
            const html = '<html><body>You are logged in as s1234567 <a href="/user">John Doe</a></body></html>';
            const result = checkLoggedInPage(html);
            assert.ok(result);
            assert.strictEqual(result.studentId, "S1234567");
            assert.strictEqual(result.name, "John Doe");
        });

        it('detects staff login (p-number)', () => {
            const html = '<html>logged in as p1234567 <a href="/user">Prof Smith</a></html>';
            const result = checkLoggedInPage(html);
            assert.ok(result);
            assert.strictEqual(result.studentId, "P1234567");
            assert.strictEqual(result.name, "Prof Smith");
        });

        it('returns null for non-logged-in page', () => {
            const html = '<html><body>Please log in</body></html>';
            const result = checkLoggedInPage(html);
            assert.strictEqual(result, null);
        });

        it('uses studentId as name if no user link found', () => {
            const html = '<html>logged in as s9876543</html>';
            const result = checkLoggedInPage(html);
            assert.ok(result);
            assert.strictEqual(result.studentId, "S9876543");
            assert.strictEqual(result.name, "S9876543");
        });
    });

    describe('parseNavigation', () => {
        it('parses navigation links with data-navhref', () => {
            const html = `
                <a href="/course/2025-2026/os" data-navhref="/api/navigation/2025-2026/os" class="iconize icon-folder">Operating Systems</a>
                <a href="/course/2025-2026/os/lab1" data-navhref="/api/navigation/2025-2026/os/lab1" class="iconize icon-code ass-submitable">Lab 1</a>
            `;
            const nodes = parseNavigation(html);
            assert.strictEqual(nodes.length, 2);

            assert.strictEqual(nodes[0].title, "Operating Systems");
            assert.strictEqual(nodes[0].path, "/2025-2026/os");
            assert.strictEqual(nodes[0].submittable, false);
            assert.strictEqual(nodes[0].icon, "icon-folder");

            assert.strictEqual(nodes[1].title, "Lab 1");
            assert.strictEqual(nodes[1].path, "/2025-2026/os/lab1");
            assert.strictEqual(nodes[1].submittable, true);
            assert.strictEqual(nodes[1].icon, "icon-code");
        });

        it('parses links with href only (no data-navhref)', () => {
            const html = '<a href="/course/2025/test" class="iconize icon-folder">Test Course</a>';
            const nodes = parseNavigation(html);
            assert.strictEqual(nodes.length, 1);
            assert.strictEqual(nodes[0].path, "/2025/test");
        });

        it('skips links with empty text', () => {
            const html = '<a href="/course/empty" class="iconize icon-folder"></a><a href="/course/valid">Valid</a>';
            const nodes = parseNavigation(html);
            assert.strictEqual(nodes.length, 1);
            assert.strictEqual(nodes[0].title, "Valid");
        });

        it('returns empty array for empty html', () => {
            const nodes = parseNavigation('<div>no links</div>');
            assert.strictEqual(nodes.length, 0);
        });
    });

    describe('parseResults', () => {
        it('parses test results table with status cells', () => {
            const html = `
                <div class="judge-status">Done</div>
                <table>
                    <tr class="cell-result">
                        <td class="status">Accepted</td>
                        <td class="test-name">Test 1</td>
                        <td class="output">All good</td>
                    </tr>
                    <tr class="cell-result">
                        <td class="status">Wrong Answer</td>
                        <td class="test-name">Test 2</td>
                        <td class="output">Expected 42 got 0</td>
                    </tr>
                </table>
                <div class="verdict">1/2 passed</div>
            `;
            const result = parseResults(html);
            assert.strictEqual(result.status, "done");
            assert.strictEqual(result.testCases.length, 2);
            assert.strictEqual(result.testCases[0].status, "passed");
            assert.strictEqual(result.testCases[0].name, "Test 1");
            assert.strictEqual(result.testCases[1].status, "failed");
            assert.strictEqual(result.testCases[1].details, "Expected 42 got 0");
            assert.strictEqual(result.summary, "1/2 passed");
        });

        it('detects compiling status', () => {
            const html = '<div class="judge-status">Compiling...</div>';
            const result = parseResults(html);
            assert.strictEqual(result.status, "compiling");
        });

        it('detects running status', () => {
            const html = '<div class="submission-status">Running tests</div>';
            const result = parseResults(html);
            assert.strictEqual(result.status, "running");
        });

        it('detects error status', () => {
            const html = '<div class="status-indicator">Compilation Error</div>';
            const result = parseResults(html);
            assert.strictEqual(result.status, "error");
        });

        it('returns done with empty test cases for minimal html', () => {
            const html = '<div>some page</div>';
            const result = parseResults(html);
            assert.strictEqual(result.status, "done");
            assert.strictEqual(result.testCases.length, 0);
        });
    });

    describe('CSRF token extraction', () => {
        it('extracts CSRF from form hidden field', () => {
            const html = '<form><input type="hidden" name="_csrf" value="kX30sczr-iDOANSUIfz4SxwHcv5tcjOWGy3s"></form>';
            const match = html.match(/name="_csrf"[^>]*value="([^"]+)"/);
            assert.ok(match);
            assert.strictEqual(match[1], "kX30sczr-iDOANSUIfz4SxwHcv5tcjOWGy3s");
        });

        it('extracts CSRF from alternate format', () => {
            const html = '<input name="_csrf" value="abc123def">';
            const match = html.match(/_csrf"[^>]*value="([^"]+)"/);
            assert.ok(match);
            assert.strictEqual(match[1], "abc123def");
        });
    });

    describe('TOTP form extraction', () => {
        it('extracts TOTP input field name from xfactor form', () => {
            const html = `
                <form action="/nidp/saml2/sso" method="POST">
                    <input type="hidden" name="option" value="credential">
                    <input type="hidden" name="nfst" value="eyJ0eXAiOiJKV1QiLCJhbGciOiJ...">
                    <input type="text" name="Ecom_Token" placeholder="Enter code">
                </form>`;
            const totpInputMatch = html.match(/<input[^>]*type=["']text["'][^>]*name=["']([^"']+)["']/i);
            assert.ok(totpInputMatch);
            assert.strictEqual(totpInputMatch[1], "Ecom_Token");

            const formData = extractFormData(html);
            assert.ok(formData);
            assert.strictEqual(formData.fields["option"], "credential");
            assert.strictEqual(formData.fields["nfst"], "eyJ0eXAiOiJKV1QiLCJhbGciOiJ...");
        });
    });

    describe('Session cookie parsing', () => {
        it('parses Themis session cookie format', () => {
            const setCookieHeader = "session=s%3A7Y_aQ9CegRzyUg2BZs-uLje8TAHEuVI9.aDmcrPDI%2B%2FmLm57x43g4gBA2LP6n1BKN0U1yrNelzAg; Path=/; Expires=Fri, 20 Mar 2026 14:34:58 GMT; HttpOnly; Secure";
            const valueMatch = setCookieHeader.match(/^session=([^;]+)/);
            assert.ok(valueMatch);
            const decoded = decodeURIComponent(valueMatch[1]);
            assert.ok(decoded.startsWith("s:"));
            assert.ok(decoded.includes("."));
        });
    });
});
