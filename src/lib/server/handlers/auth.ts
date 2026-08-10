import "server-only";
import jwt from "jsonwebtoken";
import { getRepo } from "../repository";
import { makePassword, checkPassword } from "../password";
import { generateAccessToken, generateRefreshToken } from "../jwt";
import { env } from "../env";
import { json, readJson, errorResponse } from "../http";
import { sixCharCode, uuidHex, isoNowPlusMinutes, isoNowPlusDays } from "../ids";
import { runInBackground, sendVerificationEmail, sendPasswordResetEmail } from "../email";

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export async function handleSignup(request: Request) {
  try {
    const body = await readJson(request);
    const email = str(body.email).trim().toLowerCase();
    const password = str(body.password);
    const fullName = str(body.full_name).trim();
    if (!email || !password || !fullName) {
      return json({ error: "email, password, and full_name are required." }, 400);
    }
    if (password.length < 8) {
      return json({ error: "Password must be at least 8 characters." }, 400);
    }
    const repo = getRepo();
    const existing = await repo.findAdminByEmail(email);
    if (existing) {
      return json(
        { error: "An account with this email already exists. Please log in or use a different email." },
        409
      );
    }

    const verificationCode = sixCharCode();
    const expiresAt = isoNowPlusMinutes(30);
    const admin = await repo.createAdmin({
      email,
      password_hash: makePassword(password),
      full_name: fullName,
      company_id: null,
      role: "admin",
      is_verified: false,
      verification_code: verificationCode,
      verification_expires_at: expiresAt,
    });
    runInBackground(() => sendVerificationEmail(email, verificationCode));
    return json(
      {
        message: "Signup successful.",
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
          company_id: admin.company_id,
          is_verified: admin.is_verified,
        },
      },
      201
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleLogin(request: Request) {
  try {
    const body = await readJson(request);
    const email = str(body.email).trim().toLowerCase();
    const password = str(body.password);
    if (!email || !password) return json({ error: "email and password are required." }, 400);
    const repo = getRepo();
    const admin = await repo.findAdminByEmail(email);
    if (!admin || !checkPassword(password, admin.password_hash)) {
      return json({ error: "Invalid email or password." }, 401);
    }
    if (!admin.is_verified) return json({ error: "Email not verified." }, 403);

    const accessToken = generateAccessToken(admin);
    const refreshJti = uuidHex();
    const refreshToken = generateRefreshToken(admin, refreshJti);
    await repo.storeRefreshToken({
      jti: refreshJti,
      adminId: admin.id,
      expiresAt: isoNowPlusDays(env.JWT_REFRESH_TOKEN_LIFETIME_DAYS),
    });
    return json({
      message: "Login successful.",
      access_token: accessToken,
      refresh_token: refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        company_id: admin.company_id,
        role: admin.role,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleVerifyEmail(request: Request) {
  try {
    const body = await readJson(request);
    const email = str(body.email).trim().toLowerCase();
    const code = str(body.code).trim().toUpperCase();
    if (!email || !code) return json({ error: "email and code are required." }, 400);
    const repo = getRepo();
    const admin = await repo.findAdminByEmail(email);
    if (!admin) return json({ error: "Admin not found." }, 404);
    if (admin.is_verified) return json({ message: "Email already verified." }, 200);
    if (!admin.verification_code || admin.verification_code.toUpperCase() !== code) {
      return json({ error: "Invalid verification code." }, 400);
    }
    if (admin.verification_expires_at) {
      const expires = Date.parse(admin.verification_expires_at);
      if (Number.isFinite(expires) && expires <= Date.now()) {
        return json({ error: "Verification code expired." }, 400);
      }
    }
    await repo.updateAdmin(admin.id, {
      is_verified: true,
      verification_code: null,
      verification_expires_at: null,
    });
    return json({ message: "Email verified successfully." }, 200);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleResendVerification(request: Request) {
  try {
    const body = await readJson(request);
    const email = str(body.email).trim().toLowerCase();
    if (!email) return json({ error: "email is required." }, 400);
    const repo = getRepo();
    const admin = await repo.findAdminByEmail(email);
    if (!admin) return json({ error: "Admin not found." }, 404);
    if (admin.is_verified) return json({ message: "Email is already verified." }, 200);
    const verificationCode = sixCharCode();
    await repo.updateAdmin(admin.id, {
      verification_code: verificationCode,
      verification_expires_at: isoNowPlusMinutes(30),
    });
    runInBackground(() => sendVerificationEmail(email, verificationCode));
    return json({ message: "Verification code sent successfully." }, 200);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleForgotPassword(request: Request) {
  try {
    const body = await readJson(request);
    const email = str(body.email).trim().toLowerCase();
    if (!email) return json({ error: "email is required." }, 400);
    const repo = getRepo();
    const admin = await repo.findAdminByEmail(email);
    if (admin) {
      const resetCode = sixCharCode();
      await repo.updateAdmin(admin.id, {
        password_reset_code: resetCode,
        password_reset_expires_at: isoNowPlusMinutes(30),
      });
      runInBackground(() => sendPasswordResetEmail(email, resetCode));
    }
    return json({ message: "If this email is registered, a password reset code has been sent." }, 200);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleResetPassword(request: Request) {
  try {
    const body = await readJson(request);
    const email = str(body.email).trim().toLowerCase();
    const code = str(body.code).trim().toUpperCase();
    const newPassword = str(body.new_password);
    if (!email || !code || !newPassword) {
      return json({ error: "email, code, and new_password are required." }, 400);
    }
    if (newPassword.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    const repo = getRepo();
    const admin = await repo.findAdminByEmail(email);
    if (!admin) return json({ error: "Admin not found." }, 404);
    if (!admin.password_reset_code || admin.password_reset_code.toUpperCase() !== code) {
      return json({ error: "Invalid reset code." }, 400);
    }
    if (admin.password_reset_expires_at) {
      const expires = Date.parse(admin.password_reset_expires_at);
      if (Number.isFinite(expires) && expires <= Date.now()) {
        return json({ error: "Reset code expired." }, 400);
      }
    }
    await repo.updateAdmin(admin.id, {
      password_hash: makePassword(newPassword),
      password_reset_code: null,
      password_reset_expires_at: null,
    });
    return json({ message: "Password reset successful." }, 200);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleRefreshToken(request: Request) {
  try {
    const body = await readJson(request);
    const token = str(body.refresh_token).trim();
    if (!token) return json({ error: "refresh_token is required." }, 400);
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET_KEY, {
        algorithms: [env.JWT_ALGORITHM as jwt.Algorithm],
      }) as jwt.JwtPayload;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) return json({ error: "Refresh token expired." }, 401);
      return json({ error: "Invalid refresh token." }, 401);
    }
    if (payload.type !== "refresh") return json({ error: "Invalid token type." }, 401);
    const jti = str(payload.jti);
    const repo = getRepo();
    const stored = await repo.getRefreshToken(jti);
    if (!stored) return json({ error: "Refresh token revoked." }, 401);
    const adminId = parseInt(str(payload.sub), 10);
    const admin = await repo.getAdmin(adminId);
    if (!admin || !admin.is_verified) return json({ error: "Admin not found or not verified." }, 401);
    return json({ access_token: generateAccessToken(admin) }, 200);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleLogout(request: Request) {
  try {
    const body = await readJson(request);
    const token = str(body.refresh_token).trim();
    if (!token) return json({ error: "refresh_token is required." }, 400);
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET_KEY, {
        algorithms: [env.JWT_ALGORITHM as jwt.Algorithm],
      }) as jwt.JwtPayload;
    } catch {
      return json({ message: "Logged out." }, 200);
    }
    const jti = str(payload.jti);
    if (jti) await getRepo().revokeRefreshToken(jti);
    return json({ message: "Logged out." }, 200);
  } catch (e) {
    return errorResponse(e);
  }
}
