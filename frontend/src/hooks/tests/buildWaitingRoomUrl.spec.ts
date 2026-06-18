import { describe, expect, it } from 'vitest';
import buildWaitingRoomUrl from '../buildWaitingRoomUrl';

describe('buildWaitingRoomUrl', () => {
  it('returns waiting-room URL without query params for default demo and banker agent', () => {
    const result = buildWaitingRoomUrl({
      origin: 'https://example.com',
      sessionKey: 'session-key',
      demoType: 'default',
      agentType: 'banker',
    });

    expect(result).toBe('https://example.com/waiting-room/session-key');
  });

  it('returns waiting-room URL with demo and agent query params when customized', () => {
    const result = buildWaitingRoomUrl({
      origin: 'https://example.com',
      sessionKey: 'session-key',
      demoType: 'healthcare',
      agentType: 'healthcare-intake',
      username: 'Taylor',
    });

    expect(result).toBe(
      'https://example.com/waiting-room/session-key?demo=healthcare&agent=healthcare-intake&username=Taylor'
    );
  });
});
