import type { ClawdbotConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import { getFeishuRuntime } from "./runtime.js";
import { resolveFeishuAccount } from "./accounts.js";
import { createFeishuReplyDispatcher } from "./reply-dispatcher.js";

// ============ VC Event Types (from @larksuiteoapi/node-sdk) ============

/** User ID structure in VC events */
export type VCUserIds = {
  union_id?: string;
  user_id?: string;
  open_id?: string;
};

/** User info in VC events */
export type VCUser = {
  id?: VCUserIds;
  user_role?: number;
  user_type?: number;
};

/** Meeting info structure */
export type VCMeetingInfo = {
  id?: string;
  topic?: string;
  meeting_no?: string;
  meeting_source?: number;
  start_time?: string;
  end_time?: string;
  host_user?: VCUser;
  owner?: VCUser;
  calendar_event_id?: string;
  meeting_sub_type?: number;
  security_setting?: {
    security_level?: number;
    group_ids?: string[];
    user_ids?: VCUserIds[];
    room_ids?: string[];
    has_set_security_contacts_and_group?: boolean;
  };
  webinar_setting?: {
    webinar_type?: number;
  };
};

/** Base event fields */
export type VCEventBase = {
  event_id?: string;
  token?: string;
  create_time?: string;
  event_type?: string;
  tenant_key?: string;
  ts?: string;
  uuid?: string;
  type?: string;
  app_id?: string;
};

/** Meeting started event */
export type VCMeetingStartedEvent = VCEventBase & {
  meeting?: VCMeetingInfo;
  operator?: VCUser;
};

/** Meeting ended event */
export type VCMeetingEndedEvent = VCEventBase & {
  meeting?: VCMeetingInfo;
  operator?: VCUser;
};

/** Recording ready event */
export type VCRecordingReadyEvent = VCEventBase & {
  meeting?: {
    id?: string;
    topic?: string;
    meeting_no?: string;
    meeting_source?: number;
    owner?: VCUser;
    meeting_sub_type?: number;
    security_setting?: {
      security_level?: number;
      group_ids?: string[];
      user_ids?: VCUserIds[];
      room_ids?: string[];
      has_set_security_contacts_and_group?: boolean;
    };
    webinar_setting?: {
      webinar_type?: number;
    };
  };
  url?: string;
  duration?: string;
};

// ============ Event Handlers ============

export type HandleVCEventParams = {
  cfg: ClawdbotConfig;
  accountId: string;
  runtime?: RuntimeEnv;
};

/**
 * Get the owner's open_id from a VC event.
 * Falls back to host_user if owner is not available.
 */
function getOwnerOpenId(event: VCMeetingStartedEvent | VCMeetingEndedEvent | VCRecordingReadyEvent): string | undefined {
  const meeting = event.meeting;
  if (!meeting) return undefined;

  // Try owner first
  if (meeting.owner?.id?.open_id) {
    return meeting.owner.id.open_id;
  }

  // Fall back to host_user
  if ("host_user" in meeting && meeting.host_user?.id?.open_id) {
    return meeting.host_user.id.open_id;
  }

  return undefined;
}

/**
 * Handle meeting started event - dispatch to agent.
 */
export async function handleMeetingStarted(
  event: VCMeetingStartedEvent,
  params: HandleVCEventParams,
): Promise<void> {
  const { cfg, accountId, runtime } = params;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  const meeting = event.meeting;
  if (!meeting?.id) {
    log(`feishu[${accountId}]: vc.meeting_started: missing meeting id, skipping`);
    return;
  }

  const ownerOpenId = getOwnerOpenId(event);
  if (!ownerOpenId) {
    log(`feishu[${accountId}]: vc.meeting_started: no owner/host open_id, logging only`);
    log(
      `feishu[${accountId}]: meeting started - id=${meeting.id}, topic="${meeting.topic ?? ""}", no=${meeting.meeting_no ?? ""}`,
    );
    return;
  }

  try {
    const core = getFeishuRuntime();
    const account = resolveFeishuAccount({ cfg, accountId });

    // Route to the meeting owner's session
    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "feishu",
      accountId,
      peer: { kind: "direct", id: ownerOpenId },
    });

    // Build notification message with LLM instruction
    const topic = meeting.topic ?? "Untitled Meeting";
    const meetingNo = meeting.meeting_no ?? "N/A";
    const messageBody =
      `[System: Feishu VC Notification - Meeting Started]\n` +
      `This is an automated system event from Feishu Video Conferencing.\n` +
      `- Meeting ID: ${meeting.id}\n` +
      `- Topic: ${topic}\n` +
      `- Meeting No: ${meetingNo}\n\n` +
      `[Instruction: Evaluate if this event requires any action based on your context and user preferences. ` +
      `If no response is needed, reply with exactly "NO_REPLY". ` +
      `Otherwise, you may notify the user or take appropriate action.]`;

    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const body = core.channel.reply.formatAgentEnvelope({
      channel: "Feishu",
      from: `vc:${meeting.id}`,
      timestamp: new Date(),
      envelope: envelopeOptions,
      body: messageBody,
    });

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: messageBody,
      CommandBody: messageBody,
      From: `feishu:vc:${meeting.id}`,
      To: `user:${ownerOpenId}`,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: "direct",
      SenderName: "Feishu VC",
      SenderId: "vc_system",
      Provider: "feishu" as const,
      Surface: "feishu" as const,
      MessageSid: `vc:meeting_started:${meeting.id}:${event.event_id ?? Date.now()}`,
      Timestamp: Date.now(),
      WasMentioned: false,
      CommandAuthorized: true,
      OriginatingChannel: "feishu" as const,
      OriginatingTo: `user:${ownerOpenId}`,
    });

    const { dispatcher, replyOptions, markDispatchIdle } = createFeishuReplyDispatcher({
      cfg,
      agentId: route.agentId,
      runtime: runtime as RuntimeEnv,
      chatId: ownerOpenId, // DM to owner
      accountId,
    });

    log(`feishu[${accountId}]: dispatching meeting_started to agent (session=${route.sessionKey})`);

    await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();
    log(`feishu[${accountId}]: meeting_started dispatch complete`);
  } catch (err) {
    error(`feishu[${accountId}]: failed to dispatch meeting_started: ${String(err)}`);
  }
}

