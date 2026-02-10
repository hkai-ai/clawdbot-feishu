import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type * as Lark from "@larksuiteoapi/node-sdk";
import { createFeishuClient } from "./client.js";
import { listEnabledFeishuAccounts } from "./accounts.js";
import { resolveToolsConfig } from "./tools-config.js";
import {
  FeishuMeetingSchema,
  type FeishuMeetingParams,
  type Invitee,
  type MeetingSettings,
  type RecordingPermissionObject,
} from "./meeting-schema.js";

// ============ Helpers ============

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

/**
 * Normalize invitees for LLM compatibility.
 * Handles: invitee (single), invitees (single | array)
 */
function normalizeInvitees(params: {
  invitee?: Invitee;
  invitees?: Invitee | Invitee[];
}): Invitee[] {
  const result: Invitee[] = [];

  // Handle invitees (can be single or array)
  if (params.invitees) {
    if (Array.isArray(params.invitees)) {
      result.push(...params.invitees);
    } else {
      result.push(params.invitees);
    }
  }

  // Handle invitee (single)
  if (params.invitee) {
    const exists = result.some((i) => i.id === params.invitee!.id);
    if (!exists) {
      result.unshift(params.invitee);
    }
  }

  return result;
}

/**
 * Normalize users for kickout operation.
 * Handles: user (single), users (single | array)
 */
function normalizeUsers(params: {
  user?: Invitee;
  users?: Invitee | Invitee[];
}): Invitee[] {
  const result: Invitee[] = [];

  // Handle users (can be single or array)
  if (params.users) {
    if (Array.isArray(params.users)) {
      result.push(...params.users);
    } else {
      result.push(params.users);
    }
  }

  // Handle user (single)
  if (params.user) {
    const exists = result.some((u) => u.id === params.user!.id);
    if (!exists) {
      result.unshift(params.user);
    }
  }

  return result;
}

/**
 * Normalize permission objects for LLM compatibility.
 * Handles: permission_object (single), permission_objects (single | array)
 */
function normalizePermissionObjects(params: {
  permission_object?: RecordingPermissionObject;
  permission_objects?: RecordingPermissionObject | RecordingPermissionObject[];
}): RecordingPermissionObject[] {
  const result: RecordingPermissionObject[] = [];

  // Handle permission_objects (can be single or array)
  if (params.permission_objects) {
    if (Array.isArray(params.permission_objects)) {
      result.push(...params.permission_objects);
    } else {
      result.push(params.permission_objects);
    }
  }

  // Handle permission_object (single)
  if (params.permission_object) {
    result.unshift(params.permission_object);
  }

  return result;
}

// ============ Meeting Operations ============

