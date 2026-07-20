const anxinReferer = /^https:\/\/servicewechat\.com\/wx75eeff0fa2bb9e12(?:\/|$)/i;

export default async function (ctx) {
  const referer = ctx.request.headers.get("Referer") || "";

  if (!anxinReferer.test(referer)) {
    return;
  }

  return ctx.respond({
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
