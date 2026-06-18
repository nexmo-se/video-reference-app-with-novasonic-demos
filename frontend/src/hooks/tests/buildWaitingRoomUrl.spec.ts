import { describe, expect, it } from 'vitest';
import buildWaitingRoomUrl from '../buildWaitingRoomUrl';

describe('buildWaitingRoomUrl', () => {
  it('returns waiting-room URL without query params for default demo', () => {
    const result = buildWaitingRoomUrl({
      origin: 'https://example.com',
      sessionKey: 'session-key',
      demoType: 'default',
    });

    expect(result).toBe('https://example.com/waiting-room/session-key');
  });

  it('returns waiting-room URL with banking demo query param', () => {
    const result = buildWaitingRoomUrl({
      origin: 'https://example.com',
      sessionKey: 'session-key',
      demoType: 'banking',
    });

    expect(result).toBe('https://example.com/waiting-room/session-key?demo=banking');
  });

  it('returns waiting-room URL with healthcare demo and username query params', () => {
    const result = buildWaitingRoomUrl({
      origin: 'https://example.com',
      sessionKey: 'session-key',
      demoType: 'healthcare',
      username: 'Taylor',
    });

    expect(result).toBe(
      'https://example.com/waiting-room/session-key?demo=healthcare&username=Taylor'
    );
  });
});
