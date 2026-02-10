---
name: feishu-feed
description: |
  Feishu feed card operations for prominent notifications in message list.
  Use cases: attendance reminders, meeting alerts, task notifications, urgent issue alerts, delivery tracking.
  Capabilities: create custom cards with buttons/labels, pin conversations to top, add quick action buttons.
---

# Feishu Feed Card Tool

Single tool `feishu_feed` with action parameter for all feed card operations.

## Parameter Naming (Important!)

| Action | User Parameter | Type | Note |
|--------|---------------|------|------|
| `create_app_feed_card` | `user_ids` | `string[]` | Array, batch create for multiple users |
| `update_app_feed_card` | `user_id` | `string` | **Singular**, update one user's card |
| `delete_app_feed_card` | `user_id` | `string` | **Singular**, delete one user's card |
| `set_bot_time_sensitive` | `user_ids` | `string[]` | Array, pin for multiple users |
| `set_chat_time_sensitive` | `user_ids` | `string[]` | Array, pin for multiple users |
| `update_chat_button` | `user_ids` | `string[]` | Array (optional), target specific users |

## Overview

Feishu Feed Cards enable displaying prominent cards in the message list with:
- **Buttons** - Quick action buttons (up to 2)
- **Status labels** - Colored labels for status indication
- **Time-sensitive mode** - Pin cards to top of message list
- **Custom notification sounds** - For urgent alerts

### Card Types

1. **App Feed Card** (`app_feed_card`) - Custom cards created by the app with full control over appearance, links, and actions
2. **Chat/Bot Feed Card** - Transform existing bot/group conversations into feed cards with buttons and pinning capability

## App Feed Card Operations

### Create App Feed Card

```json
{
  "action": "create_app_feed_card",
  "user_ids": ["ou_xxx", "ou_yyy"],
  "title": "New Training Assignment",
  "link": "https://example.com/training/123",
  "preview": "Complete safety training by Friday",
  "status_label": {
    "text": "Pending",
    "type": "danger"
  },
  "buttons": [
    {
      "action_type": "url_page",
      "text": "Start Learning",
      "button_type": "primary",
      "url": "https://example.com/training/123"
    }
  ],
  "time_sensitive": true
}
```

**Parameters:**
- `user_ids` - Target users (1-20 per request)
- `title` - Card title (1-60 chars)
- `link` - URL when card is clicked (HTTPS required)
- `preview` - Preview text (0-120 chars)
- `biz_id` - Custom business ID for tracking (optional)
- `avatar_key` - Avatar image key (optional)
- `status_label.type` - `primary`, `secondary`, `success`, `danger`
- `buttons[].action_type` - `url_page` (open URL) or `webhook` (callback)
- `buttons[].button_type` - `default`, `primary`, `success`
- `time_sensitive` - Pin to top when true
- `notify.close_notify` - Disable notification
- `notify.custom_sound_text` - Custom notification sound text
- `notify.with_custom_sound` - Enable custom sound

### Update App Feed Card

**Note:** Uses `user_id` (singular string), not `user_ids`.

```json
{
  "action": "update_app_feed_card",
  "biz_id": "task_123",
  "user_id": "ou_xxx",
  "update_fields": ["1", "10", "11"],
  "title": "Training Completed",
  "status_label": {
    "text": "Done",
    "type": "success"
  },
  "buttons": []
}
```

**Update fields:**
| Value | Field |
|-------|-------|
| `1` | Title |
| `2` | Avatar key |
| `3` | Preview text |
| `10` | Status label |
| `11` | Buttons |
| `12` | Link URL |
| `13` | Time-sensitive state |
| `101` | Update display time to now |
| `102` | Update sort time to now |
| `103` | Trigger notification |

**Important:** Only fields listed in `update_fields` will be updated.

### Delete App Feed Card

**Note:** Uses `user_id` (singular string), not `user_ids`.

```json
{
  "action": "delete_app_feed_card",
  "biz_id": "task_123",
  "user_id": "ou_xxx"
}
```

## Time-Sensitive (Pin to Top)

### Pin Bot Chat

Pin the bot conversation to top of user's message list:

```json
{
  "action": "set_bot_time_sensitive",
  "user_ids": ["ou_xxx", "ou_yyy"],
  "time_sensitive": true
}
```

Unpin:
```json
{
  "action": "set_bot_time_sensitive",
  "user_ids": ["ou_xxx"],
  "time_sensitive": false
}
```

**Note:** Supports up to 50 users per request.

### Pin Group Chat

Pin a group conversation for specific users:

```json
{
  "action": "set_chat_time_sensitive",
  "chat_id": "oc_xxx",
  "user_ids": ["ou_xxx", "ou_yyy"],
  "time_sensitive": true
}
```

**Note:** The bot must be a member of the group.

## Chat Button Operations

### Update Chat Buttons

Add quick action buttons to bot or group chat in message list:

```json
{
  "action": "update_chat_button",
  "chat_id": "oc_xxx",
  "buttons": [
    {
      "action_type": "url_page",
      "text": "Check In",
      "button_type": "primary",
      "url": "https://example.com/checkin"
    },
    {
      "action_type": "webhook",
      "text": "Quick Action",
      "button_type": "default",
      "action_map": { "action": "quick_task" }
    }
  ]
}
```

To remove buttons, pass empty array:
```json
{
  "action": "update_chat_button",
  "chat_id": "oc_xxx",
  "buttons": []
}
```

Target specific users only:
```json
{
  "action": "update_chat_button",
  "chat_id": "oc_xxx",
  "user_ids": ["ou_xxx"],
  "buttons": [...]
}
```

## Configuration

```yaml
channels:
  feishu:
    tools:
      feed: true  # default: true (enabled)
```

## Required Permissions

- `im:app_feed_card:write` - Create/update/delete app feed cards
- `im:datasync.feed_card.time_sensitive:write` - Time-sensitive (pin) capability

## Use Cases

### Attendance Reminder
1. Create feed card with "Check In" button 10 minutes before work
2. Pin to top with `time_sensitive: true`
3. After check-in, delete the card or update status to "Completed"

### Important Meeting Reminder
1. Create feed card with meeting info and "Join Meeting" button
2. Pin with `time_sensitive: true`
3. Show status label with time remaining
4. Unpin after meeting starts

### Task Notification
1. Create feed card for pending task
2. Keep pinned until completed
3. Update status label as task progresses
4. Delete card when task is done

### Urgent Alert (Complaints/Issues)
1. Create feed card with `time_sensitive: true`
2. Use `notify.with_custom_sound: true` for attention
3. Add quick action button for immediate response

## Notes

- Requires Feishu client V7.6+ for feed card display
- Maximum 20 users per `create_app_feed_card` request
- Maximum 50 users per `set_bot_time_sensitive` request
- Maximum 2 buttons per card
- Time-sensitive cards stay pinned until explicitly unpinned
- Cards are per-user; same `biz_id` creates separate cards for each user
