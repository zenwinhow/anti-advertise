/**
 * 节点 IP 质量检测 · Surge Information Panel 脚本
 *
 * 与上游 Loon 版（MaYIHEI/paperclip · ipquality.js）不同：
 * Surge 的 generic 脚本只在 Information Panel 刷新时被触发，脚本上下文没有
 * 「用户当前选择的节点」输入。这里改用模块 #!arguments 里配置的 policy 名，
 * 并让所有出站请求带上 `policy: policyName`，让检测经过目标策略当前生效的节点。
 *
 * 检测项：
 *  - 出口 IP（ipify + ip-api + ipapi.is 交叉核对，缺失字段互补）
 *  - IP 类型属性（Datacenter/Residential 等）
 *  - 常见风险标记（Tor/Proxy/VPN/Abuser/Crawler）
 *  - 流媒体与 AI：Netflix、Disney+、YouTube Premium、ChatGPT、Gemini
 *
 * 面板样式随最高风险等级选择 good/info/alert/error。
 *
 * @Reference: MaYIHEI/paperclip <https://github.com/MaYIHEI/paperclip>
 * @Reference: xykt/IPQuality <https://github.com/xykt/IPQuality>
 */

const SCRIPT_VERSION = "surge.2026-07-21";

// $argument 来自模块的 `argument=` 字段，格式 key=value&key=value
const args = parseArgument(typeof $argument === "string" ? $argument : "");
const policyName = args.policy || "";
const mediaEnabled = readBool(args.media, true);
const maskIP = readBool(args.mask, false);
const netflixTitleID = args.netflix_title || "81280792"; // 非独占内容 ID，用于地区判定
const requestTimeout = clampNumber(args.timeout, 8, 3, 20);

console.log(`[ip-quality] version=${SCRIPT_VERSION} policy=${policyName || "(none)"} media=${mediaEnabled}`);

run().catch((err) => finishError(errorMessage(err)));

async function run() {
    const ip = await discoverIP();
    if (!ip) throw new Error("未获取到出口 IP");

    const [db, media] = await Promise.all([
        collectDatabases(ip),
        mediaEnabled ? collectMedia() : Promise.resolve([]),
    ]);

    render(ip, db, media);
}

/* ---------- 采集：出口 IP ---------- */
async function discoverIP() {
    const candidates = await Promise.all([
        capture(requestJson("https://api.ipify.org?format=json")),
        capture(requestJson("http://ip-api.com/json/?fields=status,message,query")),
    ]);
    for (const item of candidates) {
        if (!item.ok) continue;
        const val = item.value || {};
        const ip = val.ip || val.query;
        if (isIP(ip)) return ip;
    }
    return "";
}

