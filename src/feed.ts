import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type * as Lark from "@larksuiteoapi/node-sdk";
import { createFeishuClient } from "./client.js";
import { listEnabledFeishuAccounts } from "./accounts.js";
import { resolveToolsConfig } from "./tools-config.js";
import { FeishuFeedSchema, type FeishuFeedParams, type ButtonInput } from "./feed-schema.js";

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

/**
 * Normalize to single user ID for LLM compatibility.
 * Handles: user_id (string), user_ids (string | string[])
 * Returns first user ID or throws if none provided.
 */
function normalizeSingleUserId(
  params: { user_id?: string; user_ids?: string | string[] },
  fieldName = "user_id",
): string {
  // Prefer user_id if provided
  if (params.user_id) {
    return params.user_id;
  }

  // Fall back to user_ids
  if (params.user_ids) {
    if (Array.isArray(params.user_ids)) {
      if (params.user_ids.length > 0) {
        return params.user_ids[0];
      }
    } else {
      return params.user_ids;
    }
  }

  throw new Error(`Missing required parameter: ${fieldName}`);
}

function buildButtons(buttons?: ButtonInput[]) {
  if (!buttons?.length) return undefined;
  return {
    buttons: buttons.map((b) => ({
      action_type: b.action_type,
      text: { text: b.text },
      button_type: b.button_type ?? "default",
      multi_url: b.url ? { url: b.url } : undefined,
      action_map: b.action_map,
    })),
  };
}

function buildAppFeedCard(params: {
  biz_id?: string;
  title?: string;
  preview?: string;
  avatar_key?: string;
  status_label?: { text: string; type?: "primary" | "secondary" | "success" | "danger" };
  buttons?: ButtonInput[];
  link?: string;
  time_sensitive?: boolean;
  notify?: {
    close_notify?: boolean;
    custom_sound_text?: string;
    with_custom_sound?: boolean;
  };
}) {
  return {
    biz_id: params.biz_id,
    title: params.title,
    preview: params.preview,
    avatar_key: params.avatar_key,
    status_label: params.status_label
      ? {
          text: params.status_label.text,
          type: params.status_label.type ?? "primary",
        }
      : undefined,
    buttons: buildButtons(params.buttons),
    link: params.link ? { link: params.link } : undefined,
    time_sensitive: params.time_sensitive,
    notify: params.notify,
  };
}

// ============ App Feed Card Operations ============

