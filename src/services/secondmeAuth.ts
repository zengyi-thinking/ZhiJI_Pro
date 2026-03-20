import crypto from "node:crypto";

interface SecondMeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface SecondMeUserProfile {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  bio?: string;
}

interface SessionData {
  userId: string;
  username: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  createdAt: number;
  expiresAt: number;
}

export class SecondMeAuthService {
  private sessions = new Map<string, SessionData>();
  private pendingStates = new Map<string, { redirectUri: string; codeVerifier: string }>();

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    private readonly baseUrl: string = "https://second.me"
  ) {}

  /**
   * 生成 OAuth 登录 URL
   */
  generateLoginUrl(redirectUri?: string): { url: string; state: string } {
    const state = crypto.randomBytes(16).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    this.pendingStates.set(state, {
      redirectUri: redirectUri || this.redirectUri,
      codeVerifier
    });

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri || this.redirectUri,
      response_type: "code",
      scope: "profile email",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    return {
      url: `${this.baseUrl}/oauth/authorize?${params.toString()}`,
      state
    };
  }

  /**
   * 处理 OAuth 回调，获取用户信息
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{ sessionToken: string; user: SecondMeUserProfile }> {
    // 验证 state
    const pendingState = this.pendingStates.get(state);
    if (!pendingState) {
      throw new Error("Invalid or expired state");
    }

    const { redirectUri, codeVerifier } = pendingState;
    this.pendingStates.delete(state);

    // 交换 code 获取 access token
    const tokenResponse = await this.exchangeCodeForToken(code, redirectUri, codeVerifier);

    // 获取用户信息
    const userProfile = await this.getUserProfile(tokenResponse.access_token);

    // 创建会话
    const sessionToken = this.createSession(userProfile);

    return { sessionToken, user: userProfile };
  }

  /**
   * 交换授权码获取访问令牌
   */
  private async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<SecondMeTokenResponse> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  /**
   * 使用访问令牌获取用户信息
   */
  private async getUserProfile(accessToken: string): Promise<SecondMeUserProfile> {
    const response = await fetch(`${this.baseUrl}/api/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch user profile: ${error}`);
    }

    return response.json();
  }

  /**
   * 创建用户会话
   */
  private createSession(user: SecondMeUserProfile): string {
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 天

    const sessionData: SessionData = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      createdAt: now,
      expiresAt
    };

    this.sessions.set(sessionToken, sessionData);
    return sessionToken;
  }

  /**
   * 验证会话并获取用户信息
   */
  validateSession(sessionToken: string): SessionData | null {
    const session = this.sessions.get(sessionToken);
    if (!session) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      return null;
    }

    return session;
  }

  /**
   * 注销会话
   */
  logout(sessionToken: string): boolean {
    return this.sessions.delete(sessionToken);
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }
}
