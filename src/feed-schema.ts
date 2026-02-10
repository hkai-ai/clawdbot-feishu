import { Type, type Static } from "@sinclair/typebox";

// Shared types
const UserIdType = Type.Union([
  Type.Literal("open_id"),
  Type.Literal("user_id"),
  Type.Literal("union_id"),
]);

const ButtonType = Type.Union([
  Type.Literal("default"),
  Type.Literal("primary"),
  Type.Literal("success"),
]);

const LabelType = Type.Union([
  Type.Literal("primary"),
  Type.Literal("secondary"),
  Type.Literal("success"),
  Type.Literal("danger"),
]);

const StatusLabelSchema = Type.Object({
  text: Type.String({ description: "Label text" }),
  type: Type.Optional(LabelType),
});

const ButtonSchema = Type.Object({
  action_type: Type.Union([Type.Literal("url_page"), Type.Literal("webhook")]),
  text: Type.String({ description: "Button text (1-30 chars)" }),
  button_type: Type.Optional(ButtonType),
  url: Type.Optional(Type.String({ description: "URL for action_type=url_page" })),
  action_map: Type.Optional(
    Type.Record(Type.String(), Type.String(), {
      description: "Custom action data for webhook",
    }),
  ),
});

const NotifySchema = Type.Object({
  close_notify: Type.Optional(Type.Boolean({ description: "Disable notification" })),
  custom_sound_text: Type.Optional(Type.String({ description: "Custom notification sound text" })),
  with_custom_sound: Type.Optional(Type.Boolean({ description: "Enable custom sound" })),
});

// ===== Action Definitions =====

// Create app feed card
const CreateAppFeedCardAction = Type.Object({
  action: Type.Literal("create_app_feed_card"),
  user_ids: Type.Array(Type.String(), {
    description: "Target user IDs (1-20)",
    minItems: 1,
    maxItems: 20,
  }),
  title: Type.String({ description: "Card title (1-60 chars)" }),
  link: Type.String({ description: "Card click URL (HTTPS)" }),
  biz_id: Type.Optional(Type.String({ description: "Business ID (custom)" })),
  preview: Type.Optional(Type.String({ description: "Preview text (0-120 chars)" })),
  avatar_key: Type.Optional(Type.String({ description: "Avatar image key" })),
  status_label: Type.Optional(StatusLabelSchema),
  buttons: Type.Optional(Type.Array(ButtonSchema, { maxItems: 2 })),
  time_sensitive: Type.Optional(Type.Boolean({ description: "Enable instant reminder (pin to top)" })),
  notify: Type.Optional(NotifySchema),
  user_id_type: Type.Optional(UserIdType),
});

// Update app feed card
const UpdateAppFeedCardAction = Type.Object({
  action: Type.Literal("update_app_feed_card"),
  biz_id: Type.String({ description: "Business ID" }),
  user_id: Type.String({ description: "Target user ID (singular, NOT user_ids)" }),
  update_fields: Type.Array(
    Type.Union([
      Type.Literal("1"),
      Type.Literal("2"),
      Type.Literal("3"),
      Type.Literal("10"),
      Type.Literal("11"),
      Type.Literal("12"),
      Type.Literal("13"),
      Type.Literal("101"),
      Type.Literal("102"),
      Type.Literal("103"),
    ]),
    {
      description:
        "Fields to update: 1=title, 2=avatar_key, 3=preview, 10=status_label, 11=buttons, 12=link, 13=time_sensitive, 101=display_time, 102=sort_time, 103=notify",
    },
  ),
  title: Type.Optional(Type.String({ description: "New title" })),
  preview: Type.Optional(Type.String({ description: "New preview text" })),
  avatar_key: Type.Optional(Type.String({ description: "New avatar key" })),
  status_label: Type.Optional(StatusLabelSchema),
  buttons: Type.Optional(Type.Array(ButtonSchema, { maxItems: 2 })),
  link: Type.Optional(Type.String({ description: "New link URL" })),
  time_sensitive: Type.Optional(Type.Boolean({ description: "Enable/disable instant reminder" })),
  notify: Type.Optional(NotifySchema),
  user_id_type: Type.Optional(UserIdType),
});

// Delete app feed card
const DeleteAppFeedCardAction = Type.Object({
  action: Type.Literal("delete_app_feed_card"),
  biz_id: Type.String({ description: "Business ID" }),
  user_id: Type.String({ description: "User ID (singular, NOT user_ids)" }),
  user_id_type: Type.Optional(UserIdType),
});

// Set bot time-sensitive (pin bot chat)
const SetBotTimeSensitiveAction = Type.Object({
  action: Type.Literal("set_bot_time_sensitive"),
  user_ids: Type.Array(Type.String(), {
    description: "User IDs (1-50)",
    minItems: 1,
    maxItems: 50,
  }),
  time_sensitive: Type.Boolean({ description: "true=pin, false=unpin" }),
  user_id_type: Type.Optional(UserIdType),
});

// Set chat time-sensitive (pin group chat)
const SetChatTimeSensitiveAction = Type.Object({
  action: Type.Literal("set_chat_time_sensitive"),
  chat_id: Type.String({ description: "Chat ID (group)" }),
  user_ids: Type.Array(Type.String(), { description: "User IDs" }),
  time_sensitive: Type.Boolean({ description: "true=pin, false=unpin" }),
  user_id_type: Type.Optional(UserIdType),
});

// Update chat button
const UpdateChatButtonAction = Type.Object({
  action: Type.Literal("update_chat_button"),
  chat_id: Type.String({ description: "Chat ID" }),
  buttons: Type.Array(ButtonSchema, { maxItems: 2 }),
  user_ids: Type.Optional(Type.Array(Type.String(), { description: "Target user IDs (optional)" })),
  user_id_type: Type.Optional(UserIdType),
});

// Combined schema
export const FeishuFeedSchema = Type.Union([
  CreateAppFeedCardAction,
  UpdateAppFeedCardAction,
  DeleteAppFeedCardAction,
  SetBotTimeSensitiveAction,
  SetChatTimeSensitiveAction,
  UpdateChatButtonAction,
]);

export type FeishuFeedParams = Static<typeof FeishuFeedSchema>;

// Button input type for internal use
export type ButtonInput = {
  action_type: "url_page" | "webhook";
  text: string;
  button_type?: "default" | "primary" | "success";
  url?: string;
  action_map?: Record<string, string>;
};
