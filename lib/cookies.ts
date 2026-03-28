import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

const isProduction = process.env.NODE_ENV === "production";

function base(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  };
}

export function authCookieOptions(): Partial<ResponseCookie> {
  return { ...base(), maxAge: 3600 };
}

export function refreshCookieOptions(): Partial<ResponseCookie> {
  return { ...base(), maxAge: 2592000 };
}

export function tempCookieOptions(): Partial<ResponseCookie> {
  return { ...base(), maxAge: 300 };
}

export function deleteCookieOptions(): Partial<ResponseCookie> {
  return { ...base(), maxAge: 0 };
}
