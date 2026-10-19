import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto assets do Next e o favicon.
    "/((?!_next/static|_next/image|favicon\\.ico$).*)",
  ],
};