/**
 * Handle meeting ended event - dispatch to agent.
 */
export async function handleMeetingEnded(
  event: VCMeetingEndedEvent,
  params: HandleVCEventParams,
): Promise<void> {
  const { cfg, accountId, runtime } = params;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  const meeting = event.meeting;
  if (!meeting?.id) {
    log(`feishu[${accountId}]: vc.meeting_ended: missing meeting id, skipping`);
    return;
  }

  const ownerOpenId = getOwnerOpenId(event);
  if (!ownerOpenId) {
    // Log only if no owner
    const startTime = meeting.start_time ? parseInt(meeting.start_time, 10) : 0;
    const endTime = meeting.end_time ? parseInt(meeting.end_time, 10) : 0;
    const durationMin = startTime && endTime ? Math.round((endTime - startTime) / 60) : 0;
    log(
      `feishu[${accountId}]: meeting ended - id=${meeting.id}, topic="${meeting.topic ?? ""}", duration=${durationMin}min`,
    );
    return;
  }

  try {
    const core = getFeishuRuntime();
    const account = resolveFeishuAccount({ cfg, accountId });

    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "feishu",
      accountId,
      peer: { kind: "direct", id: ownerOpenId },
    });

    // Calculate duration
    const startTime = meeting.start_time ? parseInt(meeting.start_time, 10) : 0;
    const endTime = meeting.end_time ? parseInt(meeting.end_time, 10) : 0;
    const durationMin = startTime && endTime ? Math.round((endTime - startTime) / 60) : 0;

    const topic = meeting.topic ?? "Untitled Meeting";
    const meetingNo = meeting.meeting_no ?? "N/A";
    const messageBody =
      `[System: Feishu VC Notification - Meeting Ended]\n` +
      `This is an automated system event from Feishu Video Conferencing.\n` +
      `- Meeting ID: ${meeting.id}\n` +
      `- Topic: ${topic}\n` +
      `- Meeting No: ${meetingNo}\n` +
      `- Duration: ${durationMin} minutes\n\n` +
      `[Instruction: Evaluate if this event requires any action based on your context and user preferences. ` +
      `If no response is needed, reply with exactly "NO_REPLY". ` +
      `Otherwise, you may notify the user or take appropriate action.]`;

    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const body = core.channel.reply.formatAgentEnvelope({
      channel: "Feishu",
      from: `vc:${meeting.id}`,
      timestamp: new Date(),
      envelope: envelopeOptions,
      body: messageBody,
    });

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: messageBody,
      CommandBody: messageBody,
      From: `feishu:vc:${meeting.id}`,
      To: `user:${ownerOpenId}`,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: "direct",
      SenderName: "Feishu VC",
      SenderId: "vc_system",
      Provider: "feishu" as const,
      Surface: "feishu" as const,
      MessageSid: `vc:meeting_ended:${meeting.id}:${event.event_id ?? Date.now()}`,
      Timestamp: Date.now(),
      WasMentioned: false,
      CommandAuthorized: true,
      OriginatingChannel: "feishu" as const,
      OriginatingTo: `user:${ownerOpenId}`,
    });

    const { dispatcher, replyOptions, markDispatchIdle } = createFeishuReplyDispatcher({
      cfg,
      agentId: route.agentId,
      runtime: runtime as RuntimeEnv,
      chatId: ownerOpenId,
      accountId,
    });

    log(`feishu[${accountId}]: dispatching meeting_ended to agent (session=${route.sessionKey})`);

    await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();
    log(`feishu[${accountId}]: meeting_ended dispatch complete`);
  } catch (err) {
    error(`feishu[${accountId}]: failed to dispatch meeting_ended: ${String(err)}`);
  }
}

