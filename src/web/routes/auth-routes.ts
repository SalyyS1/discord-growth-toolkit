import { Router, type Response } from 'express';
import { env, isOwner, oauthRedirectUri } from '../../config/env';
import { renderAuthErrorPage, type AuthErrorPageInput } from '../auth-error-page';
import {
  clearSessionCookie,
  consumeOauthState,
  issueOauthState,
  readSession,
  setSessionCookie,
} from '../session';

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauthRedirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`Đổi code thất bại (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Không lấy được thông tin user (${response.status})`);
  return (await response.json()) as DiscordUser;
}

export const authRoutes = Router();

function sendAuthError(response: Response, page: AuthErrorPageInput): void {
  response.status(page.status).type('html').send(renderAuthErrorPage(page));
}

authRoutes.get('/login', (request, response) => {
  const state = issueOauthState(response);
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', oauthRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'none');
  response.redirect(url.toString());
});

authRoutes.get('/callback', async (request, response) => {
  const code = typeof request.query.code === 'string' ? request.query.code : '';
  const state = typeof request.query.state === 'string' ? request.query.state : '';

  if (!consumeOauthState(request, response, state)) {
    sendAuthError(response, {
      status: 400,
      title: 'Link đăng nhập không còn hợp lệ',
      message:
        'Mã chống giả mạo (state) trong cookie không khớp với mã Discord trả về. Thường là vì link đăng nhập đã mở quá 10 phút, hoặc bạn bắt đầu đăng nhập ở một tab/trình duyệt khác.',
      steps: [
        'Bấm "Thử đăng nhập lại" bên dưới và hoàn tất trong cùng một tab.',
        'Nếu vẫn lỗi: kiểm tra trình duyệt có đang chặn cookie của localhost không.',
        'Truy cập dashboard đúng địa chỉ khai trong PUBLIC_BASE_URL — vào bằng 127.0.0.1 trong khi khai localhost sẽ làm mất cookie.',
      ],
      retryHref: '/api/auth/login',
    });
    return;
  }
  if (!code) {
    sendAuthError(response, {
      status: 400,
      title: 'Discord không trả về mã đăng nhập',
      message: 'Thiếu tham số code, thường là do bạn bấm "Cancel" ở trang cấp quyền của Discord.',
      retryHref: '/api/auth/login',
    });
    return;
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const user = await fetchDiscordUser(accessToken);

    if (!isOwner(user.id)) {
      sendAuthError(response, {
        status: 403,
        title: 'Tài khoản chưa được cấp quyền',
        message: `Bạn đăng nhập bằng ${user.username} (ID ${user.id}), nhưng ID này không có trong DASHBOARD_OWNER_IDS nên không vào được dashboard.`,
        steps: [
          'Mở file .env ở thư mục dự án.',
          'Thêm ID trên vào DASHBOARD_OWNER_IDS (nhiều người thì cách nhau bằng dấu phẩy, không có dấu cách).',
          'Khởi động lại bằng npm start — biến môi trường chỉ được đọc lúc chạy.',
          'Đăng nhập lại.',
        ],
        snippet: `DASHBOARD_OWNER_IDS=${user.id}`,
        retryHref: '/api/auth/login',
      });
      return;
    }

    setSessionCookie(response, {
      userId: user.id,
      username: user.global_name || user.username,
      avatar: user.avatar,
    });
    response.redirect('/');
  } catch (error) {
    console.error('[web] OAuth lỗi:', error);
    const detail = error instanceof Error ? error.message : String(error);

    // Lỗi hay gặp nhất khi mới cài: redirect URI khai ở Portal khác PUBLIC_BASE_URL.
    if (/redirect_uri/i.test(detail)) {
      sendAuthError(response, {
        status: 500,
        title: 'Redirect URI không khớp',
        message:
          'Discord từ chối đổi mã đăng nhập vì địa chỉ callback mà app gửi lên chưa được khai ở Developer Portal.',
        steps: [
          'Mở Developer Portal → app của bạn → OAuth2 → Redirects.',
          'Thêm đúng chuỗi bên dưới, giống từng ký tự và không thừa dấu / ở cuối, rồi bấm Save Changes.',
          'Muốn dùng địa chỉ khác thì sửa PUBLIC_BASE_URL trong .env cho khớp rồi khởi động lại.',
        ],
        snippet: oauthRedirectUri,
        retryHref: '/api/auth/login',
      });
      return;
    }

    sendAuthError(response, {
      status: 500,
      title: 'Đăng nhập thất bại',
      message:
        'Không đổi được mã đăng nhập với Discord. Chi tiết lỗi đã ghi vào log của cửa sổ đang chạy npm start.',
      steps: [
        'Kiểm tra DISCORD_CLIENT_ID và DISCORD_CLIENT_SECRET trong .env — secret bị reset ở Developer Portal thì phải điền lại.',
        'Kiểm tra máy có kết nối được tới discord.com.',
      ],
      retryHref: '/api/auth/login',
    });
  }
});

authRoutes.post('/logout', (_request, response) => {
  clearSessionCookie(response);
  response.json({ ok: true });
});

authRoutes.get('/me', (request, response) => {
  const session = readSession(request);
  if (!session || !isOwner(session.userId)) {
    response.status(401).json({ authenticated: false });
    return;
  }
  response.json({
    authenticated: true,
    user: { id: session.userId, username: session.username, avatar: session.avatar },
  });
});
