// One Digital Asset Links statement: the app signed with these certificates may open this host's https links
// (developer.android.com/training/app-links/verify-android-applinks).
export interface AssetLinkStatement {
  readonly relation: readonly string[];
  readonly target: {
    readonly namespace: "android_app";
    readonly package_name: string;
    readonly sha256_cert_fingerprints: readonly string[];
  };
}

const HANDLE_ALL_URLS = "delegate_permission/common.handle_all_urls";

// The body of /.well-known/assetlinks.json for one Android package; empty when no certificate is configured.
export class AssetLinks {
  readonly #packageName: string;
  readonly #fingerprints: readonly string[];

  constructor(packageName: string, fingerprints: readonly string[]) {
    this.#packageName = packageName;
    this.#fingerprints = fingerprints;
  }

  configured(): boolean {
    return this.#fingerprints.length > 0;
  }

  statements(): readonly AssetLinkStatement[] {
    if (!this.configured()) return [];
    const target = { namespace: "android_app", package_name: this.#packageName, sha256_cert_fingerprints: this.#fingerprints } as const;
    return [{ relation: [HANDLE_ALL_URLS], target }];
  }
}
