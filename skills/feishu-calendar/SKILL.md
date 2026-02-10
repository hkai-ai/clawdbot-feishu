---
name: feishu-calendar
description: |
  Feishu calendar and event operations. Activate when user mentions calendar, events, meetings, scheduling, attendees, or meeting rooms.
---

# Feishu Calendar Tool

Single tool `feishu_calendar` with action parameter for all calendar/event operations.

## Calendar Management

### List Calendars

```json
{ "action": "list_calendars" }
```

With pagination:
```json
{ "action": "list_calendars", "page_size": 50, "page_token": "xxx" }
```

### Get Primary Calendar

```json
{ "action": "get_primary_calendar" }
```

### Get Calendar by ID

```json
{ "action": "get_calendar", "calendar_id": "feishu.cn_xxx@group.calendar.feishu.cn" }
```

### Create Shared Calendar

```json
{ "action": "create_calendar", "summary": "Team Calendar", "description": "Team events" }
```

Permissions: `private`, `show_only_free_busy`, `public`

### Delete Calendar

```json
{ "action": "delete_calendar", "calendar_id": "feishu.cn_xxx@group.calendar.feishu.cn" }
```

## Event Management

### List Events (with time range)

```json
{
  "action": "list_events",
  "calendar_id": "feishu.cn_xxx@group.calendar.feishu.cn",
  "start_time": "1767225600",
  "end_time": "1767312000"
}
```

**Note:** Times are Unix timestamps in seconds.

### Get Event

```json
{ "action": "get_event", "calendar_id": "xxx", "event_id": "yyy" }
```

### Create Event

```json
{
  "action": "create_event",
  "calendar_id": "feishu.cn_xxx@group.calendar.feishu.cn",
  "summary": "Weekly Standup",
  "start_time": "1767258000",
  "end_time": "1767261600",
  "description": "Team sync meeting",
  "location": "Meeting Room A"
}
```

With attendees:
```json
{
  "action": "create_event",
  "calendar_id": "xxx",
  "summary": "Project Review",
  "start_time": "1767258000",
  "end_time": "1767261600",
  "attendees": [
    { "type": "user", "user_id": "ou_xxx" },
    { "type": "resource", "room_id": "omm_xxx" }
  ]
}
```

With recurrence (RRULE format):
```json
{
  "action": "create_event",
  "calendar_id": "xxx",
  "summary": "Daily Standup",
  "start_time": "1767258000",
  "end_time": "1767261600",
  "recurrence": "FREQ=DAILY;COUNT=30"
}
```

Common RRULE patterns:
- `FREQ=DAILY;COUNT=10` - Daily for 10 occurrences
- `FREQ=WEEKLY;BYDAY=MO,WE,FR` - Every Mon/Wed/Fri
- `FREQ=MONTHLY;BYMONTHDAY=1` - First day of each month

### Update Event

```json
{
  "action": "update_event",
  "calendar_id": "xxx",
  "event_id": "yyy",
  "summary": "Updated Title",
  "description": "New description"
}
```

### Delete Event

```json
{
  "action": "delete_event",
  "calendar_id": "xxx",
  "event_id": "yyy",
  "need_notification": true
}
```

## Attendee Management

### List Attendees

```json
{ "action": "list_attendees", "calendar_id": "xxx", "event_id": "yyy" }
```

### Add Attendees

```json
{
  "action": "add_attendees",
  "calendar_id": "xxx",
  "event_id": "yyy",
  "attendees": [
    { "type": "user", "user_id": "ou_xxx" },
    { "type": "chat", "chat_id": "oc_xxx" },
    { "type": "resource", "room_id": "omm_xxx" },
    { "type": "third_party", "third_party_email": "guest@example.com" }
  ],
  "need_notification": true
}
```

**Attendee types:**
- `user` - Feishu user (use `user_id`)
- `chat` - Group chat (use `chat_id`)
- `resource` - Meeting room (use `room_id`)
- `third_party` - External email (use `third_party_email`)

### Remove Attendees

```json
{
  "action": "remove_attendees",
  "calendar_id": "xxx",
  "event_id": "yyy",
  "attendee_ids": ["attendee_id_1", "attendee_id_2"]
}
```

## Free/Busy Query

Query single user:
```json
{
  "action": "query_freebusy",
  "time_min": "1767225600",
  "time_max": "1767312000",
  "user_id": "ou_xxx",
  "user_id_type": "open_id"
}
```

Query multiple users (batch API):
```json
{
  "action": "query_freebusy",
  "time_min": "1767225600",
  "time_max": "1767312000",
  "user_ids": ["ou_xxx", "ou_yyy"],
  "user_id_type": "open_id"
}
```

Query single room:
```json
{
  "action": "query_freebusy",
  "time_min": "1767225600",
  "time_max": "1767312000",
  "room_id": "omm_xxx"
}
```

**Note:** Use `user_id` for single user, `user_ids` for multiple users (batch API), `room_id` for meeting room.

## Meeting Chat

Create a group chat for an event's attendees.

### Create Meeting Chat

```json
{
  "action": "create_meeting_chat",
  "calendar_id": "feishu.cn_xxx@group.calendar.feishu.cn",
  "event_id": "75d28f9b-e35c-4230-8a83-123_0"
}
```

Returns: `meeting_chat_id`, `applink`

**Requirements:**
- Calendar must be the current identity's primary calendar with writer permission
- Event must have at least 2 attendees
- Attendee list must not be hidden

### Delete Meeting Chat

```json
{
  "action": "delete_meeting_chat",
  "calendar_id": "xxx",
  "event_id": "yyy",
  "meeting_chat_id": "oc_xxx"
}
```

**Note:** Only the group owner can unbind the meeting chat.

## Configuration

```yaml
channels:
  feishu:
    tools:
      calendar: true  # default: false (disabled)
```

## Required Permissions

- `calendar:calendar` - Full calendar/event access
- `calendar:calendar:readonly` - Read-only access (optional)

## Common Patterns

### Book Meeting Room

1. Create event first
2. Add meeting room as attendee with `type: "resource"`
3. Room booking is async - check result after a few seconds

### Check Availability Before Scheduling

1. Use `query_freebusy` to check user/room availability
2. Find available time slot
3. Create event with attendees

### Repeating Meeting

Use `recurrence` field with RRULE format when creating event.