async function createAppFeedCard(
  client: Lark.Client,
  params: Extract<FeishuFeedParams, { action: "create_app_feed_card" }>,
) {
  // Normalize user IDs (accept both user_id and user_ids)
  const userIds = normalizeUserIds(params);
  if (userIds.length === 0) {
    throw new Error("Missing required parameter: user_ids (provide user_id or user_ids)");
  }
  if (userIds.length > 20) {
    throw new Error("Too many users: maximum 20 users per request");
  }

  const res = await client.im.v2.appFeedCard.create({
    params: { user_id_type: params.user_id_type ?? "open_id" },
    data: {
      app_feed_card: buildAppFeedCard({
        biz_id: params.biz_id,
        title: params.title,
        preview: params.preview,
        avatar_key: params.avatar_key,
        status_label: params.status_label as any,
        buttons: params.buttons as ButtonInput[],
        link: params.link,
        time_sensitive: params.time_sensitive,
        notify: params.notify,
      }),
      user_ids: userIds,
    },
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    biz_id: res.data?.biz_id,
    failed_cards: res.data?.failed_cards,
  };
}

async function updateAppFeedCard(
  client: Lark.Client,
  params: Extract<FeishuFeedParams, { action: "update_app_feed_card" }>,
) {
  // Normalize to single user ID (accept both user_id and user_ids)
  const userId = normalizeSingleUserId(params, "user_id");

  const res = await client.im.v2.appFeedCardBatch.update({
    params: { user_id_type: params.user_id_type ?? "open_id" },
    data: {
      feed_cards: [
        {
          app_feed_card: buildAppFeedCard({
            biz_id: params.biz_id,
            title: params.title,
            preview: params.preview,
            avatar_key: params.avatar_key,
            status_label: params.status_label as any,
            buttons: params.buttons as ButtonInput[],
            link: params.link,
            time_sensitive: params.time_sensitive,
            notify: params.notify,
          }),
          user_id: userId,
          update_fields: params.update_fields,
        },
      ],
    },
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    failed_cards: res.data?.failed_cards,
  };
}

async function deleteAppFeedCard(
  client: Lark.Client,
  params: Extract<FeishuFeedParams, { action: "delete_app_feed_card" }>,
) {
  // Normalize to single user ID (accept both user_id and user_ids)
  const userId = normalizeSingleUserId(params, "user_id");

  const res = await client.im.v2.appFeedCardBatch.delete({
    params: { user_id_type: params.user_id_type ?? "open_id" },
    data: {
      feed_cards: [
        {
          biz_id: params.biz_id,
          user_id: userId,
        },
      ],
    },
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    failed_cards: res.data?.failed_cards,
  };
}

// ============ Time-Sensitive (Pin) Operations ============

async function setBotTimeSensitive(
  client: Lark.Client,
  params: Extract<FeishuFeedParams, { action: "set_bot_time_sensitive" }>,
) {
  // Normalize user IDs (accept both user_id and user_ids)
  const userIds = normalizeUserIds(params);
  if (userIds.length === 0) {
    throw new Error("Missing required parameter: user_ids (provide user_id or user_ids)");
  }
  if (userIds.length > 50) {
    throw new Error("Too many users: maximum 50 users per request");
  }

  const res = await client.im.v2.feedCard.botTimeSentive({
    params: { user_id_type: params.user_id_type ?? "open_id" },
    data: {
      time_sensitive: params.time_sensitive,
      user_ids: userIds,
    },
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    failed_user_reasons: res.data?.failed_user_reasons,
  };
}

async function setChatTimeSensitive(
  client: Lark.Client,
  params: Extract<FeishuFeedParams, { action: "set_chat_time_sensitive" }>,
) {
  // Normalize user IDs (accept both user_id and user_ids)
  const userIds = normalizeUserIds(params);
  if (userIds.length === 0) {
    throw new Error("Missing required parameter: user_ids (provide user_id or user_ids)");
  }

  const res = await client.im.v2.feedCard.patch({
    params: { user_id_type: params.user_id_type ?? "open_id" },
    path: { feed_card_id: params.chat_id },
    data: {
      time_sensitive: params.time_sensitive,
      user_ids: userIds,
    },
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    failed_user_reasons: res.data?.failed_user_reasons,
  };
}

// ============ Chat Button Operations ============

async function updateChatButton(
  client: Lark.Client,
  params: Extract<FeishuFeedParams, { action: "update_chat_button" }>,
) {
  const res = await client.im.v2.chatButton.update({
    params: { user_id_type: params.user_id_type ?? "open_id" },
    data: {
      chat_id: params.chat_id,
      user_ids: params.user_ids,
      buttons: buildButtons(params.buttons as ButtonInput[]),
    },
  });
  if (res.code !== 0) throw new Error(res.msg);
  return {
    success: true,
    failed_user_reasons: res.data?.failed_user_reasons,
  };
}

// ============ Tool Registration ============

export function registerFeishuFeedTools(api: OpenClawPluginApi) {
  if (!api.config) {
    api.logger.debug?.("feishu_feed: No config available, skipping feed tools");
    return;
  }

  const accounts = listEnabledFeishuAccounts(api.config);
  if (accounts.length === 0) {
    api.logger.debug?.("feishu_feed: No Feishu accounts configured, skipping feed tools");
    return;
  }

  const firstAccount = accounts[0];
  const toolsCfg = resolveToolsConfig(firstAccount.config.tools);

  if (!toolsCfg.feed) {
    api.logger.debug?.("feishu_feed: Feed tools disabled in config");
    return;
  }

  const getClient = () => createFeishuClient(firstAccount);

  api.registerTool(
    {
      name: "feishu_feed",
      label: "Feishu Feed Card",
      description:
        "Feishu feed card operations for message list. Actions: create_app_feed_card, update_app_feed_card, delete_app_feed_card, set_bot_time_sensitive (pin bot chat), set_chat_time_sensitive (pin group chat), update_chat_button",
      parameters: FeishuFeedSchema,
      async execute(_toolCallId, params) {
        const p = params as FeishuFeedParams;
        try {
          const client = getClient();
          switch (p.action) {
            case "create_app_feed_card":
              return json(await createAppFeedCard(client, p));
            case "update_app_feed_card":
              return json(await updateAppFeedCard(client, p));
            case "delete_app_feed_card":
              return json(await deleteAppFeedCard(client, p));
            case "set_bot_time_sensitive":
              return json(await setBotTimeSensitive(client, p));
            case "set_chat_time_sensitive":
              return json(await setChatTimeSensitive(client, p));
            case "update_chat_button":
              return json(await updateChatButton(client, p));
            default:
              return json({ error: `Unknown action: ${(p as any).action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_feed" },
  );

  api.logger.info?.("feishu_feed: Registered feed card tools");
}
