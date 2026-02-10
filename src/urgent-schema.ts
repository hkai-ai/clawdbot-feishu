import { Type, type Static } from "@sinclair/typebox";

// Shared types
const UserIdType = Type.Union([
  Type.Literal("open_id"),
  Type.Literal("user_id"),
  Type.Literal("union_id"),
]);

const UrgentType = Type.Union([
  Type.Literal("app"),
  Type.Literal("sms"),
  Type.Literal("phone"),
]);

// ===== Action Definitions =====

// Send urgent message (app/sms/phone)
const UrgentMessageAction = Type.Object({
  action: Type.Literal("urgent"),
  message_id: Type.String({
    description:
      "Message ID to mark as urgent. Only messages sent by the bot can be marked urgent. Format: om_xxx",
  }),
  urgent_type: UrgentType,
  // Accept both user_id (string) and user_ids (array) for LLM compatibility
  user_id: Type.Optional(
    Type.String({ description: "Single user ID (alternative to user_ids)" }),
  ),
  user_ids: Type.Optional(
    Type.Union([Type.Array(Type.String()), Type.String()], {
      description: "Target user IDs (max 200). Users must be in the message's chat.",
    }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

// Convenience actions for specific urgent types
const UrgentAppAction = Type.Object({
  action: Type.Literal("urgent_app"),
  message_id: Type.String({
    description:
      "Message ID to mark as urgent. Only messages sent by the bot can be marked urgent. Format: om_xxx",
  }),
  user_id: Type.Optional(
    Type.String({ description: "Single user ID (alternative to user_ids)" }),
  ),
  user_ids: Type.Optional(
    Type.Union([Type.Array(Type.String()), Type.String()], {
      description: "Target user IDs (max 200). Users must be in the message's chat.",
    }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

const UrgentSmsAction = Type.Object({
  action: Type.Literal("urgent_sms"),
  message_id: Type.String({
    description:
      "Message ID to mark as urgent. Only messages sent by the bot can be marked urgent. Format: om_xxx",
  }),
  user_id: Type.Optional(
    Type.String({ description: "Single user ID (alternative to user_ids)" }),
  ),
  user_ids: Type.Optional(
    Type.Union([Type.Array(Type.String()), Type.String()], {
      description: "Target user IDs (max 200). Users must be in the message's chat.",
    }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

const UrgentPhoneAction = Type.Object({
  action: Type.Literal("urgent_phone"),
  message_id: Type.String({
    description:
      "Message ID to mark as urgent. Only messages sent by the bot can be marked urgent. Format: om_xxx",
  }),
  user_id: Type.Optional(
    Type.String({ description: "Single user ID (alternative to user_ids)" }),
  ),
  user_ids: Type.Optional(
    Type.Union([Type.Array(Type.String()), Type.String()], {
      description: "Target user IDs (max 200). Users must be in the message's chat.",
    }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

// Combined schema
export const FeishuUrgentSchema = Type.Union([
  UrgentMessageAction,
  UrgentAppAction,
  UrgentSmsAction,
  UrgentPhoneAction,
]);

export type FeishuUrgentParams = Static<typeof FeishuUrgentSchema>;
