import { describe, expect, it } from "vitest";
import { ScanAdapterFactory } from "../src/handlers/ScanAdapterFactory.js";
import { AWS_TIMEOUTS, awsClientConfig } from "../src/handlers/utils.js";

describe("awsClientConfig", () => {
  it("gives every SDK client a 3 s connect timeout, a request timeout that throws and an idle timeout", () => {
    expect(awsClientConfig("ap-south-1")).toEqual({
      region: "ap-south-1",
      requestHandler: { connectionTimeout: 3_000, requestTimeout: 10_000, socketTimeout: 5_000, throwOnRequestTimeout: true },
    });
  });

  it("keeps idle timeouts under 6 s, the most smithy 4.12 arms for the body read after the headers", () => {
    const idle = Object.values(AWS_TIMEOUTS).flatMap((timeouts) => ("socketTimeout" in timeouts ? [timeouts.socketTimeout] : []));
    expect(idle.every((ms) => ms < 6_000)).toBe(true);
    expect(awsClientConfig("ap-south-1", AWS_TIMEOUTS.transfer).requestHandler.socketTimeout).toBe(5_000);
  });

  it("waits longer than SQS's 20 s long poll, with no idle timeout, for clients that stay silent before answering", () => {
    const { requestHandler } = awsClientConfig("ap-south-1", AWS_TIMEOUTS.wait);
    expect(requestHandler.requestTimeout).toBeGreaterThan(20_000);
    expect(requestHandler.socketTimeout).toBeUndefined();
  });
});

describe("ScanAdapterFactory S3 clients", () => {
  it("gives the scan media client no idle timeout, since the video is piped to disk, and keeps 5 s for signing", () => {
    const { media, signing } = ScanAdapterFactory.s3Configs("ap-south-1");
    expect(media).toEqual({
      region: "ap-south-1",
      requestHandler: { connectionTimeout: 3_000, requestTimeout: 30_000, throwOnRequestTimeout: true },
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
    expect(signing.requestHandler).toMatchObject({ requestTimeout: 30_000, socketTimeout: 5_000 });
    expect(signing.requestChecksumCalculation).toBe("WHEN_REQUIRED");
  });
});