/* ---------- 采集：IP 数据库 ---------- */
async function collectDatabases(ip) {
    const jobs = await Promise.all([
        capture(requestJson(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,timezone,isp,org,as,asname,mobile,proxy,hosting,query`)),
        capture(requestJson(`https://api.ipapi.is/?q=${ip}`)),
    ]);
    return {
        ipapi_com: jobs[0].ok ? jobs[0].value : null,
        ipapi_is: jobs[1].ok ? jobs[1].value : null,
    };
}

/* ---------- 采集：流媒体与 AI ---------- */
async function collectMedia() {
    const tests = [
        ["Netflix", testNetflix()],
        ["Disney+", testDisney()],
        ["YouTube Premium", testYouTube()],
        ["ChatGPT", testChatGPT()],
        ["Gemini", testGemini()],
    ];
    const results = await Promise.all(tests.map(([name, task]) =>
        capture(task).then((res) => ({
            name,
            ...(res.ok ? res.value : { status: "error", detail: res.error }),
        }))
    ));
    return results;
}

async function testNetflix() {
    // 请求一个非独占标题；能返回页面 = 至少 unblocked，从 country 元信息判定地区。
    const resp = await request("GET", `https://www.netflix.com/title/${netflixTitleID}`, {
        allowHttpErrors: true,
        headers: browserHeaders(),
    });
    if (resp.status === 404) return { status: "unavailable", detail: "标题在该地区不可用" };
    if (resp.status === 403 || resp.status === 451) return { status: "blocked" };
    if (resp.status >= 200 && resp.status < 400) {
        const region = matchOne(resp.body, /"requestCountry":\{"id":"([A-Z]{2})"/)
            || matchOne(resp.body, /data-country="([A-Z]{2})"/);
        return { status: "supported", region: region || "" };
    }
    return { status: "error", detail: `HTTP ${resp.status}` };
}

async function testDisney() {
    // Disney+ 首页对不受支持地区返回 302 到 unavailable 页；地区从 preview cookie 猜测。
    const resp = await request("GET", "https://www.disneyplus.com/", {
        allowHttpErrors: true,
        headers: browserHeaders(),
    });
    const location = valueAt(resp, "response.headers.Location") || valueAt(resp, "response.headers.location") || "";
    if (/unavailable/i.test(location) || /unavailable/i.test(resp.body || "")) {
        return { status: "unavailable" };
    }
    if (resp.status >= 200 && resp.status < 400) {
        const region = matchOne(resp.body || "", /"countryCode":"([A-Z]{2})"/)
            || matchOne(resp.body || "", /"region":"([A-Z]{2})"/);
        return { status: "supported", region: region || "" };
    }
    return { status: "error", detail: `HTTP ${resp.status}` };
}

async function testYouTube() {
    const resp = await request("GET", "https://www.youtube.com/premium", {
        allowHttpErrors: true,
        headers: browserHeaders(),
    });
    if (resp.status >= 400) return { status: "error", detail: `HTTP ${resp.status}` };
    if (/Premium is not available in your country/i.test(resp.body || "")) {
        return { status: "unavailable" };
    }
    const region = matchOne(resp.body || "", /"INNERTUBE_CONTEXT_GL":"([A-Z]{2})"/);
    return { status: "supported", region: region || "" };
}

async function testChatGPT() {
    const resp = await request("GET", "https://chat.openai.com/cdn-cgi/trace", {
        allowHttpErrors: true,
    });
    if (resp.status < 200 || resp.status >= 400) return { status: "error", detail: `HTTP ${resp.status}` };
    // Cloudflare trace 返回类 KV 文本
    const loc = matchOne(resp.body || "", /loc=([A-Z]{2})/);
    const warp = matchOne(resp.body || "", /warp=([a-z]+)/);
    if (warp && warp !== "off") return { status: "supported", region: loc || "", detail: `warp=${warp}` };
    return { status: "supported", region: loc || "" };
}

async function testGemini() {
    const resp = await request("GET", "https://gemini.google.com/", {
        allowHttpErrors: true,
        headers: browserHeaders(),
    });
    if (resp.status === 451) return { status: "unavailable", detail: "451" };
    if (resp.status >= 200 && resp.status < 400) {
        if (/gemini is not available in your country/i.test(resp.body || "")) {
            return { status: "unavailable" };
        }
        return { status: "supported" };
    }
    return { status: "error", detail: `HTTP ${resp.status}` };
}

/* ---------- 渲染 ---------- */
function render(ip, db, media) {
    const basic = buildBasic(ip, db);
    const risks = buildRisks(db);
    const worst = risks.reduce((acc, r) => Math.max(acc, r.severity), 0);
    const style = severityToStyle(worst);

    const lines = [];
    lines.push("── 基础");
    lines.push(`IP · ${maskIPAddress(basic.ip)}`);
    if (basic.region) lines.push(`地区 · ${basic.region}`);
    if (basic.city) lines.push(`城市 · ${basic.city}`);
    if (basic.asn || basic.organization) lines.push(`网络 · ${[basic.asn, basic.organization].filter(Boolean).join(" ")}`);
    if (basic.timezone) lines.push(`时区 · ${basic.timezone}`);

    lines.push("── 类型");
    for (const row of buildTypes(db)) lines.push(row);

    if (risks.length) {
        lines.push("── 风险");
        for (const r of risks) lines.push(`${r.name} · ${r.text}`);
    }

    if (mediaEnabled) {
        lines.push("── 流媒体 / AI");
        for (const m of media) {
            const icon = statusIcon(m.status);
            const detail = m.region ? ` [${m.region}]` : (m.detail ? ` (${m.detail})` : "");
            lines.push(`${icon} ${m.name}${detail}`);
        }
    }

    lines.push("");
    lines.push(`更新 · ${policyName ? `via ${policyName}` : "当前策略"}`);

    $done({
        title: "节点 IP 质量",
        content: lines.join("\n"),
        style,
        icon: "shield.lefthalf.filled",
    });
}

function buildBasic(ip, db) {
    const a = db.ipapi_com || {};
    const b = db.ipapi_is || {};
    const bLocation = b.location || {};
    const bAsn = b.asn || {};
    const bCompany = b.company || {};
    const country = a.countryCode || bLocation.country_code || "";
    const countryName = a.country || bLocation.country || "";
    const city = firstNonEmpty(a.city, bLocation.city);
    const region = firstNonEmpty(a.regionName, bLocation.state);
    const asn = a.as || (bAsn.asn ? `AS${bAsn.asn}` : "") || "";
    const org = firstNonEmpty(a.asname, a.org, bAsn.org, bCompany.name);
    const flag = country ? flagEmoji(country) + " " : "";
    return {
        ip,
        region: countryName ? `${flag}${countryName}${country ? ` (${country})` : ""}` : (country ? `${flag}${country}` : ""),
        city: [region, city].filter(Boolean).join(" · "),
        asn,
        organization: org,
        timezone: firstNonEmpty(a.timezone, bLocation.timezone),
    };
}

function buildTypes(db) {
    const a = db.ipapi_com || {};
    const b = db.ipapi_is || {};
    const rows = [];
    if (a.mobile) rows.push("移动");
    if (a.hosting) rows.push("数据中心 (ip-api)");
    if (b.is_datacenter) rows.push("数据中心 (ipapi.is)");
    if (b.is_mobile) rows.push("移动 (ipapi.is)");
    if (valueAt(b, "traits.is_residential_proxy")) rows.push("住宅代理");
    if (b.is_anycast) rows.push("Anycast");
    if (!rows.length) rows.push("普通");
    return rows.map((r) => `· ${r}`);
}

function buildRisks(db) {
    const a = db.ipapi_com || {};
    const b = db.ipapi_is || {};
    const out = [];
    if (a.proxy) out.push({ name: "ip-api proxy", text: "命中", severity: 3 });
    if (b.is_tor) out.push({ name: "Tor", text: "命中", severity: 4 });
    if (b.is_proxy) out.push({ name: "ipapi.is proxy", text: "命中", severity: 3 });
    if (b.is_vpn) out.push({ name: "VPN", text: "命中", severity: 2 });
    if (b.is_abuser) out.push({ name: "Abuser", text: "命中", severity: 3 });
    if (b.is_crawler) out.push({ name: "Crawler", text: "命中", severity: 2 });
    return out;
}

function severityToStyle(severity) {
    if (severity >= 3) return "alert";
    if (severity >= 2) return "info";
    return "good";
}

function statusIcon(status) {
    switch (status) {
        case "supported": return "✓";
        case "unavailable": return "✗";
        case "blocked": return "✗";
        default: return "?";
    }
}

/* ---------- 工具 ---------- */
function parseArgument(raw) {
    const out = {};
    if (!raw) return out;
    for (const pair of raw.split("&")) {
        const idx = pair.indexOf("=");
        if (idx <= 0) continue;
        out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
    return out;
}

function readBool(v, fallback) {
    if (typeof v === "undefined" || v === null || v === "") return fallback;
    if (typeof v === "boolean") return v;
    const s = String(v).toLowerCase();
    if (s === "false" || s === "0" || s === "no") return false;
    if (s === "true" || s === "1" || s === "yes") return true;
    return fallback;
}

function clampNumber(v, fallback, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function browserHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    };
}

function requestJson(url, options) {
    return request("GET", url, options).then((r) => {
        try { return JSON.parse(r.body); }
        catch (_) { throw new Error("JSON 解析失败"); }
    });
}

function request(method, url, options) {
    const config = options || {};
    return new Promise((resolve, reject) => {
        const req = {
            url,
            headers: config.headers || {},
            timeout: config.timeout || requestTimeout,
        };
        if (policyName) req.policy = policyName;
        const cb = (error, response, body) => {
            if (error) return reject(new Error(String(error)));
            const status = Number(response && (response.status || response.statusCode));
            if (!config.allowHttpErrors && (!Number.isFinite(status) || status < 200 || status >= 400)) {
                return reject(new Error(`HTTP ${status || "?"}`));
            }
            resolve({ status, body: String(body || ""), response: response || {} });
        };
        const verb = String(method).toUpperCase();
        if (verb === "POST") $httpClient.post(req, cb);
        else $httpClient.get(req, cb);
    });
}

function capture(promise) {
    return Promise.resolve(promise).then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error: errorMessage(error) })
    );
}