async function getMeeting(
  client: Lark.Client,
  meetingId: string,
  withParticipants?: boolean,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (withParticipants !== undefined) params.with_participants = withParticipants;
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const res = await client.vc.meeting.get({
    path: { meeting_id: meetingId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { meeting: res.data?.meeting };
}

async function inviteParticipants(
  client: Lark.Client,
  meetingId: string,
  invitees: Invitee[],
  userIdType?: string,
) {
  if (invitees.length === 0) {
    throw new Error("No invitees provided. Use invitee or invitees parameter.");
  }
  if (invitees.length > 10) {
    throw new Error("Maximum 10 invitees per request.");
  }

  const params: Record<string, unknown> = {};
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const res = await client.vc.meeting.invite({
    path: { meeting_id: meetingId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: {
      invitees: invitees.map((i) => {
        const inv: Record<string, unknown> = { id: i.id };
        if (i.user_type !== undefined) inv.user_type = i.user_type;
        return inv;
      }),
    },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    success: true,
    invite_results: res.data?.invite_results,
  };
}

async function endMeeting(client: Lark.Client, meetingId: string) {
  const res = await client.vc.meeting.end({
    path: { meeting_id: meetingId },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, meeting_id: meetingId };
}

async function kickoutParticipants(
  client: Lark.Client,
  meetingId: string,
  users: Invitee[],
  userIdType?: string,
) {
  if (users.length === 0) {
    throw new Error("No users provided. Use user or users parameter.");
  }
  if (users.length > 10) {
    throw new Error("Maximum 10 users per kickout request.");
  }

  const params: Record<string, unknown> = {};
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const res = await client.vc.meeting.kickout({
    path: { meeting_id: meetingId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: {
      kickout_users: users.map((u) => {
        const user: Record<string, unknown> = { id: u.id };
        if (u.user_type !== undefined) user.user_type = u.user_type;
        return user;
      }),
    },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    success: true,
    kickout_results: res.data?.kickout_results,
  };
}

async function setHost(
  client: Lark.Client,
  meetingId: string,
  hostUser: { id: string; user_type?: number },
  oldHostUser?: { id: string; user_type?: number },
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const hostUserData: Record<string, unknown> = { id: hostUser.id };
  if (hostUser.user_type !== undefined) hostUserData.user_type = hostUser.user_type;

  const data: Record<string, unknown> = { host_user: hostUserData };
  if (oldHostUser) {
    const oldHostData: Record<string, unknown> = { id: oldHostUser.id };
    if (oldHostUser.user_type !== undefined) oldHostData.user_type = oldHostUser.user_type;
    data.old_host_user = oldHostData;
  }

  const res = await client.vc.meeting.setHost({
    path: { meeting_id: meetingId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: data as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    success: true,
    host_user: res.data?.host_user,
  };
}

async function listMeetingsByNo(
  client: Lark.Client,
  meetingNo: string,
  startTime?: string,
  endTime?: string,
  pageToken?: string,
  pageSize?: number,
) {
  const params: Record<string, unknown> = { meeting_no: meetingNo };
  if (startTime !== undefined) params.start_time = startTime;
  if (endTime !== undefined) params.end_time = endTime;
  if (pageToken !== undefined) params.page_token = pageToken;
  if (pageSize !== undefined) params.page_size = pageSize;

  const res = await client.vc.meeting.listByNo({
    params: params as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    meetings: res.data?.meeting_briefs ?? [],
    page_token: res.data?.page_token,
    has_more: res.data?.has_more,
  };
}

// ============ Reserve Operations ============

async function createReserve(
  client: Lark.Client,
  endTime: string,
  meetingSettings?: MeetingSettings,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const data: Record<string, unknown> = { end_time: endTime };
  if (meetingSettings !== undefined) data.meeting_settings = meetingSettings;

  const res = await client.vc.reserve.apply({
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: data as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    reserve: res.data?.reserve,
    reserve_correction_check_info: res.data?.reserve_correction_check_info,
  };
}

async function getReserve(
  client: Lark.Client,
  reserveId: string,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const res = await client.vc.reserve.get({
    path: { reserve_id: reserveId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { reserve: res.data?.reserve };
}

async function updateReserve(
  client: Lark.Client,
  reserveId: string,
  endTime?: string,
  meetingSettings?: MeetingSettings,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const data: Record<string, unknown> = {};
  if (endTime !== undefined) data.end_time = endTime;
  if (meetingSettings !== undefined) data.meeting_settings = meetingSettings;

  const res = await client.vc.reserve.update({
    path: { reserve_id: reserveId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: data as any,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return {
    reserve: res.data?.reserve,
    reserve_correction_check_info: res.data?.reserve_correction_check_info,
  };
}

async function deleteReserve(client: Lark.Client, reserveId: string) {
  const res = await client.vc.reserve.delete({
    path: { reserve_id: reserveId },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, reserve_id: reserveId };
}

async function getActiveMeeting(
  client: Lark.Client,
  reserveId: string,
  withParticipants?: boolean,
  userIdType?: string,
) {
  const params: Record<string, unknown> = {};
  if (withParticipants !== undefined) params.with_participants = withParticipants;
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const res = await client.vc.reserve.getActiveMeeting({
    path: { reserve_id: reserveId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { meeting: res.data?.meeting };
}

// ============ Recording Operations ============

async function getRecording(client: Lark.Client, meetingId: string) {
  const res = await client.vc.meetingRecording.get({
    path: { meeting_id: meetingId },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { recording: res.data?.recording };
}

async function startRecording(
  client: Lark.Client,
  meetingId: string,
  timezone?: number,
) {
  const res = await client.vc.meetingRecording.start({
    path: { meeting_id: meetingId },
    data: {
      timezone: timezone ?? 8,
    },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, meeting_id: meetingId };
}

async function stopRecording(client: Lark.Client, meetingId: string) {
  const res = await client.vc.meetingRecording.stop({
    path: { meeting_id: meetingId },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, meeting_id: meetingId };
}

async function setRecordingPermission(
  client: Lark.Client,
  meetingId: string,
  permissionObjects: RecordingPermissionObject[],
  userIdType?: string,
) {
  if (permissionObjects.length === 0) {
    throw new Error(
      "No permission objects provided. Use permission_object or permission_objects parameter.",
    );
  }

  const params: Record<string, unknown> = {};
  if (userIdType !== undefined) params.user_id_type = userIdType;

  const res = await client.vc.meetingRecording.setPermission({
    path: { meeting_id: meetingId },
    params: Object.keys(params).length > 0 ? params as any : undefined,
    data: {
      permission_objects: permissionObjects.map((p) => ({
        id: p.id,
        type: p.type,
        permission: p.permission,
      })),
    },
  });
  if (res.code !== 0) throw new Error(`${res.msg ?? "Unknown error"} (code: ${res.code})`);
  return { success: true, meeting_id: meetingId };
}

// ============ Tool Registration ============

export function registerFeishuMeetingTools(api: OpenClawPluginApi) {
  if (!api.config) {
    api.logger.debug?.(
      "feishu_meeting: No config available, skipping meeting tools",
    );
    return;
  }

  const accounts = listEnabledFeishuAccounts(api.config);
  if (accounts.length === 0) {
    api.logger.debug?.(
      "feishu_meeting: No Feishu accounts configured, skipping meeting tools",
    );
    return;
  }

  const firstAccount = accounts[0];
  const toolsCfg = resolveToolsConfig(firstAccount.config.tools);

  if (!toolsCfg.meeting) {
    api.logger.debug?.("feishu_meeting: Meeting tools disabled in config");
    return;
  }

  const getClient = () => createFeishuClient(firstAccount);

  api.registerTool(
    {
      name: "feishu_meeting",
      label: "Feishu Meeting",
      description:
        "Feishu video conferencing operations. " +
        "Meeting actions: get_meeting, invite, end_meeting, kickout, set_host, list_by_no. " +
        "Reserve actions: create_reserve, get_reserve, update_reserve, delete_reserve, get_active_meeting. " +
        "Recording actions: get_recording, start_recording, stop_recording, set_recording_permission.",
      parameters: FeishuMeetingSchema,
      async execute(_toolCallId, params) {
        const p = params as FeishuMeetingParams;
        try {
          const client = getClient();

          switch (p.action) {
            // Meeting operations
            case "get_meeting":
              return json(
                await getMeeting(
                  client,
                  p.meeting_id,
                  p.with_participants,
                  p.user_id_type,
                ),
              );

            case "invite": {
              const invitees = normalizeInvitees(p);
              return json(
                await inviteParticipants(
                  client,
                  p.meeting_id,
                  invitees,
                  p.user_id_type,
                ),
              );
            }

            case "end_meeting":
              return json(await endMeeting(client, p.meeting_id));

            case "kickout": {
              const users = normalizeUsers(p);
              return json(
                await kickoutParticipants(
                  client,
                  p.meeting_id,
                  users,
                  p.user_id_type,
                ),
              );
            }

            case "set_host":
              return json(
                await setHost(
                  client,
                  p.meeting_id,
                  p.host_user,
                  p.old_host_user,
                  p.user_id_type,
                ),
              );

            case "list_by_no":
              return json(
                await listMeetingsByNo(
                  client,
                  p.meeting_no,
                  p.start_time,
                  p.end_time,
                  p.page_token,
                  p.page_size,
                ),
              );

            // Reserve operations
            case "create_reserve":
              return json(
                await createReserve(
                  client,
                  p.end_time,
                  p.meeting_settings,
                  p.user_id_type,
                ),
              );

            case "get_reserve":
              return json(
                await getReserve(client, p.reserve_id, p.user_id_type),
              );

            case "update_reserve":
              return json(
                await updateReserve(
                  client,
                  p.reserve_id,
                  p.end_time,
                  p.meeting_settings,
                  p.user_id_type,
                ),
              );

            case "delete_reserve":
              return json(await deleteReserve(client, p.reserve_id));

            case "get_active_meeting":
              return json(
                await getActiveMeeting(
                  client,
                  p.reserve_id,
                  p.with_participants,
                  p.user_id_type,
                ),
              );

            // Recording operations
            case "get_recording":
              return json(await getRecording(client, p.meeting_id));

            case "start_recording":
              return json(
                await startRecording(client, p.meeting_id, p.timezone),
              );

            case "stop_recording":
              return json(await stopRecording(client, p.meeting_id));

            case "set_recording_permission": {
              const permObjs = normalizePermissionObjects(p);
              return json(
                await setRecordingPermission(
                  client,
                  p.meeting_id,
                  permObjs,
                  p.user_id_type,
                ),
              );
            }

            default:
              return json({ error: `Unknown action: ${(p as any).action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_meeting" },
  );

  api.logger.info?.("feishu_meeting: Registered meeting tools");
}
