import { NextResponse } from "next/server";
import { deleteCookieOptions } from "@/lib/cookies";

export async function POST() {
  const res = NextResponse.json({ success: true });

  res.cookies.set("access_token", "", deleteCookieOptions());
  res.cookies.set("id_token", "", deleteCookieOptions());
  res.cookies.set("refresh_token", "", deleteCookieOptions());

  return res;
}
