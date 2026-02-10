import { Type, type Static } from "@sinclair/typebox";

// Shared types
const UserIdType = Type.Union([
  Type.Literal("open_id"),
  Type.Literal("user_id"),
  Type.Literal("union_id"),
]);

const VisibilityType = Type.Union([
  Type.Literal("default"),
  Type.Literal("public"),
  Type.Literal("private"),
]);

const AttendeeType = Type.Union([
  Type.Literal("user"),
  Type.Literal("chat"),
  Type.Literal("resource"),
  Type.Literal("third_party"),
]);

const AttendeeSchema = Type.Object({
  type: AttendeeType,
  user_id: Type.Optional(Type.String({ description: "User ID (for type=user)" })),
  chat_id: Type.Optional(Type.String({ description: "Chat ID (for type=chat)" })),
  room_id: Type.Optional(Type.String({ description: "Room ID (for type=resource)" })),
  third_party_email: Type.Optional(
    Type.String({ description: "Email address (for type=third_party)" }),
  ),
  is_optional: Type.Optional(Type.Boolean({ description: "Whether attendance is optional" })),
});

// Calendar Management Actions
const ListCalendarsAction = Type.Object({
  action: Type.Literal("list_calendars"),
  page_size: Type.Optional(Type.Number({ description: "Page size (default: 50, max: 500)" })),
  page_token: Type.Optional(Type.String({ description: "Page token for pagination" })),
  sync_token: Type.Optional(Type.String({ description: "Sync token for incremental sync" })),
});

const GetCalendarAction = Type.Object({
  action: Type.Literal("get_calendar"),
  calendar_id: Type.String({ description: "Calendar ID" }),
});

const GetPrimaryCalendarAction = Type.Object({
  action: Type.Literal("get_primary_calendar"),
  user_id_type: Type.Optional(UserIdType),
});

const CreateCalendarAction = Type.Object({
  action: Type.Literal("create_calendar"),
  summary: Type.String({ description: "Calendar name/summary" }),
  description: Type.Optional(Type.String({ description: "Calendar description" })),
  permissions: Type.Optional(
    Type.Union([
      Type.Literal("private"),
      Type.Literal("show_only_free_busy"),
      Type.Literal("public"),
    ]),
  ),
});

const DeleteCalendarAction = Type.Object({
  action: Type.Literal("delete_calendar"),
  calendar_id: Type.String({ description: "Calendar ID to delete" }),
});

