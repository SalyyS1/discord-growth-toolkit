# Discord Growth Toolkit

Bot + dashboard web để kéo người vào Discord của bạn: soạn nội dung xịn, phát
đúng chỗ, và đo được nguồn nào thực sự ra người.

## Bot này KHÔNG làm gì

Nó **không** quét member list của server khác rồi DM hàng loạt. Lý do:

- Discord Community Guidelines cấm unsolicited bulk messaging. Bot làm việc đó
  bị flag rất nhanh → app bị xoá, token bị reset, tài khoản dev có thể bị disable.
- Phần lớn user chặn DM từ người lạ trong server, nên đa số DM fail ngay.
- Người nhận không hề xin thông tin → server của bạn bị report kèm luôn.

Thay vào đó bot dùng **opt-in outreach**: đăng một panel có nút ở server đối
tác, ai bấm nút mới nhận DM. Có consent, log đầy đủ, tỷ lệ chuyển đổi cao hơn
spam nhiều lần vì người bấm là người thực sự quan tâm.

## Tính năng

**Soạn nội dung**
- Embed builder đầy đủ: title, description, màu, author, thumbnail, ảnh lớn,
  footer, timestamp, fields (inline/không inline), nhiều embed một tin.
- Nút link (`Tham Gia Discord ↗`) và nút opt-in cho panel.
- Chèn emoji server dạng `<:tanh_plusone:1497592408316055612>` bằng picker lấy
  emoji của mọi server bot đang ở.
- Preview render đúng như Discord: markdown (`**đậm**`, `# heading`, `-# subtext`,
  `> quote`, list, code block, spoiler, mention), emoji, embed, nút bấm.
- Placeholder: `{user}` `{user.name}` `{user.id}` `{server}` `{members}`
  `{invite}` `{source}`.
- Kiểm tra giới hạn Discord trước khi gửi (2000 ký tự content, 4096 description,
  6000 tổng embed, 25 field, 5 nút…) nên không ăn lỗi 400.
- Gửi thử vào DM của chính bạn để xem bản thật trước khi phát.

**Phát nội dung**
- Đăng bằng bot vào channel bất kỳ (có chọn server → channel, cảnh báo channel
  bot không gửi được).
- Sửa lại tin đã đăng (giữ message ID).
- Gửi qua webhook (webhook không gắn được nút opt-in vì nút cần bot xử lý).

**Đo lường**
- Mỗi nguồn một invite code riêng; bot đối chiếu số lượt dùng invite trước/sau
  khi có người join để biết ai đến từ đâu, kèm người tạo invite. Xử lý cả vanity URL.
- Bảng theo nguồn: join, còn ở, đã rời, % tổng join, giữ 7 ngày, giữ 30 ngày.
  Tỷ lệ giữ chỉ tính trên người đã join đủ 7/30 ngày để số không bị làm đẹp.
- Phễu theo server đối tác: bấm nút → DM gửi được → DM bị chặn → join.
- Chart join theo ngày, danh sách người join gần đây, log toàn bộ DM
  (sent / blocked_dm / failed / duplicate).

## Cài đặt

1. **Tạo app** ở https://discord.com/developers/applications → tab Bot → copy token.
   Bật **Server Members Intent** (bắt buộc, không có thì mất hết số liệu join).
2. **OAuth2 → Redirects**: thêm `http://localhost:3000/api/auth/callback`.
3. **Mời bot vào server nhà** với quyền: `Manage Server` (đọc invite),
   `Create Invite`, `View Channels`, `Send Messages`, `Embed Links`.
   Ở server đối tác chỉ cần `View Channels` + `Send Messages` + `Embed Links`.
4. **Cấu hình**

   ```bash
   cp .env.example .env
   # điền DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,
   # HOME_GUILD_ID (server của bạn), DASHBOARD_OWNER_IDS (Discord ID của bạn),
   # SESSION_SECRET (chuỗi random dài)
   npm install
   npm start
   ```

5. Mở http://localhost:3000 → đăng nhập bằng Discord.

## Quy trình dùng

1. **Nguồn & invite** → tạo một nguồn cho mỗi kênh kéo người
   (`partner-stella`, `tiktok-video-1`, …). Mỗi nguồn là một invite riêng.
2. **Soạn nội dung** → tạo template loại `panel` (tin có nút) và loại `dm`
   (tin gửi khi user bấm nút). Preview, rồi "Gửi thử vào DM của tôi" để kiểm tra.
3. **Server của bot** → chọn server đối tác, gán nhãn nguồn + invite + template
   panel + template DM.
4. Quay lại **Soạn nội dung**, chọn template panel, chọn server đối tác + channel
   → **Đăng lên channel**. Từ giờ ai bấm nút sẽ nhận DM.
5. **Thống kê** → xem nguồn nào ra người và giữ được người.

Muốn DM chào mừng người mới join server nhà: tạo template loại `welcome`, vào
**Server của bot** → server nhà → chọn template + bật toggle.

## Lệnh

```bash
npm start        # chạy bot + dashboard
npm run dev      # chạy với watch
npm test         # 21 test: markdown renderer, template/DB, chặn API khi chưa auth
npm run typecheck
```

## Kiến trúc

Một process Node: discord.js client + Express API + dashboard tĩnh.

```
src/config    đọc & validate env
src/db        node:sqlite (không cần native build), schema + repositories
src/shared    template → payload Discord, placeholder, validate giới hạn
src/bot       client, events, quy nguồn invite, DM sender, publisher
src/web       express, session cookie ký HMAC, routes
public        dashboard vanilla ESM + CSS (không build step)
tests         node:test
```

## Lưu ý bảo mật

- Dashboard mặc định chỉ nghe `127.0.0.1` vì nó gửi tin nhân danh bot. Muốn mở
  ra ngoài thì đặt `HOST=0.0.0.0` **và** đứng sau HTTPS + reverse proxy, đồng
  thời `PUBLIC_BASE_URL` phải là domain thật.
- Chỉ Discord ID có trong `DASHBOARD_OWNER_IDS` đăng nhập được; session là cookie
  HttpOnly ký HMAC, cookie giả mạo bị từ chối (có test).
- `.env` và `data/` đã nằm trong `.gitignore` — đừng commit token.
- DM được xếp hàng và giãn nhịp (`DM_INTERVAL_MS`, mặc định 2.5s) để không bị
  Discord coi là spam kể cả khi user đã đồng ý.
