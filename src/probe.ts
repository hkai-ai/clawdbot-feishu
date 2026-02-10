import type { FeishuProbeResult } from "./types.js";
import { createFeishuClient, type FeishuClientCredentials } from "./client.js";
import { getCachedProbeResult, setCachedProbeResult } from "./probe-cache.js";

export async function probeFeishu(creds?: FeishuClientCredentials): Promise<FeishuProbeResult> {
  if (!creds?.appId || !creds?.appSecret) {
    return {
      ok: false,
      error: "missing credentials (appId, appSecret)",
    };
  }

  // Check cache first
  const cached = getCachedProbeResult(creds.appId);
  if (cached) {
    return cached;
  }

  // Perform actual probe
  let result: FeishuProbeResult;

  try {
    const client = createFeishuClient(creds);
    // Use bot/v3/info API to get bot information
    const response = await (client as any).request({
      method: "GET",
      url: "/open-apis/bot/v3/info",
      data: {},
    });

    if (response.code !== 0) {
      result = {
        ok: false,
        appId: creds.appId,
        error: `API error: ${response.msg || `code ${response.code}`}`,
      };
    } else {
      const bot = response.bot || response.data?.bot;
      result = {
        ok: true,
        appId: creds.appId,
        botName: bot?.bot_name,
        botOpenId: bot?.open_id,
      };
    }
  } catch (err) {
    result = {
      ok: false,
      appId: creds.appId,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Cache the result
  setCachedProbeResult(result, creds.appId);

  return result;
}
