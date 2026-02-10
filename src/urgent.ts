import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type * as Lark from "@larksuiteoapi/node-sdk";
import { createFeishuClient } from "./client.js";
import { listEnabledFeishuAccounts } from "./accounts.js";
import { resolveToolsConfig } from "./tools-config.js";
import { FeishuUrgentSchema, type FeishuUrgentParams } from "./urgent-schema.js";

// ============ Helpers ============

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

/**
 * Normalize user ID parameters for LLM compatibility.
 * Handles: user_id (string), user_ids (string | string[])
 * Returns array of user IDs.
 */
function normalizeUserIds(params: {
  user_id?: string;
  user_ids?: string | string[];
}): string[] {
  const ids: string[] = [];

  // Handle user_ids (can be string or array)
  if (params.user_ids) {
    if (Array.isArray(params.user_ids)) {
      ids.push(...params.user_ids);
    } else {
      ids.push(params.user_ids);
    }
  }

  // Handle user_id (single string)
  if (params.user_id && !ids.includes(params.user_id)) {
    ids.unshift(params.user_id);
  }

  return ids;
}

// ============ Urgent Message Operations ============

type UrgentResult = {
  success: boolean;
  invalid_user_id_list?: string[];
};

async function urgentApp(
  client: Lark.Client,
  params: {
    message_id: string;
    user_ids: string[];
    user_id_type?: "open_id" | "user_id" | "union_id";
  },
): Promise<UrgentResult> {
  const res = await client.im.message.urgentApp({
    path: { message_id: params.message_id },
    params: { user_id_type: params.user_id_type ?? "open_id" },
    data: { user_id_list: params.user_ids },
  });
  if (res.code !== 0) throw new Error(res.msg ?? `Error code: ${res.code}`);
  return {
    success: true,
    invalid_user_id_list: res.data?.invalid_user_id_list,
  };
}

async function urgentSms(
  client: Lark.Client,
  params: {
    message_id: string;
    user_ids: string[];
    user_id_type?: "open_id" | "user_id" | "union_id";
  },
): Promise<UrgentResult> {
  const res = await client.im.message.urgentSms({
    path: { message_id: params.message_id },
    params: { user_id_type: params.user_id_type ?? "open_id" },
    data: { user_id_list: params.user_ids },
  });
  if (res.code !== 0) throw new Error(res.msg ?? `Error code: ${res.code}`);
  return {
    success: true,
    invalid_user_id_list: res.data?.invalid_user_id_list,
  };
}

async function urgentPhone(
  client: Lark.Client,
  params: {
    message_id: string;
    user_ids: string[];
    user_id_type?: "open_id" | "user_id" | "union_id";
  },
): Promise<UrgentResult> {
  const res = await client.im.message.urgentPhone({
    path: { message_id: params.message_id },
    params: { user_id_type: params.user_id_type ?? "open_id" },
    data: { user_id_list: params.user_ids },
  });
  if (res.code !== 0) throw new Error(res.msg ?? `Error code: ${res.code}`);
  return {
    success: true,
    invalid_user_id_list: res.data?.invalid_user_id_list,
  };
}

// ============ Tool Registration ============

export function registerFeishuUrgentTools(api: OpenClawPluginApi) {
  if (!api.config) {
    api.logger.debug?.("feishu_urgent: No config available, skipping urgent tools");
    return;
  }

  const accounts = listEnabledFeishuAccounts(api.config);
  if (accounts.length === 0) {
    api.logger.debug?.("feishu_urgent: No Feishu accounts configured, skipping urgent tools");
    return;
  }

  const firstAccount = accounts[0];
  const toolsCfg = resolveToolsConfig(firstAccount.config.tools);

  if (!toolsCfg.urgent) {
    api.logger.debug?.("feishu_urgent: Urgent tools disabled in config");
    return;
  }

  const getClient = () => createFeishuClient(firstAccount);

  api.registerTool(
    {
      name: "feishu_urgent",
      label: "Feishu Urgent Message",
      description:
        "Send urgent notifications for Feishu messages. Actions: urgent (with urgent_type: app/sms/phone), urgent_app (in-app only), urgent_sms (SMS + in-app), urgent_phone (phone call + in-app). Note: SMS and phone urgent consume enterprise quota. Only bot's own messages can be marked urgent.",
      parameters: FeishuUrgentSchema,
      async execute(_toolCallId, params) {
        const p = params as FeishuUrgentParams;
        try {
          const client = getClient();

          // Validate message_id format
          if (!p.message_id || typeof p.message_id !== "string") {
            throw new Error("Missing required parameter: message_id");
          }
          if (!p.message_id.startsWith("om_")) {
            throw new Error(
              `Invalid message_id format: ${p.message_id}. Expected format: om_xxx. Batch messages (bm_xxx) are not supported.`,
            );
          }

          // Normalize user IDs
          const userIds = normalizeUserIds(p);
          if (userIds.length === 0) {
            throw new Error("Missing required parameter: user_ids (provide user_id or user_ids)");
          }
          if (userIds.length > 200) {
            throw new Error("Too many users: maximum 200 users per request");
          }

          // Validate user_id_type if provided
          const validIdTypes = ["open_id", "user_id", "union_id"] as const;
          const userIdType = p.user_id_type ?? "open_id";
          if (!validIdTypes.includes(userIdType as any)) {
            throw new Error(
              `Invalid user_id_type: ${p.user_id_type}. Valid values: ${validIdTypes.join(", ")}`,
            );
          }

          const urgentParams = {
            message_id: p.message_id,
            user_ids: userIds,
            user_id_type: userIdType as "open_id" | "user_id" | "union_id",
          };

          switch (p.action) {
            case "urgent":
              switch (p.urgent_type) {
                case "app":
                  return json(await urgentApp(client, urgentParams));
                case "sms":
                  return json(await urgentSms(client, urgentParams));
                case "phone":
                  return json(await urgentPhone(client, urgentParams));
                default:
                  return json({ error: `Unknown urgent_type: ${(p as any).urgent_type}` });
              }
            case "urgent_app":
              return json(await urgentApp(client, urgentParams));
            case "urgent_sms":
              return json(await urgentSms(client, urgentParams));
            case "urgent_phone":
              return json(await urgentPhone(client, urgentParams));
            default:
              return json({ error: `Unknown action: ${(p as any).action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_urgent" },
  );

  api.logger.info?.("feishu_urgent: Registered urgent message tools");
}
