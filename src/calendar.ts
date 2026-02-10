import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type * as Lark from "@larksuiteoapi/node-sdk";
import { createFeishuClient } from "./client.js";
import { listEnabledFeishuAccounts } from "./accounts.js";
import { resolveToolsConfig } from "./tools-config.js";
import { FeishuCalendarSchema, type FeishuCalendarParams } from "./calendar-schema.js";

// ============ Helpers ============

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

// ============ Calendar Management ============

async function listCalendars(
  client: Lark.Client,
  pageSize?: number,
  pageToken?: string,
  syncToken?: string,
) {
  const params: { page_size?: number; page_token?: string; sync_token?: string } = {};
  if (pageSize !== undefined) params.page_size = pageSize;
  if (pageToken !== undefined) params.page_token = pageToken;
  if (syncToken !== undefined) params.sync_token = syncToken;

  const res = await client.calendar.calendar.list({
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    calendars: res.data?.calendar_list ?? [],
    page_token: res.data?.page_token,
    sync_token: res.data?.sync_token,
    has_more: res.data?.has_more,
  };
}

async function getCalendar(client: Lark.Client, calendarId: string) {
  const res = await client.calendar.calendar.get({
    path: { calendar_id: calendarId },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { calendar: res.data };
}

async function getPrimaryCalendar(client: Lark.Client, userIdType?: string) {
  const params: Record<string, unknown> = {};
  if (userIdType) params.user_id_type = userIdType;

  const res = await client.calendar.calendar.primary({
    params: Object.keys(params).length > 0 ? params as any : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { calendars: res.data?.calendars ?? [] };
}

async function createCalendar(
  client: Lark.Client,
  summary: string,
  description?: string,
  permissions?: string,
) {
  const data: Record<string, unknown> = { summary };
  if (description !== undefined) data.description = description;
  if (permissions !== undefined) data.permissions = permissions;

  const res = await client.calendar.calendar.create({ data: data as any });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { calendar: res.data?.calendar };
}

async function deleteCalendar(client: Lark.Client, calendarId: string) {
  const res = await client.calendar.calendar.delete({
    path: { calendar_id: calendarId },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, calendar_id: calendarId };
}

// ============ Event Management ============

async function listEvents(
  client: Lark.Client,
  calendarId: string,
  startTime?: string,
  endTime?: string,
  pageSize?: number,
  pageToken?: string,
  syncToken?: string,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (startTime !== undefined) params.start_time = startTime;
  if (endTime !== undefined) params.end_time = endTime;
  if (pageSize !== undefined) params.page_size = pageSize;
  if (pageToken !== undefined) params.page_token = pageToken;
  if (syncToken !== undefined) params.sync_token = syncToken;
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const res = await client.calendar.calendarEvent.list({
    path: { calendar_id: calendarId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    events: res.data?.items ?? [],
    page_token: res.data?.page_token,
    sync_token: res.data?.sync_token,
    has_more: res.data?.has_more,
  };
}

async function getEvent(
  client: Lark.Client,
  calendarId: string,
  eventId: string,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (userIdType) params.user_id_type = userIdType;

  const res = await client.calendar.calendarEvent.get({
    path: { calendar_id: calendarId, event_id: eventId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { event: res.data?.event };
}

type AttendeeInput = {
  type: "user" | "chat" | "resource" | "third_party";
  user_id?: string;
  chat_id?: string;
  room_id?: string;
  third_party_email?: string;
  is_optional?: boolean;
};

function buildAttendees(attendees?: AttendeeInput[]) {
  if (!attendees || attendees.length === 0) return undefined;
  return attendees.map((a) => {
    const attendee: Record<string, unknown> = { type: a.type };
    if (a.type === "user" && a.user_id) attendee.user_id = a.user_id;
    if (a.type === "chat" && a.chat_id) attendee.chat_id = a.chat_id;
    if (a.type === "resource" && a.room_id) attendee.room_id = a.room_id;
    if (a.type === "third_party" && a.third_party_email) attendee.third_party_email = a.third_party_email;
    if (a.is_optional !== undefined) attendee.is_optional = a.is_optional;
    return attendee;
  });
}

async function createEvent(
  client: Lark.Client,
  calendarId: string,
  summary: string,
  startTime: string,
  endTime: string,
  options?: {
    description?: string;
    location?: string;
    visibility?: string;
    recurrence?: string;
    needNotification?: boolean;
    timezone?: string;
    attendees?: AttendeeInput[];
    userIdType?: string;
  },
) {
  const data: Record<string, unknown> = {
    summary,
    start_time: { timestamp: startTime },
    end_time: { timestamp: endTime },
    attendee_ability: "can_see_others",
  };
  if (options?.description !== undefined) data.description = options.description;
  if (options?.location) data.location = { name: options.location };
  if (options?.visibility !== undefined) data.visibility = options.visibility;
  if (options?.recurrence !== undefined) data.recurrence = options.recurrence;
  if (options?.needNotification !== undefined) data.need_notification = options.needNotification;

  const params: Record<string, unknown> = {};
  if (options?.userIdType) params.user_id_type = options.userIdType;

  const res = await client.calendar.calendarEvent.create({
    path: { calendar_id: calendarId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: data as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);

  const event = res.data?.event;
  const eventId = event?.event_id;

  // Add attendees if provided (must be done after event creation)
  if (eventId && options?.attendees && options.attendees.length > 0) {
    const attendeeRes = await client.calendar.calendarEventAttendee.create({
      path: { calendar_id: calendarId, event_id: eventId },
      params: { user_id_type: options.userIdType as any },
      data: {
        attendees: buildAttendees(options.attendees),
        need_notification: options.needNotification,
      },
    });
    if (attendeeRes.code !== 0) {
      return {
        event,
        warning: `Event created but failed to add attendees: ${attendeeRes.msg}`,
      };
    }
    return { event, attendees_added: attendeeRes.data?.attendees?.length ?? 0 };
  }

  return { event };
}

async function updateEvent(
  client: Lark.Client,
  calendarId: string,
  eventId: string,
  options?: {
    summary?: string;
    startTime?: string;
    endTime?: string;
    description?: string;
    location?: string;
    visibility?: string;
    recurrence?: string;
    needNotification?: boolean;
    timezone?: string;
    userIdType?: string;
  },
) {
  const data: Record<string, unknown> = {};
  if (options?.summary !== undefined) data.summary = options.summary;
  if (options?.description !== undefined) data.description = options.description;
  if (options?.startTime) data.start_time = { timestamp: options.startTime };
  if (options?.endTime) data.end_time = { timestamp: options.endTime };
  if (options?.location) data.location = { name: options.location };
  if (options?.visibility !== undefined) data.visibility = options.visibility;
  if (options?.recurrence !== undefined) data.recurrence = options.recurrence;
  if (options?.needNotification !== undefined) data.need_notification = options.needNotification;

  const params: Record<string, unknown> = {};
  if (options?.userIdType) params.user_id_type = options.userIdType;

  const res = await client.calendar.calendarEvent.patch({
    path: { calendar_id: calendarId, event_id: eventId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: data as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { event: res.data?.event };
}

async function deleteEvent(
  client: Lark.Client,
  calendarId: string,
  eventId: string,
  needNotification?: boolean,
) {
  const params: Record<string, unknown> = {};
  if (needNotification !== undefined) params.need_notification = needNotification ? "true" : "false";

  const res = await client.calendar.calendarEvent.delete({
    path: { calendar_id: calendarId, event_id: eventId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, calendar_id: calendarId, event_id: eventId };
}

// ============ Attendee Management ============

async function listAttendees(
  client: Lark.Client,
  calendarId: string,
  eventId: string,
  pageSize?: number,
  pageToken?: string,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (pageSize !== undefined) params.page_size = pageSize;
  if (pageToken !== undefined) params.page_token = pageToken;
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const res = await client.calendar.calendarEventAttendee.list({
    path: { calendar_id: calendarId, event_id: eventId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    attendees: res.data?.items ?? [],
    page_token: res.data?.page_token,
    has_more: res.data?.has_more,
  };
}

async function addAttendees(
  client: Lark.Client,
  calendarId: string,
  eventId: string,
  attendees: AttendeeInput[],
  needNotification?: boolean,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const data: Record<string, unknown> = { attendees: buildAttendees(attendees) };
  if (needNotification !== undefined) data.need_notification = needNotification;

  const res = await client.calendar.calendarEventAttendee.create({
    path: { calendar_id: calendarId, event_id: eventId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: data as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { attendees: res.data?.attendees ?? [] };
}

async function removeAttendees(
  client: Lark.Client,
  calendarId: string,
  eventId: string,
  attendeeIds: string[],
  needNotification?: boolean,
) {
  const data: Record<string, unknown> = { attendee_ids: attendeeIds };
  if (needNotification !== undefined) data.need_notification = needNotification;

  const res = await client.calendar.calendarEventAttendee.batchDelete({
    path: { calendar_id: calendarId, event_id: eventId },
    data: data as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, removed_count: attendeeIds.length };
}

// ============ Free/Busy Query ============

async function queryFreebusy(
  client: Lark.Client,
  timeMin: string,
  timeMax: string,
  userId?: string,
  userIds?: string[],
  roomId?: string,
  userIdType?: string,
) {
  // Normalize: merge user_id into user_ids if both provided
  const allUserIds = [...(userIds ?? [])];
  if (userId && !allUserIds.includes(userId)) {
    allUserIds.unshift(userId);
  }

  const params: Record<string, unknown> = {};
  if (userIdType) params.user_id_type = userIdType;

  // Multiple users → batch API
  if (allUserIds.length > 1) {
    const res = await client.calendar.freebusy.batch({
      params: Object.keys(params).length > 0 ? params as any : undefined,
      data: {
        time_min: timeMin,
        time_max: timeMax,
        user_ids: allUserIds,
      },
    });
    if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
    return { freebusy_lists: res.data?.freebusy_lists ?? [] };
  }

  // Single user or room → list API
  const singleUserId = allUserIds[0];
  if (!singleUserId && !roomId) {
    throw new Error("Must provide user_id, user_ids, or room_id");
  }

  const data: Record<string, unknown> = { time_min: timeMin, time_max: timeMax };
  if (singleUserId) data.user_id = singleUserId;
  if (roomId) data.room_id = roomId;

  const res = await client.calendar.freebusy.list({
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: data as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { freebusy_list: res.data?.freebusy_list ?? [] };
}

// ============ Meeting Chat ============

async function createMeetingChat(client: Lark.Client, calendarId: string, eventId: string) {
  const res = await client.calendar.calendarEventMeetingChat.create({
    path: { calendar_id: calendarId, event_id: eventId },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    meeting_chat_id: res.data?.meeting_chat_id,
    applink: res.data?.applink,
  };
}

async function deleteMeetingChat(
  client: Lark.Client,
  calendarId: string,
  eventId: string,
  meetingChatId: string,
) {
  const res = await client.calendar.calendarEventMeetingChat.delete({
    path: { calendar_id: calendarId, event_id: eventId },
    params: { meeting_chat_id: meetingChatId },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, calendar_id: calendarId, event_id: eventId };
}

// ============ Tool Registration ============

export function registerFeishuCalendarTools(api: OpenClawPluginApi) {
  if (!api.config) {
    api.logger.debug?.("feishu_calendar: No config available, skipping calendar tools");
    return;
  }

  const accounts = listEnabledFeishuAccounts(api.config);
  if (accounts.length === 0) {
    api.logger.debug?.("feishu_calendar: No Feishu accounts configured, skipping calendar tools");
    return;
  }

  const firstAccount = accounts[0];
  const toolsCfg = resolveToolsConfig(firstAccount.config.tools);

  if (!toolsCfg.calendar) {
    api.logger.debug?.("feishu_calendar: Calendar tools disabled in config");
    return;
  }

  const getClient = () => createFeishuClient(firstAccount);

  api.registerTool(
    {
      name: "feishu_calendar",
      label: "Feishu Calendar",
      description:
        "Feishu calendar operations. Actions: list_calendars, get_calendar, get_primary_calendar, create_calendar, delete_calendar, list_events, get_event, create_event, update_event, delete_event, list_attendees, add_attendees, remove_attendees, query_freebusy, create_meeting_chat, delete_meeting_chat",
      parameters: FeishuCalendarSchema,
      async execute(_toolCallId, params) {
        const p = params as FeishuCalendarParams;
        try {
          const client = getClient();
          switch (p.action) {
            case "list_calendars":
              return json(await listCalendars(client, p.page_size, p.page_token, p.sync_token));
            case "get_calendar":
              return json(await getCalendar(client, p.calendar_id));
            case "get_primary_calendar":
              return json(await getPrimaryCalendar(client, p.user_id_type));
            case "create_calendar":
              return json(await createCalendar(client, p.summary, p.description, p.permissions));
            case "delete_calendar":
              return json(await deleteCalendar(client, p.calendar_id));
            case "list_events":
              return json(
                await listEvents(
                  client,
                  p.calendar_id,
                  p.start_time,
                  p.end_time,
                  p.page_size,
                  p.page_token,
                  p.sync_token,
                  p.user_id_type,
                ),
              );
            case "get_event":
              return json(await getEvent(client, p.calendar_id, p.event_id, p.user_id_type));
            case "create_event":
              return json(
                await createEvent(client, p.calendar_id, p.summary, p.start_time, p.end_time, {
                  description: p.description,
                  location: p.location,
                  visibility: p.visibility,
                  recurrence: p.recurrence,
                  needNotification: p.need_notification,
                  timezone: p.timezone,
                  attendees: p.attendees,
                  userIdType: p.user_id_type,
                }),
              );
            case "update_event":
              return json(
                await updateEvent(client, p.calendar_id, p.event_id, {
                  summary: p.summary,
                  startTime: p.start_time,
                  endTime: p.end_time,
                  description: p.description,
                  location: p.location,
                  visibility: p.visibility,
                  recurrence: p.recurrence,
                  needNotification: p.need_notification,
                  timezone: p.timezone,
                  userIdType: p.user_id_type,
                }),
              );
            case "delete_event":
              return json(
                await deleteEvent(client, p.calendar_id, p.event_id, p.need_notification),
              );
            case "list_attendees":
              return json(
                await listAttendees(
                  client,
                  p.calendar_id,
                  p.event_id,
                  p.page_size,
                  p.page_token,
                  p.user_id_type,
                ),
              );
            case "add_attendees":
              return json(
                await addAttendees(
                  client,
                  p.calendar_id,
                  p.event_id,
                  p.attendees,
                  p.need_notification,
                  p.user_id_type,
                ),
              );
            case "remove_attendees":
              return json(
                await removeAttendees(
                  client,
                  p.calendar_id,
                  p.event_id,
                  p.attendee_ids,
                  p.need_notification,
                ),
              );
            case "query_freebusy":
              return json(
                await queryFreebusy(
                  client,
                  p.time_min,
                  p.time_max,
                  p.user_id,
                  p.user_ids,
                  p.room_id,
                  p.user_id_type,
                ),
              );
            case "create_meeting_chat":
              return json(await createMeetingChat(client, p.calendar_id, p.event_id));
            case "delete_meeting_chat":
              return json(
                await deleteMeetingChat(client, p.calendar_id, p.event_id, p.meeting_chat_id),
              );
            default:
              return json({ error: `Unknown action: ${(p as any).action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_calendar" },
  );

  api.logger.info?.("feishu_calendar: Registered calendar tools");
}
