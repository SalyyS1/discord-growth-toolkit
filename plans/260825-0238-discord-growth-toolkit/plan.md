# Discord Growth Toolkit — SukiMC

Status: in progress (v1 scaffold)
Created: 2026-08-25

## Mục tiêu

Bot + dashboard web để kéo người vào Discord SukiMC bằng cách **hợp ToS**:
soạn nội dung xịn, phát đúng chỗ, đo được nguồn nào ra người.

## Ngoài phạm vi (từ chối có lý do)

- Quét member list server người khác rồi DM hàng loạt → vi phạm Discord
  Community Guidelines (unsolicited bulk messaging), rủi ro ban app + acc dev.
- Selfbot / dùng token acc người thật làm bot → ban acc.

Thay thế: **opt-in outreach** — panel có button ở server đối tác, chỉ user bấm
nút mới nhận DM. Có consent, log đầy đủ, không spam.

## Kiến trúc

Một process Node duy nhất: discord.js client + Express API + static dashboard.

```
src/config      env loading
src/db          node:sqlite (không cần native build) + repositories
src/shared      template payload -> Discord REST payload, placeholders, emoji
src/bot         client, events, invite attribution, dm sender, publisher
src/web         express, session cookie ký HMAC, routes
public          dashboard (vanilla ESM, không build step)
```

Stack: Node 24 + TypeScript qua `tsx` (không build artifact), discord.js 14,
`node:sqlite`, Express 4, dashboard vanilla + CSS tokens (preview cần render
giống Discord nên tự viết markdown renderer).

## Phases

| # | Nội dung | Status |
|---|----------|--------|
| 1 | Scaffold + DB schema + repositories | done |
| 2 | Template payload + publisher (channel / webhook) | done |
| 3 | Invite tracking + attribution + retention | done |
| 4 | Opt-in panel + welcome DM + outreach log | done |
| 5 | Web API + Discord OAuth (owner-only) | done |
| 6 | Dashboard UI (servers / composer / analytics / settings) | done |
| 7 | `npm install`, typecheck, 21 test node:test đều xanh | done |
| 8 | Pass làm sạch UI: design token, sidebar có icon, card/table/KPI dùng chung, preview dính khi cuộn, form gấp gọn | done |
| 9 | Smoke test với token thật + bật Server Members Intent | pending user |

## Ghi chú pass UI (phase 8)

- Token dashboard tách sang `public/css/theme-tokens.css`; màu Discord của preview
  khai riêng trong `discord-message-preview.css` để đổi theme không làm preview sai màu.
- Helper dùng chung trong `dom-helpers.js` (`card`, `pageHead`, `dataTable`,
  `collapsible`, `emptyState`, `skeletonCard`) — bỏ code bảng/card lặp ở 3 view.
- Embed editor gấp lại được, phần author/ảnh/footer nằm trong toggle riêng.
- Cột preview + gửi đi dính khi cuộn form; dưới 1180px thì xếp dọc, dưới 900px
  sidebar thành thanh ngang.
- Thêm `GET /api/status` cho chỉ báo bot online / thiếu quyền invite ở sidebar.

## Acceptance criteria

- Dashboard login bằng Discord OAuth, chỉ ID trong `DASHBOARD_OWNER_IDS` vào được.
- List server bot đang ở; click 1 server → config riêng (invite code, source
  label, template panel/DM, welcome DM on/off).
- Composer: content + embed đầy đủ field + link button, chèn emoji server dạng
  `<:name:id>`, preview render giống Discord (markdown, emoji, embed, button).
- Publish tới channel (bot) hoặc webhook; lưu message_id để sửa lại sau.
- Panel opt-in: deploy vào channel server đối tác, user bấm → nhận DM template,
  mọi lần gửi đều log (sent / blocked_dm / failed / duplicate).
- Analytics: join theo ngày, bảng theo nguồn (clicks → DM → join → retain 7/30d),
  danh sách người join kèm nguồn + inviter.

## Ghi chú kỹ thuật

- Invite attribution: cache uses của toàn bộ invite mỗi guild, `guildMemberAdd`
  → fetch lại, diff `uses` để tìm code. Cần `Manage Guild` ở home guild.
- Cần privileged intent `GUILD_MEMBERS` (bật ở Developer Portal).
- Vanity URL được xử lý riêng (không xuất hiện trong invite list thường).
- DM sender: giới hạn nhịp gửi + chỉ gửi cho user có bản ghi consent.

## Unresolved

- Home guild ID (Discord SukiMC) — điền vào `.env`.
- Có cần liên kết join Discord → join Minecraft server (whitelist/link code) để
  đo conversion cuối không? Hiện chỉ đo tới mức "join Discord + còn ở lại".
