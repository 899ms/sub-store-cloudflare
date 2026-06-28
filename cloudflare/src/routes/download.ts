import { Hono } from "hono";
import type { Context } from "hono";
import { failed, isTokenValid } from "../lib/http";
import { buildSubscription, getTargetContentType, normalizeTarget } from "../lib/subscription";
import { ensureSchema, getRoutingTemplate, getSource, getSubscriptionCollection, getSubscriptionSources } from "../lib/store";
import type { SubscriptionCollection, SubscriptionSource, SubStoreEnv, SubscriptionTarget } from "../types";

export const downloadRoutes = new Hono<{ Bindings: SubStoreEnv }>();

type DownloadContext = Context<{ Bindings: SubStoreEnv }>;

const TARGET_ALIASES: Record<string, SubscriptionTarget> = {
  clashmeta: "mihomo",
  mihomo: "mihomo",
  stash: "mihomo",
  clash: "mihomo",
  egern: "mihomo",
  surfboard: "mihomo",
  surge: "mihomo",
  surgemac: "mihomo",
  loon: "mihomo",
  shadowrocket: "uri",
  qx: "uri",
  quantumultx: "uri",
  v2ray: "v2ray",
  uri: "uri",
  json: "json",
  singbox: "sing-box",
  "sing-box": "sing-box",
};

downloadRoutes.get("/download/collection/:name/:target?/:token?", async (c) => {
  const invalidToken = await rejectInvalidDownloadToken(c);
  if (invalidToken) return invalidToken;

  await ensureSchema(c.env);
  const collection = await getSubscriptionCollection(c.env, c.req.param("name"));
  if (!collection) return failed(c, "Collection not found", 404);

  return renderDownload(c, {
    collection,
    sources: await getSubscriptionSources(c.env),
    target: getDownloadTarget(c, collection.templateId),
    templateId: collection.templateId,
  });
});

downloadRoutes.get("/download/source/:name/:target?/:token?", async (c) => {
  const invalidToken = await rejectInvalidDownloadToken(c);
  if (invalidToken) return invalidToken;

  await ensureSchema(c.env);
  const source = await getSource(c.env, c.req.param("name"));
  if (!source || !source.enabled) return failed(c, "Subscription not found", 404);
  const subscriptionSource = (await getSubscriptionSources(c.env)).find((item) => item.id === source.id);
  if (!subscriptionSource) return failed(c, "Subscription not found", 404);

  return renderDownload(c, {
    source: subscriptionSource,
    sources: [subscriptionSource],
    target: getDownloadTarget(c),
  });
});

async function renderDownload(
  c: DownloadContext,
  options: {
    source?: SubscriptionSource;
    collection?: SubscriptionCollection;
    sources: SubscriptionSource[];
    target: SubscriptionTarget;
    templateId?: string;
  },
) {
  const template = await getRoutingTemplate(c.env, options.templateId);
  try {
    const body = await buildSubscription({
      source: options.source,
      collection: options.collection,
      sources: options.sources,
      requestUrl: new URL(c.req.url),
      target: options.target,
      template,
    });
    return new Response(body, {
      headers: {
        "content-type": getTargetContentType(options.target),
        "profile-update-interval": "6",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return failed(c, error instanceof Error ? error.message : String(error), 500);
  }
}

function getDownloadToken(c: DownloadContext) {
  return c.req.param("token") || c.req.query("token");
}

async function rejectInvalidDownloadToken(c: DownloadContext) {
  if (await isTokenValid(c.env.SUB_STORE_PUBLIC_DOWNLOAD_TOKEN, getDownloadToken(c))) return undefined;
  return failed(c, "Download token is invalid", 403);
}

function getDownloadTarget(c: DownloadContext, defaultTarget = "mihomo") {
  const input = c.req.param("target") || c.req.query("target") || defaultTarget;
  return TARGET_ALIASES[String(input || "").toLowerCase()] || normalizeTarget(input, c.req.header("user-agent") || "");
}
