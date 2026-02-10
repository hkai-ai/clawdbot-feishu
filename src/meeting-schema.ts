import { Type, type Static } from "@sinclair/typebox";

// Shared types
const UserIdType = Type.Union([
  Type.Literal("open_id"),
  Type.Literal("user_id"),
  Type.Literal("union_id"),
]);

// User type for meeting participants (Lark user, rooms user, etc.)
const MeetingUserType = Type.Union([
  Type.Literal(1), // Lark user
  Type.Literal(2), // Rooms user
  Type.Literal(3), // Document user
  Type.Literal(4), // Neo single product user
  Type.Literal(5), // Neo single product guest
  Type.Literal(6), // PSTN user
  Type.Literal(7), // SIP user
]);

// Invitee schema for invite/kickout operations
const InviteeSchema = Type.Object({
  id: Type.String({ description: "User ID" }),
  user_type: Type.Optional(MeetingUserType),
});

// Permission checker for meeting settings
const PermissionCheckerSchema = Type.Object({
  check_field: Type.Number({
    description: "Check field type: 1=user ID, 2=user type, 3=tenant ID",
  }),
  check_mode: Type.Number({
    description: "Check mode: 1=whitelist, 2=blacklist",
  }),
  check_list: Type.Optional(
    Type.Array(Type.String(), { description: "List of IDs to check" }),
  ),
});

// Action permission for meeting settings
const ActionPermissionSchema = Type.Object({
  permission: Type.Number({
    description: "Permission type: 1=can be host, 2=can invite, 3=can join",
  }),
  permission_checkers: Type.Optional(Type.Array(PermissionCheckerSchema)),
});

// Host assignment
const AssignHostSchema = Type.Object({
  user_type: Type.Optional(
    Type.Number({ description: "User type, only support 1=Lark user" }),
  ),
  id: Type.String({ description: "User ID" }),
});

// PSTN/SIP info for call settings
const PstnSipInfoSchema = Type.Object({
  nickname: Type.Optional(Type.String({ description: "Temporary nickname" })),
  main_address: Type.Optional(
    Type.String({
      description:
        "Phone number format: [country code]-[area code][number], e.g., +86-02187654321",
    }),
  ),
});

// Callee for 1v1 calls
const CalleeSchema = Type.Object({
  id: Type.String({ description: "User ID" }),
  user_type: Type.Optional(MeetingUserType),
  pstn_sip_info: Type.Optional(PstnSipInfoSchema),
});

// Call setting for 1v1 meetings
const CallSettingSchema = Type.Object({
  callee: Type.Optional(CalleeSchema),
});

// Meeting settings for reservations
const MeetingSettingsSchema = Type.Object({
  topic: Type.Optional(Type.String({ description: "Meeting topic" })),
  action_permissions: Type.Optional(Type.Array(ActionPermissionSchema)),
  meeting_initial_type: Type.Optional(
    Type.Number({ description: "Meeting type: 1=multi-person, 2=1v1 call" }),
  ),
  meeting_connect: Type.Optional(
    Type.Boolean({ description: "Enable interoperability" }),
  ),
  auto_record: Type.Optional(
    Type.Boolean({ description: "Enable auto-recording" }),
  ),
  assign_host_list: Type.Optional(
    Type.Array(AssignHostSchema, { description: "Designated hosts" }),
  ),
  password: Type.Optional(
    Type.String({
      description: "Meeting password (4-9 digits), empty string = no password",
    }),
  ),
  call_setting: Type.Optional(CallSettingSchema),
});

// Recording permission object
const RecordingPermissionObjectSchema = Type.Object({
  id: Type.Optional(Type.String({ description: "Authorization object ID" })),
  type: Type.Number({
    description:
      "Authorization type: 1=user, 2=group, 3=tenant (no id), 4=public (no id)",
  }),
  permission: Type.Number({ description: "Permission: 1=view" }),
});

// ===== Meeting Operations =====

