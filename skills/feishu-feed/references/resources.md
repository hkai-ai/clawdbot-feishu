# Feishu Feed Card API Reference

## Update Fields Reference

| Value | Field | Description |
|-------|-------|-------------|
| `1` | title | Card title |
| `2` | avatar_key | Avatar image key |
| `3` | preview | Preview text |
| `10` | status_label | Status label (text & color) |
| `11` | buttons | Action buttons |
| `12` | link | Click-through URL |
| `13` | time_sensitive | Pin state |
| `101` | display_time | Update display time to current |
| `102` | sort_time | Update sort time to current |
| `103` | notify | Trigger notification |

## Status Label Types

| Type | Color | Use Case |
|------|-------|----------|
| `primary` | Blue | Default/neutral |
| `secondary` | Gray | Inactive/disabled |
| `success` | Green | Completed/approved |
| `danger` | Red | Urgent/failed |

## Button Types

| Type | Style | Use Case |
|------|-------|----------|
| `default` | Outline | Secondary actions |
| `primary` | Filled blue | Main action |
| `success` | Filled green | Positive action |

## Error Reasons (failed_cards)

| Code | Meaning |
|------|---------|
| `0` | Unknown error |
| `1` | Invalid user ID |
| `2` | User not found |
| `3` | Card not found |
| `4` | Permission denied |

## Requirements

- Feishu client version: V7.6+
- Maximum users per create request: 20
- Maximum users per bot_time_sensitive request: 50
- Maximum buttons per card: 2
- Title length: 1-60 characters
- Preview length: 0-120 characters
- Button text length: 1-30 characters
