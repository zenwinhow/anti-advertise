/**
 * 节点 IP 质量检测 · Egern generic 脚本（iOS Widget 渲染）
 *
 * 用法：将本脚本挂到 Egern 模块的 scriptings.generic 上，模块通过环境变量 IPQ_POLICY
 * 指定用于检测的策略名；`ctx.http` 会带上 policy 参数，请求经该策略当前生效的节点。
 *
 * 输出：Widget DSL JSON。样式随最高风险等级切换背景色。
 *
 * 检测项与 surge-panel.js 保持一致：
 *  - IP + 地区 + ASN
 *  - 类型（Datacenter/Residential/Mobile/Anycast）
 *  - Tor / Proxy / VPN / Abuser / Crawler 风险标记
 *  - Netflix / Disney+ / YouTube Premium / ChatGPT / Gemini 可用性
 */

export default async function (ctx) {
    const env = ctx.env || {};
    const policy = env.IPQ_POLICY || "";
    const mediaEnabled = readBool(env.IPQ_MEDIA, true);
    const maskIP = readBool(env.IPQ_MASK, false);
    const netflixTitle = env.IPQ_NETFLIX_TITLE || "81280792";
    const timeoutMs = Number(env.IPQ_TIMEOUT_MS) || 8000;

    const state = { ctx, policy, timeoutMs };

    try {
        const ip = await discoverIP(state);
        if (!ip) return errorWidget("未获取到出口 IP");

        const [db, media] = await Promise.all([
            collectDatabases(state, ip),
            mediaEnabled ? collectMedia(state, netflixTitle) : Promise.resolve([]),
        ]);
        return renderWidget({
            family: ctx.widgetFamily,
            ip,
            db,
            media,
            mediaEnabled,
            maskIP,
            policy,
        });
    } catch (err) {
        return errorWidget(errorMessage(err));
    }
}

/* ---------- 采集 ---------- */
async function discoverIP(state) {
    const jobs = await Promise.all([
        capture(fetchJson(state, "https://api.ipify.org?format=json")),
        capture(fetchJson(state, "http://ip-api.com/json/?fields=status,message,query")),
    ]);
    for (const item of jobs) {
        if (!item.ok) continue;
        const v = item.value || {};
        const ip = v.ip || v.query;
        if (isIP(ip)) return ip;
    }
    return "";
}

async function collectDatabases(state, ip) {
    const [a, b] = await Promise.all([
        capture(fetchJson(state, `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,timezone,isp,org,as,asname,mobile,proxy,hosting,query`)),
        capture(fetchJson(state, `https://api.ipapi.is/?q=${ip}`)),
    ]);
    return {
        ipapi_com: a.ok ? a.value : null,
        ipapi_is: b.ok ? b.value : null,
    };
}

async function collectMedia(state, netflixTitle) {
    const tasks = [
        ["Netflix", testNetflix(state, netflixTitle)],
        ["Disney+", testDisney(state)],
        ["YouTube", testYouTube(state)],
        ["ChatGPT", testChatGPT(state)],
        ["Gemini", testGemini(state)],
    ];
    const results = await Promise.all(tasks.map(([name, task]) =>
        capture(task).then((res) => ({
            name,
            ...(res.ok ? res.value : { status: "error", detail: res.error }),
        }))
    ));
    return results;
}

