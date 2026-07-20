const anxinReferer = /^https:\/\/servicewechat\.com\/wx75eeff0fa2bb9e12(?:\/|$)/i;
const headers = $request.headers || {};
const refererKey = Object.keys(headers).find(
  (name) => name.toLowerCase() === "referer",
);
const referer = refererKey ? String(headers[refererKey]) : "";

if (anxinReferer.test(referer)) {
  $done({
    response: {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  });
} else {
  $done({});
}
