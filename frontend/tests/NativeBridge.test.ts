import { describe, expect, it, vi } from 'vitest';
import { NativeBridge, type NativeHost } from '../src/services/NativeBridge';

function appHost(invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>) {
  const host = { __TAURI__: { core: { invoke: vi.fn(invoke) } }, JunkSnapAndroid: { print: vi.fn(), openAppSettings: vi.fn() }, print: vi.fn() };
  return { host, bridge: new NativeBridge(host) };
}

describe('NativeBridge', () => {
  it('uses the browser print and no share sheet outside the app', async () => {
    const host: NativeHost = { print: vi.fn() };
    const bridge = new NativeBridge(host);
    bridge.print();
    expect(host.print).toHaveBeenCalledOnce();
    expect(bridge.canShareText()).toBe(false);
    expect(bridge.canOpenAppSettings()).toBe(false);
    await expect(bridge.shareText('letter')).rejects.toThrow();
  });

  it('prints through the app bridge inside the app', () => {
    const { host, bridge } = appHost(() => Promise.resolve());
    bridge.print();
    expect(host.JunkSnapAndroid.print).toHaveBeenCalledOnce();
    expect(host.print).not.toHaveBeenCalled();
  });

  it('shares the text through the sharekit plugin', async () => {
    const { host, bridge } = appHost(() => Promise.resolve());
    await bridge.shareText('letter');
    expect(host.__TAURI__.core.invoke).toHaveBeenCalledWith('plugin:sharekit|share_text', { text: 'letter' });
  });

  it('treats a closed share sheet as done and other errors as failures', async () => {
    await expect(appHost(() => Promise.reject(new Error('Share cancelled'))).bridge.shareText('x')).resolves.toBeUndefined();
    await expect(appHost(() => Promise.reject(new Error('no activity'))).bridge.shareText('x')).rejects.toThrow('no activity');
  });
});

describe('NativeBridge app settings', () => {
  it('opens the app settings inside the app', () => {
    const { host, bridge } = appHost(() => Promise.resolve());
    expect(bridge.canOpenAppSettings()).toBe(true);
    bridge.openAppSettings();
    expect(host.JunkSnapAndroid.openAppSettings).toHaveBeenCalledOnce();
  });
});
