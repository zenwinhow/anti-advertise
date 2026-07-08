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

function hasCommercialMarker(value) {
  if (!value || typeof value !== "object") return false;

  if (value.is_external_commercial_ad === true) return true;

  const type = String(value.type || value.xtpl || "");
  if (type.includes("external_commercial_ad")) return true;

  return false;
}

function hasAdAssetUrl(value) {
  if (typeof value === "string") {
    return value.includes("/static/ad_oss/");
  }

  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some(hasAdAssetUrl);
  }

  return Object.keys(value).some((key) => hasAdAssetUrl(value[key]));
}

function containsAdSignal(value) {
  if (!value || typeof value !== "object") return false;
  if (hasCommercialMarker(value)) return true;
  if (hasAdAssetUrl(value)) return true;

  if (Array.isArray(value)) {
    return value.some(containsAdSignal);
  }

  return Object.keys(value).some((key) => containsAdSignal(value[key]));
}

function shouldDropCard(card) {
  if (!card || typeof card !== "object") return false;

  const id = String(card.id || "");
  if (
    id === "p_advertisement_home_brand_minds" ||
    id === "kf_home_super_banner_new_adx"
  ) {
    return true;
  }

  const data = card.data || {};
  if (Object.prototype.hasOwnProperty.call(data, "p_advertisement_home_brand_minds")) {
    return true;
  }

  return containsAdSignal(card);
}

function cleanNode(value) {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value
      .filter((item) => !hasCommercialMarker(item) && !hasAdAssetUrl(item))
      .map(cleanNode);
  }

  const next = {};
  for (const key of Object.keys(value)) {
    const child = value[key];

    if (key === "cards" && Array.isArray(child)) {
      next[key] = child.filter((card) => !shouldDropCard(card)).map(cleanNode);
    } else if (
      key === "p_advertisement_home_brand_minds" &&
      Array.isArray(child)
    ) {
      next[key] = [];
    } else {
      next[key] = cleanNode(child);
    }
  }

  return next;
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
    const cleaned = cleanNode(payload);
    const headers = removeContentLength(ctx.response.headers || {});
    headers["Content-Type"] = "application/json; charset=utf-8";
    return { headers, body: JSON.stringify(cleaned) };
  } catch (error) {
    return {};
  }
}