async function testNetflix(state, titleID) {
    const resp = await fetchRaw(state, "GET", `https://www.netflix.com/title/${titleID}`, {
        allowHttpErrors: true,
        headers: browserHeaders(),
    });
    if (resp.status === 404) return { status: "unavailable" };
    if (resp.status === 403 || resp.status === 451) return { status: "blocked" };
    if (resp.status >= 200 && resp.status < 400) {
        const region = matchOne(resp.text, /"requestCountry":\{"id":"([A-Z]{2})"/);
        return { status: "supported", region: region || "" };
    }
    return { status: "error", detail: `HTTP ${resp.status}` };
}

async function testDisney(state) {
    const resp = await fetchRaw(state, "GET", "https://www.disneyplus.com/", {
        allowHttpErrors: true,
        headers: browserHeaders(),
    });
    if (/unavailable/i.test(resp.text || "")) return { status: "unavailable" };
    if (resp.status >= 200 && resp.status < 400) {
        const region = matchOne(resp.text || "", /"countryCode":"([A-Z]{2})"/)
            || matchOne(resp.text || "", /"region":"([A-Z]{2})"/);
        return { status: "supported", region: region || "" };
    }
    return { status: "error", detail: `HTTP ${resp.status}` };
}

async function testYouTube(state) {
    const resp = await fetchRaw(state, "GET", "https://www.youtube.com/premium", {
        allowHttpErrors: true,
        headers: browserHeaders(),
    });
    if (resp.status >= 400) return { status: "error", detail: `HTTP ${resp.status}` };
    if (/Premium is not available in your country/i.test(resp.text || "")) {
        return { status: "unavailable" };
    }
    const region = matchOne(resp.text || "", /"INNERTUBE_CONTEXT_GL":"([A-Z]{2})"/);
    return { status: "supported", region: region || "" };
}

async function testChatGPT(state) {
    const resp = await fetchRaw(state, "GET", "https://chat.openai.com/cdn-cgi/trace", {
        allowHttpErrors: true,
    });
    if (resp.status < 200 || resp.status >= 400) return { status: "error", detail: `HTTP ${resp.status}` };
    const loc = matchOne(resp.text || "", /loc=([A-Z]{2})/);
    return { status: "supported", region: loc || "" };
}

async function testGemini(state) {
    const resp = await fetchRaw(state, "GET", "https://gemini.google.com/", {
        allowHttpErrors: true,
        headers: browserHeaders(),
    });
    if (resp.status === 451) return { status: "unavailable" };
    if (resp.status >= 200 && resp.status < 400) {
        if (/gemini is not available in your country/i.test(resp.text || "")) {
            return { status: "unavailable" };
        }
        return { status: "supported" };
    }
    return { status: "error", detail: `HTTP ${resp.status}` };
}

/* ---------- Widget 渲染 ---------- */
function renderWidget({ family, ip, db, media, mediaEnabled, maskIP, policy }) {
    const basic = buildBasic(ip, db, maskIP);
    const risks = buildRisks(db);
    const worst = risks.reduce((acc, r) => Math.max(acc, r.severity), 0);
    const bg = severityBackground(worst);

    const isSmall = family === "systemSmall" || family === "accessoryCircular"
        || family === "accessoryRectangular" || family === "accessoryInline";

    const children = [];

    // Header
    children.push(text("节点 IP 质量", { size: "caption1", weight: "semibold" }, "#FFFFFFCC"));
    children.push(spacer(2));

    // IP + 地区
    children.push(text(basic.ip || "IP 未知", { size: "title3", weight: "bold" }, "#FFFFFF"));
    if (basic.region) {
        children.push(text(basic.region, { size: "footnote" }, "#FFFFFFDD"));
    }

    if (!isSmall) {
        // ASN + Organization
        if (basic.asn || basic.organization) {
            children.push(spacer(2));
            children.push(text([basic.asn, basic.organization].filter(Boolean).join(" "), { size: "caption2" }, "#FFFFFFCC"));
        }

        // 类型
        const types = buildTypes(db);
        if (types.length) {
            children.push(spacer(6));
            children.push(text("类型 · " + types.join(" / "), { size: "caption2" }, "#FFFFFFCC"));
        }

        // 风险
        if (risks.length) {
            children.push(spacer(2));
            children.push(text("风险 · " + risks.map((r) => r.name).join(" / "), { size: "caption2" }, riskTint(worst)));
        }

        // 流媒体
        if (mediaEnabled) {
            children.push(spacer(6));
            const line = media.map((m) => `${statusIcon(m.status)} ${m.name}`).join("  ");
            children.push(text(line, { size: "caption2" }, "#FFFFFFDD"));
        }
    } else {
        // 小尺寸只显示风险/类型汇总
        if (risks.length) {
            children.push(spacer(4));
            children.push(text(`风险 · ${risks.map((r) => r.name).join(", ")}`, { size: "caption2" }, riskTint(worst)));
        }
    }

    children.push(spacer(4));
    children.push(text(policy ? `via ${policy}` : "当前策略", { size: "caption2" }, "#FFFFFF88"));

    return {
        type: "widget",
        backgroundColor: bg,
        padding: 12,
        children: [{
            type: "vstack",
            spacing: 0,
            alignment: "leading",
            children,
        }],
    };
}

function buildBasic(ip, db, maskIP) {
    const a = db.ipapi_com || {};
    const b = db.ipapi_is || {};
    const bLocation = b.location || {};
    const bAsn = b.asn || {};
    const bCompany = b.company || {};
    const country = a.countryCode || bLocation.country_code || "";
    const countryName = a.country || bLocation.country || "";
    const city = firstNonEmpty(a.city, bLocation.city);
    const asn = a.as || (bAsn.asn ? `AS${bAsn.asn}` : "") || "";
    const org = firstNonEmpty(a.asname, a.org, bAsn.org, bCompany.name);
    const flag = country ? flagEmoji(country) + " " : "";
    const regionText = countryName
        ? `${flag}${countryName}${city ? " · " + city : ""}`
        : (country ? `${flag}${country}` : "");
    return {
        ip: maskIP ? maskIPAddress(ip) : ip,
        region: regionText,
        asn,
        organization: org,
    };
}

function buildTypes(db) {
    const a = db.ipapi_com || {};
    const b = db.ipapi_is || {};
    const rows = [];
    if (a.mobile || b.is_mobile) rows.push("移动");
    if (a.hosting || b.is_datacenter) rows.push("数据中心");
    if ((b.traits && b.traits.is_residential_proxy)) rows.push("住宅代理");
    if (b.is_anycast) rows.push("Anycast");
    if (!rows.length) rows.push("普通");
    return rows;
}

function buildRisks(db) {
    const a = db.ipapi_com || {};
    const b = db.ipapi_is || {};
    const out = [];
    if (b.is_tor) out.push({ name: "Tor", severity: 4 });
    if (a.proxy || b.is_proxy) out.push({ name: "Proxy", severity: 3 });
    if (b.is_vpn) out.push({ name: "VPN", severity: 2 });
    if (b.is_abuser) out.push({ name: "Abuser", severity: 3 });
    if (b.is_crawler) out.push({ name: "Crawler", severity: 2 });
    return out;
}

/* ---------- Widget 辅助 ---------- */
function text(str, font, color) {
    return { type: "text", text: String(str), font, textColor: color };
}

function spacer(len) {
    return { type: "spacer", minLength: len };
}

function severityBackground(severity) {
    if (severity >= 3) return "#8E1A1A";   // 深红
    if (severity >= 2) return "#7A5A0C";   // 深黄
    return "#1F5C3D";                       // 深绿
}

function riskTint(severity) {
    if (severity >= 3) return "#FFB4B4";
    if (severity >= 2) return "#FFE49A";
    return "#B4F0C6";
}

function statusIcon(status) {
    if (status === "supported") return "✓";
    if (status === "unavailable" || status === "blocked") return "✗";
    return "?";
}

function errorWidget(message) {
    return {
        type: "widget",
        backgroundColor: "#4A1A1A",
        padding: 16,
        children: [{
            type: "vstack",
            spacing: 4,
            alignment: "leading",
            children: [
                text("节点 IP 质量", { size: "caption1", weight: "semibold" }, "#FFFFFFCC"),
                text("检测失败", { size: "headline", weight: "bold" }, "#FFFFFF"),
                text(message, { size: "caption2" }, "#FFFFFFDD"),
            ],
        }],
    };
}

/* ---------- HTTP 与工具 ---------- */
async function fetchJson(state, url, options) {
    const resp = await fetchRaw(state, "GET", url, options || {});
    try {
        return JSON.parse(resp.text);
    } catch (_) {
        throw new Error("JSON 解析失败");
    }
}

async function fetchRaw(state, method, url, options) {
    const opts = {
        headers: options.headers || {},
        timeout: options.timeout || state.timeoutMs,
    };
    if (state.policy) opts.policy = state.policy;
    if (typeof options.body !== "undefined") opts.body = options.body;

    const verb = String(method).toLowerCase();
    const http = state.ctx.http;
    const fn = http[verb] || http.get;
    const resp = await fn.call(http, url, opts);
    const status = Number(resp && resp.status);
    const bodyText = await safeText(resp);
    if (!options.allowHttpErrors && (!Number.isFinite(status) || status < 200 || status >= 400)) {
        throw new Error(`HTTP ${status || "?"}`);
    }
    return { status, text: bodyText, response: resp };
}

async function safeText(resp) {
    try {
        return await resp.text();
    } catch (_) {
        return "";
    }
}

function capture(promise) {
    return Promise.resolve(promise).then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error: errorMessage(error) })
    );
}

function browserHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    };
}

function readBool(v, fallback) {
    if (typeof v === "undefined" || v === null || v === "") return fallback;
    if (typeof v === "boolean") return v;
    const s = String(v).toLowerCase();
    if (s === "false" || s === "0" || s === "no") return false;
    if (s === "true" || s === "1" || s === "yes") return true;
    return fallback;
}

function isIP(v) {
    if (!v || typeof v !== "string") return false;
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(v) || /^[0-9a-fA-F:]+$/.test(v);
}

function maskIPAddress(ip) {
    if (!ip) return ip;
    if (ip.indexOf(":") >= 0) return ip.replace(/:[^:]+:[^:]+$/, "::****");
    return ip.replace(/(\d+\.\d+\.)\d+\.\d+/, "$1***.***");
}

function flagEmoji(code) {
    const s = String(code || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(s)) return "";
    return String.fromCodePoint(...[...s].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
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