// Get meeting details
const GetMeetingAction = Type.Object({
  action: Type.Literal("get_meeting"),
  meeting_id: Type.String({ description: "Meeting ID" }),
  with_participants: Type.Optional(
    Type.Boolean({ description: "Include participant list" }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

// Invite participants to meeting
const InviteAction = Type.Object({
  action: Type.Literal("invite"),
  meeting_id: Type.String({ description: "Meeting ID" }),
  // LLM compatibility: accept both singular and plural forms
  invitee: Type.Optional(InviteeSchema),
  invitees: Type.Optional(
    Type.Union([Type.Array(InviteeSchema), InviteeSchema], {
      description: "Invitees to add (max 10)",
    }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

// End meeting
const EndMeetingAction = Type.Object({
  action: Type.Literal("end_meeting"),
  meeting_id: Type.String({ description: "Meeting ID" }),
});

// Kickout participants
const KickoutAction = Type.Object({
  action: Type.Literal("kickout"),
  meeting_id: Type.String({ description: "Meeting ID" }),
  // LLM compatibility: accept both singular and plural forms
  user: Type.Optional(InviteeSchema),
  users: Type.Optional(
    Type.Union([Type.Array(InviteeSchema), InviteeSchema], {
      description: "Users to remove (max 10)",
    }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

// Set meeting host
const SetHostAction = Type.Object({
  action: Type.Literal("set_host"),
  meeting_id: Type.String({ description: "Meeting ID" }),
  host_user: Type.Object({
    id: Type.String({ description: "New host user ID" }),
    user_type: Type.Optional(MeetingUserType),
  }),
  old_host_user: Type.Optional(
    Type.Object({
      id: Type.String({ description: "Current host user ID" }),
      user_type: Type.Optional(MeetingUserType),
    }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

// List meetings by number
const ListByNoAction = Type.Object({
  action: Type.Literal("list_by_no"),
  meeting_no: Type.String({ description: "9-digit meeting number" }),
  start_time: Type.Optional(
    Type.String({ description: "Start time (unix timestamp, seconds)" }),
  ),
  end_time: Type.Optional(
    Type.String({ description: "End time (unix timestamp, seconds)" }),
  ),
  page_token: Type.Optional(Type.String({ description: "Pagination token" })),
  page_size: Type.Optional(Type.Number({ description: "Page size (max 20)" })),
});

// ===== Reserve Operations =====

// Create reservation
const CreateReserveAction = Type.Object({
  action: Type.Literal("create_reserve"),
  end_time: Type.String({
    description:
      "Reservation end time (unix timestamp, seconds). Required for multi-person meetings.",
  }),
  owner_id: Type.String({
    description: "Meeting owner user ID (required).",
  }),
  meeting_settings: MeetingSettingsSchema,
  user_id_type: Type.Optional(UserIdType),
});

// Get reservation
const GetReserveAction = Type.Object({
  action: Type.Literal("get_reserve"),
  reserve_id: Type.String({ description: "Reservation ID" }),
  user_id_type: Type.Optional(UserIdType),
});

// Update reservation
const UpdateReserveAction = Type.Object({
  action: Type.Literal("update_reserve"),
  reserve_id: Type.String({ description: "Reservation ID" }),
  end_time: Type.Optional(
    Type.String({ description: "New end time (unix timestamp, seconds)" }),
  ),
  meeting_settings: Type.Optional(MeetingSettingsSchema),
  user_id_type: Type.Optional(UserIdType),
});

// Delete reservation
const DeleteReserveAction = Type.Object({
  action: Type.Literal("delete_reserve"),
  reserve_id: Type.String({ description: "Reservation ID" }),
});

// Get active meeting from reservation
const GetActiveMeetingAction = Type.Object({
  action: Type.Literal("get_active_meeting"),
  reserve_id: Type.String({ description: "Reservation ID" }),
  with_participants: Type.Optional(
    Type.Boolean({ description: "Include participant list" }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

// ===== Recording Operations =====

// Get recording
const GetRecordingAction = Type.Object({
  action: Type.Literal("get_recording"),
  meeting_id: Type.String({ description: "Meeting ID" }),
});

// Start recording
const StartRecordingAction = Type.Object({
  action: Type.Literal("start_recording"),
  meeting_id: Type.String({ description: "Meeting ID" }),
  timezone: Type.Optional(
    Type.Number({
      description: "Timezone for recording display (-12 to 12), default: 8",
    }),
  ),
});

// Stop recording
const StopRecordingAction = Type.Object({
  action: Type.Literal("stop_recording"),
  meeting_id: Type.String({ description: "Meeting ID" }),
});

// Set recording permission
const SetRecordingPermissionAction = Type.Object({
  action: Type.Literal("set_recording_permission"),
  meeting_id: Type.String({ description: "Meeting ID" }),
  // LLM compatibility: accept both singular and plural forms
  permission_object: Type.Optional(RecordingPermissionObjectSchema),
  permission_objects: Type.Optional(
    Type.Union(
      [
        Type.Array(RecordingPermissionObjectSchema),
        RecordingPermissionObjectSchema,
      ],
      {
        description: "Authorization objects",
      },
    ),
  ),
  user_id_type: Type.Optional(UserIdType),
});

// Combined schema
export const FeishuMeetingSchema = Type.Union([
  // Meeting operations
  GetMeetingAction,
  InviteAction,
  EndMeetingAction,
  KickoutAction,
  SetHostAction,
  ListByNoAction,
  // Reserve operations
  CreateReserveAction,
  GetReserveAction,
  UpdateReserveAction,
  DeleteReserveAction,
  GetActiveMeetingAction,
  // Recording operations
  GetRecordingAction,
  StartRecordingAction,
  StopRecordingAction,
  SetRecordingPermissionAction,
]);

export type FeishuMeetingParams = Static<typeof FeishuMeetingSchema>;

// Invitee type for internal use
export type Invitee = {
  id: string;
  user_type?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

// Meeting settings type for internal use
export type MeetingSettings = Static<typeof MeetingSettingsSchema>;

// Recording permission object type
export type RecordingPermissionObject = Static<
  typeof RecordingPermissionObjectSchema
>;
