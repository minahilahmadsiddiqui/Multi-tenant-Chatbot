import { handleLogout } from "@/lib/server/handlers/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleLogout;
