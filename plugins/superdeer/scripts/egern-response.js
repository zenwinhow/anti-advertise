function removeContentLength(headers) {
  if (!headers) return headers;

  const next = {};
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== "content-length") {
      next[key] = headers[key];
    }
  }
  return next;
}

function requestPath(url) {
  const match = String(url || "").match(/^https?:\/\/[^/]+([^?#]*)/);
  return match ? match[1] : "";
}

function filterPayload(payload, path) {
  if (!payload || typeof payload !== "object") return payload;

  switch (path) {
    case "/app/getSplashData/V2":
      if (payload.data && typeof payload.data === "object") {
        payload.data.splashes = [];
      }
      break;

    case "/recommend/app/banner/list":
      if (payload.data && typeof payload.data === "object") {
        payload.data.bannerList = [];
      }
      break;

    case "/recommend/generalbanner/firstLevel":
    case "/recommend/generalbanner/personalCenterBanner":
    case "/homepage/app/recommendModel/findRecommendModel":
    case "/c/exercise/banner/list":
      payload.data = [];
      break;

    case "/recommend/touchcard/get":
      payload.data = null;
      break;

    case "/homepage/app/tofu/findTofu":
      if (payload.data && typeof payload.data === "object") {
        payload.data.leftTofuCacheVOList = [];
        const right = payload.data.rightTofuCacheVO;
        if (right && typeof right === "object") {
          right.list = [];
        } else {
          payload.data.rightTofuCacheVO = { list: [] };
        }
      }
      break;

    case "/app/newcomerPower/banner":
      payload.data = { showType: "0", activityUrl: "", activityPic: "" };
      break;

    case "/scheduleLesson/popup/popupStatus":
      if (payload.data && typeof payload.data === "object") {
        payload.data.popUpStatus = false;
        payload.data.popUpImageUrl = "";
        payload.data.link = "";
      }
      break;

    case "/recommend/pop/popUpBottomDialog":
      if (payload.data && typeof payload.data === "object") {
        payload.data.show = 0;
      }
      break;

    case "/recommend/pop/commonPush":
      if (payload.data && typeof payload.data === "object") {
        payload.data.popList = [];
      }
      break;
  }

  return payload;
}

function bodyToString(body) {
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return "";
}

export default async function (ctx) {
  const body = bodyToString(ctx.response.body);
  if (!body) return {};

  try {
    const payload = JSON.parse(body);
    const filtered = filterPayload(payload, requestPath(ctx.request.url));
    const headers = removeContentLength(ctx.response.headers || {});
    headers["Content-Type"] = "application/json; charset=utf-8";
    return { headers, body: JSON.stringify(filtered) };
  } catch (error) {
    return {};
  }
}
