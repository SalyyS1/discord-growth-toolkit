# Discord Growth Toolkit

Bot + dashboard web để kéo người vào Discord của bạn: soạn nội dung xịn, phát
đúng chỗ, và đo được nguồn nào thực sự ra người.

## Bot này KHÔNG làm gì

Nó **không** quét member list rồi DM hàng loạt — kể cả member của server nhà,
kể cả khi chỉ admin bấm được và có nút từ chối trong tin nhắn. Lý do:

- Discord Community Guidelines cấm unsolicited bulk messaging. Consent phải có
  **trước** DM đầu tiên; nút "từ chối" nằm trong tin nhắn thứ nhất thì tin đó
  vẫn là tin không ai xin. Bot làm việc đó bị flag rất nhanh → app bị xoá, token
  bị reset, tài khoản dev có thể bị disable.
- Phần lớn user chặn DM từ người lạ trong server, nên đa số DM fail ngay (lỗi
  50007). Discord không có API để biết trước ai đang mở DM.
- Người nhận không hề xin thông tin → server của bạn bị report kèm luôn.

Thay vào đó bot dùng **opt-in outreach**: đăng một panel có nút, ai bấm nút mới
nhận DM. Có consent, log đầy đủ, tỷ lệ chuyển đổi cao hơn spam nhiều lần vì
người bấm là người thực sự quan tâm. Cần thông báo cho cả server thì đăng vào
channel và ping role — xem "Thông báo sự kiện cho member server nhà" bên dưới.

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
- Bản nháp tự lưu trong máy: tải lại trang hay đổi tab vẫn mở lại được. `Ctrl+S`
  để lưu lên server. Server/channel và nội dung chọn lần trước được nhớ lại.

**Components V2 (tuỳ chọn)**
- Bật một công tắc là chuyển từ embed cổ điển sang layout component mới: khung
  có vạch màu, section (text kèm ảnh nhỏ hoặc nút link), thư viện 1-10 ảnh,
  vạch ngăn cách, hàng nút — kéo lên kéo xuống để đổi thứ tự.
- Ô URL ảnh có xem trước ngay bên cạnh, hỗ trợ alt text và spoiler cho từng ảnh.
- Preview trong dashboard render đúng khung, ảnh và vạch màu như Discord.
- Kiểm tra sẵn các giới hạn riêng của V2: tối đa 40 component một tin, tổng
  4000 ký tự, gallery 10 ảnh, section tối đa 3 dòng và phải có phụ kiện.
- Ba điều Discord bắt buộc, bot xử lý sẵn: bật V2 thì `content` và `embed` bị bỏ
  qua; webhook không gửi được V2 (phải đăng bằng bot); một tin đã đăng ở chế độ
  V2 **không** đổi lại về embed được, chỉ đăng tin mới.
- Vì Discord bỏ `content`/`embed`, lúc bật V2 nội dung cũ được tự chuyển thành
  khối V2 (text ngoài embed → khối text; title/description/fields → text;
  thumbnail → phụ kiện section; ảnh lớn → gallery). Nút "Chuyển nội dung cũ sang
  V2" chạy lại việc đó khi cần. Khung V2 rỗng mà text cũ còn nội dung thì bị
  chặn gửi, để không phát ra tin chỉ có nút.

**Thông báo cho người đã đăng ký**
- Panel có nút "đăng ký nhận thông báo" đăng ở server nhà: ai bấm thì được thêm
  vào danh sách và được gán role thông báo (nếu đã chọn role).
- Hai nhóm nhận khi gửi một đợt:
  - **Tất cả thành viên đang có role thông báo** — dùng khi role đó là role người
    dùng tự nhận (bấm nút, reaction role của bot khác…). Việc họ giữ role chính
    là bằng chứng đồng ý. **Đừng** trỏ vào role bạn tự gán hay role mặc định của
    server: gửi DM cho nhóm không xin gì là spam, Discord xử lý bot rất nhanh.
    `@everyone` bị chặn thẳng.
  - **Chỉ người đã bấm nút đăng ký** — hẹp hơn, đúng những ai có bản ghi trong DB.
- Dashboard hiện số người thật của từng nhóm trước khi gửi (đã trừ bot và người
  đã bấm huỷ nhận), và ghi lại nhóm nhận của từng đợt trong lịch sử.
