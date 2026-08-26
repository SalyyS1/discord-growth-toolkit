import { Router } from 'express';
import { env, isOwner, oauthRedirectUri } from '../../config/env';
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
    response.status(400).send('State không khớp, thử đăng nhập lại.');
    return;
  }
  if (!code) {
    response.status(400).send('Thiếu code.');
    return;
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const user = await fetchDiscordUser(accessToken);

    if (!isOwner(user.id)) {
      response
        .status(403)
        .send(`Tài khoản ${user.username} (${user.id}) không có trong DASHBOARD_OWNER_IDS.`);
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
    response.status(500).send('Đăng nhập thất bại, xem log server.');
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
