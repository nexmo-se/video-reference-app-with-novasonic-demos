import useSessionContext from './useSessionContext';
import useRuntimeExperienceConfiguration from './useRuntimeExperienceConfiguration';
import buildWaitingRoomUrl from './buildWaitingRoomUrl';

/**
 * Creates a shareable link to the waiting room for the current meeting room.
 * @returns {string} - The shareable link.
 */
const useRoomShareUrl = (): string => {
  const { sessionKey } = useSessionContext();
  const { demoType } = useRuntimeExperienceConfiguration();
  const { origin } = window.location;

  return buildWaitingRoomUrl({
    origin,
    sessionKey,
    demoType,
  });
};

export default useRoomShareUrl;
