import type { AwsTimeouts } from "../settings/TimeoutSettings.js";

export interface AwsClientConfig {
  readonly region: string;
  readonly requestHandler: AwsTimeouts & { readonly throwOnRequestTimeout: true };
}

// Every AWS SDK client: smithy sets no timeout by default, and requestTimeout without throwOnRequestTimeout only warns.
// Pass a profile from TimeoutSettings.aws.
export function awsClientConfig(region: string, timeouts: AwsTimeouts): AwsClientConfig {
  return { region, requestHandler: { ...timeouts, throwOnRequestTimeout: true } };
}
