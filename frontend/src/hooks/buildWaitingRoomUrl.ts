import type { AgentType, DemoType } from './useRuntimeExperienceConfiguration';

export type BuildWaitingRoomUrlArgs = {
  origin: string;
  sessionKey: string | null;
  demoType: DemoType;
  agentType: AgentType;
  username?: string;
};

const buildWaitingRoomUrl = ({
  origin,
  sessionKey,
  demoType,
  agentType,
  username,
}: BuildWaitingRoomUrlArgs): string => {
  const waitingRoomPath = sessionKey ? `/waiting-room/${sessionKey}` : '/waiting-room';
  const searchParams = new URLSearchParams();

  if (demoType !== 'default') {
    searchParams.set('demo', demoType);
  }

  if (agentType !== 'banker') {
    searchParams.set('agent', agentType);
  }

  if (username && username.trim() !== '') {
    searchParams.set('username', username.trim());
  }

  const queryString = searchParams.toString();

  if (queryString === '') {
    return `${origin}${waitingRoomPath}`;
  }

  return `${origin}${waitingRoomPath}?${queryString}`;
};

export default buildWaitingRoomUrl;