/**
 * Handle recording ready event - dispatch to agent.
 * This is important as users often want to know when recording is available.
 */
export async function handleRecordingReady(
  event: VCRecordingReadyEvent,
  params: HandleVCEventParams,
): Promise<void> {
  const { cfg, accountId, runtime } = params;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  const meeting = event.meeting;
  if (!meeting?.id) {
    log(`feishu[${accountId}]: vc.recording_ready: missing meeting id, skipping`);
    return;
  }

  const ownerOpenId = getOwnerOpenId(event);
  if (!ownerOpenId) {
    log(
      `feishu[${accountId}]: recording ready - meeting_id=${meeting.id}, topic="${meeting.topic ?? ""}", url=${event.url ?? "N/A"}`,
    );
    return;
  }

  try {
    const core = getFeishuRuntime();
    const account = resolveFeishuAccount({ cfg, accountId });

    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "feishu",
      accountId,
      peer: { kind: "direct", id: ownerOpenId },
    });

    // Calculate duration in minutes
    const durationMs = event.duration ? parseInt(event.duration, 10) : 0;
    const durationMin = durationMs > 0 ? Math.round(durationMs / 1000 / 60) : 0;

    const topic = meeting.topic ?? "Untitled Meeting";
    const meetingNo = meeting.meeting_no ?? "N/A";
    const messageBody =
      `[System: Feishu VC Notification - Recording Ready]\n` +
      `This is an automated system event from Feishu Video Conferencing.\n` +
      `- Meeting ID: ${meeting.id}\n` +
      `- Topic: ${topic}\n` +
      `- Meeting No: ${meetingNo}\n` +
      `- Duration: ${durationMin} minutes\n` +
      `- Recording URL: ${event.url ?? "Not available"}\n\n` +
      `[Instruction: This event indicates a meeting recording is now available. ` +
      `Evaluate if the user should be notified about this recording. ` +
      `If no response is needed, reply with exactly "NO_REPLY". ` +
      `Otherwise, inform the user that their meeting recording is ready and provide the URL.]`;

    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const body = core.channel.reply.formatAgentEnvelope({
      channel: "Feishu",
      from: `vc:${meeting.id}`,
      timestamp: new Date(),
      envelope: envelopeOptions,
      body: messageBody,
    });

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: messageBody,
      CommandBody: messageBody,
      From: `feishu:vc:${meeting.id}`,
      To: `user:${ownerOpenId}`,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: "direct",
      SenderName: "Feishu VC",
      SenderId: "vc_system",
      Provider: "feishu" as const,
      Surface: "feishu" as const,
      MessageSid: `vc:recording_ready:${meeting.id}:${event.event_id ?? Date.now()}`,
      Timestamp: Date.now(),
      WasMentioned: false,
      CommandAuthorized: true,
      OriginatingChannel: "feishu" as const,
      OriginatingTo: `user:${ownerOpenId}`,
    });

    const { dispatcher, replyOptions, markDispatchIdle } = createFeishuReplyDispatcher({
      cfg,
      agentId: route.agentId,
      runtime: runtime as RuntimeEnv,
      chatId: ownerOpenId,
      accountId,
    });

    log(`feishu[${accountId}]: dispatching recording_ready to agent (session=${route.sessionKey})`);

    await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();
    log(`feishu[${accountId}]: recording_ready dispatch complete`);
  } catch (err) {
    error(`feishu[${accountId}]: failed to dispatch recording_ready: ${String(err)}`);
  }
}