// Event Management Actions
const ListEventsAction = Type.Object({
  action: Type.Literal("list_events"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  start_time: Type.Optional(
    Type.String({ description: "Start time filter (Unix timestamp in seconds)" }),
  ),
  end_time: Type.Optional(
    Type.String({ description: "End time filter (Unix timestamp in seconds)" }),
  ),
  page_size: Type.Optional(Type.Number({ description: "Page size (default: 50, max: 500)" })),
  page_token: Type.Optional(Type.String({ description: "Page token for pagination" })),
  sync_token: Type.Optional(Type.String({ description: "Sync token for incremental sync" })),
  user_id_type: Type.Optional(UserIdType),
});

const GetEventAction = Type.Object({
  action: Type.Literal("get_event"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  event_id: Type.String({ description: "Event ID" }),
  user_id_type: Type.Optional(UserIdType),
});

const CreateEventAction = Type.Object({
  action: Type.Literal("create_event"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  summary: Type.String({ description: "Event title/summary" }),
  start_time: Type.String({ description: "Start time (Unix timestamp in seconds)" }),
  end_time: Type.String({ description: "End time (Unix timestamp in seconds)" }),
  description: Type.Optional(Type.String({ description: "Event description" })),
  location: Type.Optional(Type.String({ description: "Event location" })),
  visibility: Type.Optional(VisibilityType),
  recurrence: Type.Optional(
    Type.String({ description: "RRULE format (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR)" }),
  ),
  need_notification: Type.Optional(
    Type.Boolean({ description: "Send notification to attendees (default: true)" }),
  ),
  timezone: Type.Optional(Type.String({ description: "Timezone (e.g., Asia/Shanghai)" })),
  attendees: Type.Optional(Type.Array(AttendeeSchema)),
  user_id_type: Type.Optional(UserIdType),
});

const UpdateEventAction = Type.Object({
  action: Type.Literal("update_event"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  event_id: Type.String({ description: "Event ID" }),
  summary: Type.Optional(Type.String({ description: "Event title/summary" })),
  start_time: Type.Optional(Type.String({ description: "Start time (Unix timestamp in seconds)" })),
  end_time: Type.Optional(Type.String({ description: "End time (Unix timestamp in seconds)" })),
  description: Type.Optional(Type.String({ description: "Event description" })),
  location: Type.Optional(Type.String({ description: "Event location" })),
  visibility: Type.Optional(VisibilityType),
  recurrence: Type.Optional(
    Type.String({ description: "RRULE format (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR)" }),
  ),
  need_notification: Type.Optional(
    Type.Boolean({ description: "Send notification to attendees" }),
  ),
  timezone: Type.Optional(Type.String({ description: "Timezone (e.g., Asia/Shanghai)" })),
  user_id_type: Type.Optional(UserIdType),
});

const DeleteEventAction = Type.Object({
  action: Type.Literal("delete_event"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  event_id: Type.String({ description: "Event ID to delete" }),
  need_notification: Type.Optional(
    Type.Boolean({ description: "Send cancellation notification" }),
  ),
});

// Attendee Management Actions
const ListAttendeesAction = Type.Object({
  action: Type.Literal("list_attendees"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  event_id: Type.String({ description: "Event ID" }),
  page_size: Type.Optional(Type.Number({ description: "Page size (default: 50, max: 500)" })),
  page_token: Type.Optional(Type.String({ description: "Page token for pagination" })),
  user_id_type: Type.Optional(UserIdType),
});

const AddAttendeesAction = Type.Object({
  action: Type.Literal("add_attendees"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  event_id: Type.String({ description: "Event ID" }),
  attendees: Type.Array(AttendeeSchema),
  need_notification: Type.Optional(
    Type.Boolean({ description: "Send notification to new attendees" }),
  ),
  user_id_type: Type.Optional(UserIdType),
});

const RemoveAttendeesAction = Type.Object({
  action: Type.Literal("remove_attendees"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  event_id: Type.String({ description: "Event ID" }),
  attendee_ids: Type.Array(Type.String({ description: "Attendee chat member IDs to remove" })),
  need_notification: Type.Optional(
    Type.Boolean({ description: "Send notification to removed attendees" }),
  ),
});

// Free/Busy Query
const QueryFreebusyAction = Type.Object({
  action: Type.Literal("query_freebusy"),
  time_min: Type.String({ description: "Query start time (Unix timestamp in seconds)" }),
  time_max: Type.String({ description: "Query end time (Unix timestamp in seconds)" }),
  user_ids: Type.Optional(
    Type.Array(Type.String({ description: "User IDs to check (supports multiple)" })),
  ),
  room_id: Type.Optional(Type.String({ description: "Room ID to check (single room only)" })),
  user_id_type: Type.Optional(UserIdType),
});

// Meeting Chat Actions
const CreateMeetingChatAction = Type.Object({
  action: Type.Literal("create_meeting_chat"),
  calendar_id: Type.String({
    description: "Calendar ID (must be primary calendar with writer permission)",
  }),
  event_id: Type.String({ description: "Event ID (event must have at least 2 attendees)" }),
});

const DeleteMeetingChatAction = Type.Object({
  action: Type.Literal("delete_meeting_chat"),
  calendar_id: Type.String({ description: "Calendar ID" }),
  event_id: Type.String({ description: "Event ID" }),
  meeting_chat_id: Type.String({ description: "Meeting chat ID to unbind" }),
});

// Combined schema
export const FeishuCalendarSchema = Type.Union([
  ListCalendarsAction,
  GetCalendarAction,
  GetPrimaryCalendarAction,
  CreateCalendarAction,
  DeleteCalendarAction,
  ListEventsAction,
  GetEventAction,
  CreateEventAction,
  UpdateEventAction,
  DeleteEventAction,
  ListAttendeesAction,
  AddAttendeesAction,
  RemoveAttendeesAction,
  QueryFreebusyAction,
  CreateMeetingChatAction,
  DeleteMeetingChatAction,
]);

export type FeishuCalendarParams = Static<typeof FeishuCalendarSchema>;