function isIP(v) {
    if (!v || typeof v !== "string") return false;
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(v) || /^[0-9a-fA-F:]+$/.test(v);
}

function maskIPAddress(ip) {
    if (!maskIP || !ip) return ip;
    if (ip.indexOf(":") >= 0) return ip.replace(/:[^:]+:[^:]+$/, "::****");
    return ip.replace(/(\d+\.\d+\.)\d+\.\d+/, "$1***.***");
}

function flagEmoji(code) {
    const s = String(code || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(s)) return "";
    return String.fromCodePoint(...[...s].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
}

function valueAt(obj, path) {
    if (!obj) return undefined;
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
        if (cur === null || typeof cur !== "object") return undefined;
        cur = cur[p];
    }
    return cur;
}

function matchOne(text, regex) {
    if (!text) return "";
    const m = text.match(regex);
    return m ? m[1] : "";
}

function firstNonEmpty(...values) {
    for (const v of values) if (v !== undefined && v !== null && v !== "") return v;
    return "";
}

function errorMessage(err) {
    if (!err) return "";
    if (err instanceof Error) return err.message || String(err);
    return String(err);
}

function finishError(message) {
    console.log(`[ip-quality] ${message}`);
    $done({
        title: "节点 IP 质量",
        content: `检测失败：${message}`,
        style: "error",
        icon: "exclamationmark.triangle.fill",
    });
}
