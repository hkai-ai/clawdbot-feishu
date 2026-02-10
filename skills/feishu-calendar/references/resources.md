# 日历与日程资源

## 日历资源

### 日历类型

| 类型 | 说明 |
|------|------|
| `primary` | 用户/应用的主日历 |
| `shared` | 创建的共享日历 |
| `google` | 绑定的谷歌日历 |
| `resource` | 会议室日历 |
| `exchange` | 绑定的Exchange日历 |

### 日历公开范围 (permissions)

| 值 | 说明 |
|----|------|
| `private` | 私密 |
| `show_only_free_busy` | 仅展示忙闲信息 |
| `public` | 他人可查看日程详情 |

### 访问权限 (role)

| 值 | 说明 |
|----|------|
| `free_busy_reader` | 游客，只能看忙/闲 |
| `reader` | 订阅者，可查看日程详情 |
| `writer` | 编辑者，可创建修改日程 |
| `owner` | 管理员，可管理日历设置 |

### 限制

单个用户/应用可订阅的日历上限: **1000**

## 日程资源

### 时间格式

- **Unix 时间戳**: 秒级，如 `"1767225600"` = 2026-01-01 00:00:00 UTC
- **全天日程日期**: RFC3339 日期格式，如 `"2026-01-01"`
- **时区**: IANA 格式，如 `"Asia/Shanghai"`

### 日程可见性 (visibility)

| 值 | 说明 |
|----|------|
| `default` | 订阅者有 reader 权限可查看详情 |
| `public` | 所有订阅者都能查看详情 |
| `private` | 仅 writer/owner 可查看详情 |

### 参与人权限 (attendee_ability)

| 值 | 说明 |
|----|------|
| `none` | 无法编辑/邀请/查看参与人 |
| `can_see_others` | 可查看参与人列表 |
| `can_invite_others` | 可邀请参与人 |
| `can_modify_event` | 可编辑日程 |

### 日程状态 (status)

| 值 | 说明 |
|----|------|
| `tentative` | 暂未回应 |
| `confirmed` | 已确认 |
| `cancelled` | 已删除 |

### 忙闲状态 (free_busy_status)

| 值 | 说明 |
|----|------|
| `busy` | 忙碌 |
| `free` | 空闲 |

## 重复日程 (RRULE)

使用 RFC5545 RRULE 格式定义重复规则。

### 常用组件

| 组件 | 说明 | 示例 |
|------|------|------|
| `FREQ` | 重复频率 (必填) | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` |
| `INTERVAL` | 间隔 | `INTERVAL=2` = 每隔一次 |
| `COUNT` | 重复次数 | `COUNT=10` |
| `UNTIL` | 结束时间 | `UNTIL=20261231T235959Z` |
| `BYDAY` | 指定星期 | `BYDAY=MO,WE,FR` |
| `BYMONTHDAY` | 指定日期 | `BYMONTHDAY=1,15` |

**注意**: `COUNT` 和 `UNTIL` 不能同时使用。

### 示例

| 规则 | 含义 |
|------|------|
| `FREQ=DAILY;COUNT=10` | 每天，共10次 |
| `FREQ=WEEKLY;BYDAY=MO,WE,FR` | 每周一/三/五 |
| `FREQ=WEEKLY;INTERVAL=2;BYDAY=TU` | 每两周的周二 |
| `FREQ=MONTHLY;BYMONTHDAY=1` | 每月1号 |
| `FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1` | 每年1月1日 |

### 例外日程

当重复日程的某次 instance 被单独修改时，会产生例外日程：
- `is_exception: true` 表示这是例外日程
- `recurring_event_id` 指向原重复日程
- `status: cancelled` 表示该次被取消

## 日程组织者

日程组织者 = 创建日程时所在的日历：
- 应用用 `tenant_access_token` 在主日历创建 → 组织者是应用主日历
- 用户用 `user_access_token` 在主日历创建 → 组织者是用户主日历
- 在共享日历创建 → 组织者是共享日历

组织者对日程有完整权限。
