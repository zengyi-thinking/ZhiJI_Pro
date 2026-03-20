import crypto from "node:crypto";

interface SecondMeTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope?: string[];
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

interface SecondMeEnvelope<T> {
  code: number;
  data: T;
  message?: string;
}

interface SecondMeAuthOptions {
  oauthUrl: string;
  tokenEndpoint: string;
  refreshEndpoint: string;
  userInfoEndpoint: string;
}

export class SecondMeAuthService {
  private sessions = new Map<string, SessionData>();

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    private readonly options: SecondMeAuthOptions
  ) {}

  /**
   * 生成 OAuth 登录 URL
   */
  generateLoginUrl(redirectUri?: string): {
    url: string;
    state: string;
    codeVerifier: string;
    redirectUri: string;
  } {
    const state = crypto.randomBytes(16).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const resolvedRedirectUri = redirectUri || this.redirectUri;
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: resolvedRedirectUri,
      response_type: "code",
      scope: "user.info",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    return {
      url: `${this.options.oauthUrl}?${params.toString()}`,
      state,
      codeVerifier,
      redirectUri: resolvedRedirectUri
    };
  }

  /**
   * 处理 OAuth 回调，获取用户信息
   */
  async handleCallback(
    code: string,
    state: string,
    expectedState: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<{ sessionToken: string; user: SecondMeUserProfile }> {
    if (!state || !expectedState || state !== expectedState || !redirectUri || !codeVerifier) {
      throw new Error("Invalid or expired state");
    }

    // 交换 code 获取 access token
    const tokenResponse = await this.exchangeCodeForToken(code, redirectUri, codeVerifier);

    // 获取用户信息
    const userProfile = await this.getUserProfile(tokenResponse.accessToken);

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
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    const response = await fetch(this.options.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const result = (await response.json()) as SecondMeEnvelope<SecondMeTokenResponse>;
    if (result.code !== 0 || !result.data?.accessToken) {
      throw new Error(`Token exchange failed: ${result.message || "invalid response payload"}`);
    }

    return result.data;
  }

  /**
   * 使用访问令牌获取用户信息
   */
  private async getUserProfile(accessToken: string): Promise<SecondMeUserProfile> {
    const response = await fetch(this.options.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch user profile: ${error}`);
    }

    const result = (await response.json()) as SecondMeEnvelope<Record<string, unknown>>;
    if (result.code !== 0 || !result.data) {
      throw new Error(`Failed to fetch user profile: ${result.message || "invalid response payload"}`);
    }

    const profile = result.data;
    const username =
      this.stringValue(profile.username) ||
      this.stringValue(profile.name) ||
      this.stringValue(profile.nickname) ||
      this.stringValue(profile.email) ||
      "secondme-user";
    const id =
      this.stringValue(profile.id) ||
      this.stringValue(profile.userId) ||
      this.stringValue(profile.uid) ||
      crypto.createHash("sha256").update(username).digest("hex").slice(0, 24);

    return {
      id,
      username,
      displayName: this.stringValue(profile.displayName) || this.stringValue(profile.nickname) || this.stringValue(profile.name),
      email: this.stringValue(profile.email),
      avatar: this.stringValue(profile.avatar) || this.stringValue(profile.avatarUrl),
      bio: this.stringValue(profile.bio)
    };
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

  private stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
