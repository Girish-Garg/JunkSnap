import type { ReportGuard, SignedInUser } from "./ReportEndpoints.js";

// Stand-in until the auth task's RouteGuard lands: everyone is a guest, so reports carry no user_id.
export class GuestGuard implements ReportGuard {
  async requireUser(): Promise<SignedInUser | undefined> {
    return undefined;
  }

  async optionalUser(): Promise<SignedInUser | undefined> {
    return undefined;
  }
}
