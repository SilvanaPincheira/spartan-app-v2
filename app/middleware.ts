import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  // Si NO hay usuario y no está en /login → redirigir al login
  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Si SÍ hay usuario y trata de entrar a /login → redirigir al dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}