- Mỗi đợt chỉ tới mỗi người một lần, chạy lại đợt cũ chỉ thử lại người trước đó
  đang đóng DM.
- Mọi DM thông báo đều kèm nút **Huỷ nhận thông báo**; bấm là bị gỡ role và bị
  loại khỏi mọi đợt sau, kể cả đợt gửi theo role và kể cả khi họ chưa từng bấm
  nút đăng ký.
- Người rời server bị bỏ khỏi danh sách vì bối cảnh đồng ý không còn.
- Đợt gửi chạy nền và ghi tiến độ vào DB, nên đóng dashboard giữa đợt không sao.

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

Hướng dẫn đầy đủ có bảng quyền, link mời tự sinh và mục sự cố thường gặp:
mở `docs/setup-guide.html` bằng trình duyệt. Bản rút gọn:

1. **Tạo app** ở https://discord.com/developers/applications → tab Bot → copy token.
   Bật **Server Members Intent** (bắt buộc, không có thì mất hết số liệu join).
2. **OAuth2 → Redirects**: thêm `http://localhost:3000/api/auth/callback`.
3. **Mời bot vào server nhà** với quyền: `Manage Server` (đọc invite),
   `Create Invite`, `View Channels`, `Send Messages`, `Embed Links`, và
   `Manage Roles` nếu muốn bot gán role cho người đăng ký nhận thông báo (role
   đó phải nằm **dưới** role của bot, không thì Discord từ chối).
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

## Thông báo sự kiện cho member server nhà

Không quét member list rồi DM tất cả. Luồng đúng là để member tự xin nhận:

1. **Soạn nội dung** → template loại `panel`, bật nút opt-in, chọn *"Ghi danh nhận
   thông báo ở server nhà"*, viết luôn lời nhắn hiện ra sau khi bấm.
2. Đăng panel đó vào một channel ở **server nhà** (thường là `#thông-báo` hoặc
   `#roles`).
3. **Thông báo** → chọn role gán cho người đăng ký (không bắt buộc, nhưng có role
   thì ping trong channel được, và gửi theo role được) → Lưu.
4. Tạo thêm một template loại `dm` là nội dung sự kiện muốn gửi.
5. Quay lại **Thông báo** → chọn nội dung đó, chọn nhóm nhận (tất cả người có
   role, hay chỉ người đã bấm nút), đặt tên đợt (vd `event-halloween`) → **Gửi**.
   Tiến độ hiện ngay tại đó.

Một đợt vài trăm người mất hàng chục phút vì mỗi DM giãn `DM_INTERVAL_MS`. Đó là
cố ý: gửi dồn là cách nhanh nhất để bot bị Discord đánh dấu spam.

Ai cũng có thể tự rút lại bằng nút **Huỷ nhận thông báo** đính kèm mọi DM thông
báo. Xoá role bằng tay thì họ không còn trong nhóm "có role" nữa, nhưng nếu từng
bấm nút đăng ký thì vẫn còn trong nhóm "đã bấm nút" — nút huỷ mới là cách rút
khỏi cả hai.

## Lệnh

```bash
npm start        # chạy bot + dashboard
npm run dev      # chạy với watch
npm test         # 59 test: markdown renderer, template/DB, Components V2, đăng ký & chống gửi trùng, migration, asset dashboard, chặn API khi chưa auth, cảnh báo cấu hình, trang lỗi đăng nhập, chống lệch giữa docs và code
npm run typecheck
```

## Kiến trúc

Một process Node: discord.js client + Express API + dashboard tĩnh.

```
src/config    đọc & validate env, cảnh báo cấu hình dễ sai
src/db        node:sqlite (không cần native build), schema + repositories
src/shared    template → payload Discord (embed + Components V2), placeholder, validate giới hạn
src/bot       client, events, quy nguồn invite, DM sender, publisher, đợt thông báo
src/web       express, session cookie ký HMAC, routes, trang lỗi đăng nhập
public        dashboard vanilla ESM + CSS (không build step)
docs          hướng dẫn cài đặt dạng HTML, mở trực tiếp bằng trình duyệt
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
- Mạng chập chờn làm gateway timeout thì bot log lại và chờ discord.js kết nối
  lại, không chết cả process. Lỗi không phải lỗi mạng vẫn thoát để bạn thấy ngay.
