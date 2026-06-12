import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { initSession } from '@vonage/client-sdk-video';
import type { Publisher, Session, Subscriber } from '@vonage/client-sdk-video';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@ui/PageLayout';
import Banner from '@components/Banner';
import Footer from '@components/Footer/Footer';
import ControlPanel from '@components/WaitingRoom/ControlPanel';
import VideoContainer from '@components/WaitingRoom/VideoContainer';
import UsernameInput from '@components/WaitingRoom/UserNameInput/UserNameInput';
import DeviceAccessAlert from '@components/DeviceAccessAlert';
import { DEVICE_ACCESS_STATUS } from '@utils/constants';
import backgroundEffectsDialog$ from '@Context/BackgroundEffectsDialog';
import precallNetworkTestDialog$ from '@Context/PrecallNetworkTestDialog';
import VideoContainerSkeleton from '@components/WaitingRoom/VideoContainer/VideoContainer.skeleton';
import UsernameInputSkeleton from '@components/WaitingRoom/UserNameInput/UserNameInput.skeleton';
import useWaitingRoom from '@hooks/useWaitingRoom';
import useUserContext from '@hooks/useUserContext';
import { UserType } from '@Context/user';
import { isValidRoomName } from '@common/assertions';
import { setStorageItem, STORAGE_KEYS } from '@utils/storage';

type PrecallSessionResponse = {
  sessionId?: string;
  token?: string;
  jwt?: string;
  apiKey?: string;
};

type PrecallMessage = {
  sender: string;
  text: string;
  timestamp: string;
};

type SignalPayload = {
  role?: string;
  content?: string;
  type?: string;
  data?: unknown;
  message?: unknown;
  payload?: unknown;
  body?: unknown;
  text?: unknown;
  transcript?: unknown;
  utterance?: unknown;
  sender?: unknown;
  speaker?: unknown;
};

type SessionSignalEvent = {
  type?: string;
  data?: unknown;
};

const endOfConversationPhrases = [
  'thanks for taking the time to demo the trusted bank ai assistant.',
  'you can now join the meeting',
  'please join the video conference',
  'ready to join the meeting',
  'proceed to the video conference',
];

const userTestMessagePhrases = [
  'hello there',
  'hi there',
  'test',
  'hello',
  'testing',
  'can you hear me',
  'sprich mit mir auf deutsch',
  'parlami in italiano',
  'háblame en español',
];

/**
 * WaitingRoom Component
 *
 * This component renders the waiting room page of the application, including:
 * - A banner containing a company logo, a date-time widget, and a navigable button to a GitHub repo.
 * - A video element showing the user how they'll appear upon joining a room containing controls to:
 *   - Mute their audio input device.
 *   - Disable their video input device.
 *   - Button to configure background replacement (if supported).
 * - Audio input, audio output, and video input device selectors.
 * - A username input field.
 * - A button to run a pre-call network test.
 * - The meeting room name and a button to join the room.
 * @returns {ReactElement} - The waiting room.
 */
const WaitingRoom: FC = () => {
  const [hasPrecallStarted, setHasPrecallStarted] = useState(false);
  const [isPrecallLoading, setIsPrecallLoading] = useState(false);
  const [messages, setMessages] = useState<PrecallMessage[]>([]);
  const precallSession = useRef<PrecallSessionResponse | null>(null);
  const activePrecallVonageSession = useRef<Session | null>(null);
  const activeSignalHandlers = useRef<{
    handleChatSignal: (event: SessionSignalEvent) => void;
    handleJoinSignal: (event: SessionSignalEvent) => void;
    handleAnySignal: (event: SessionSignalEvent) => void;
    handleStreamCreated: (event: { stream?: unknown }) => void;
  } | null>(null);

  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { setUser } = useUserContext();
  const latestUsernameRef = useRef('');
  const hasPrecallStartedRef = useRef(false);
  const activeAiSubscriberRef = useRef<Subscriber | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    anchorEl,
    openAudioInput,
    openVideoInput,
    openAudioOutput,
    publisher,
    username,
    setUsername,
    accessStatus,
    isRoomReady,
    roomName,
    handleAudioInputOpen,
    handleVideoInputOpen,
    handleAudioOutputOpen,
    handleClose,
  } = useWaitingRoom();

  useEffect(() => {
    latestUsernameRef.current = username;
  }, [username]);

  useEffect(() => {
    hasPrecallStartedRef.current = hasPrecallStarted;
  }, [hasPrecallStarted]);

  const getPrecallApiUrl = (route: string): string => {
    const precallApiBaseUrl = (import.meta.env as Record<string, string | undefined>)[
      'VITE_PREAPPOINTMENT_API_URL'
    ];

    if (precallApiBaseUrl && precallApiBaseUrl.trim() !== '') {
      return `${precallApiBaseUrl.replace(/\/$/, '')}${route}`;
    }

    return route;
  };

  const getConnectorVoiceFromLanguage = (languageTag: string | undefined): string => {
    if (!languageTag) {
      return 'us';
    }

    if (languageTag === 'en-US') {
      return 'us';
    }

    if (languageTag === 'es-MX') {
      return 'es';
    }

    const [primaryLanguage] = languageTag.split('-');

    if (!primaryLanguage) {
      return 'us';
    }

    return primaryLanguage.toLowerCase();
  };

  const parseSignalPayload = (eventData: unknown): SignalPayload | null => {
    if (!eventData) {
      return null;
    }

    if (typeof eventData === 'object') {
      return eventData as SignalPayload;
    }

    if (typeof eventData !== 'string') {
      return null;
    }

    try {
      return JSON.parse(eventData) as SignalPayload;
    } catch {
      // Some connectors send raw text rather than JSON payloads.
      return { content: eventData };
    }
  };

  const extractMessageFromSignal = (signalPayload: SignalPayload | null) => {
    if (!signalPayload) {
      return null;
    }

    const parseUnknownObject = (unknownValue: unknown): Record<string, unknown> | null => {
      if (!unknownValue) {
        return null;
      }

      if (typeof unknownValue === 'object') {
        return unknownValue as Record<string, unknown>;
      }

      if (typeof unknownValue !== 'string') {
        return null;
      }

      try {
        const parsedValue = JSON.parse(unknownValue) as unknown;
        return typeof parsedValue === 'object' && parsedValue
          ? (parsedValue as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    };

    const nestedPayload =
      parseUnknownObject(signalPayload.payload) ??
      parseUnknownObject(signalPayload.body) ??
      parseUnknownObject(signalPayload.message) ??
      parseUnknownObject(signalPayload.data);

    const role = (() => {
      const roleFromPayload = signalPayload.role;
      const roleFromNested = nestedPayload?.role;
      const roleFromSender = signalPayload.sender;
      const roleFromSpeaker = signalPayload.speaker;

      if (typeof roleFromPayload === 'string') {
        return roleFromPayload.toUpperCase();
      }

      if (typeof roleFromNested === 'string') {
        return roleFromNested.toUpperCase();
      }

      if (typeof roleFromSender === 'string') {
        return roleFromSender.toUpperCase();
      }

      if (typeof roleFromSpeaker === 'string') {
        return roleFromSpeaker.toUpperCase();
      }

      return undefined;
    })();

    const content = (() => {
      const contentFromPayload = signalPayload.content;
      const contentFromNested = nestedPayload?.content;
      const textFromPayload = (signalPayload as Record<string, unknown>).text;
      const textFromNested = nestedPayload?.text;
      const messageFromPayload = (signalPayload as Record<string, unknown>).message;
      const messageFromNested = nestedPayload?.message;
      const transcriptFromPayload = signalPayload.transcript;
      const transcriptFromNested = nestedPayload?.transcript;
      const utteranceFromPayload = signalPayload.utterance;
      const utteranceFromNested = nestedPayload?.utterance;
      const stringDataFromPayload = signalPayload.data;

      if (typeof contentFromPayload === 'string') {
        return contentFromPayload;
      }

      if (typeof contentFromNested === 'string') {
        return contentFromNested;
      }

      if (typeof textFromPayload === 'string') {
        return textFromPayload;
      }

      if (typeof textFromNested === 'string') {
        return textFromNested;
      }

      if (typeof messageFromPayload === 'string') {
        return messageFromPayload;
      }

      if (typeof messageFromNested === 'string') {
        return messageFromNested;
      }

      if (typeof transcriptFromPayload === 'string') {
        return transcriptFromPayload;
      }

      if (typeof transcriptFromNested === 'string') {
        return transcriptFromNested;
      }

      if (typeof utteranceFromPayload === 'string') {
        return utteranceFromPayload;
      }

      if (typeof utteranceFromNested === 'string') {
        return utteranceFromNested;
      }

      if (typeof stringDataFromPayload === 'string') {
        return stringDataFromPayload;
      }

      return undefined;
    })();

    if (!content) {
      return null;
    }

    return { role, content };
  };

  const addIncomingMessage = (sender: string, text: string) => {
    const normalizedText = text.trim();

    if (!normalizedText) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((previousMessages) => [
      ...previousMessages,
      { sender, text: normalizedText, timestamp },
    ]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isEndOfConversationMessage = (content: string) => {
    const normalizedContent = content.trim().toLowerCase();

    return endOfConversationPhrases.some((phrase) => normalizedContent.includes(phrase));
  };

  const isTestUserMessage = (content: string) => {
    const normalizedContent = content.trim().toLowerCase();

    return userTestMessagePhrases.some(
      (phrase) => normalizedContent === phrase || normalizedContent.includes(phrase)
    );
  };

  const stopPrecallAssistant = async () => {
    const sessionId = precallSession.current?.sessionId;

    disconnectPrecallVonageSession();

    if (!sessionId) {
      setHasPrecallStarted(false);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const stopResponse = await fetch(getPrecallApiUrl('/vstop'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
      }),
    });

    if (!stopResponse.ok) {
      throw new Error('Pre-call stop failed');
    }

    precallSession.current = null;
    setHasPrecallStarted(false);
  };

  const handleAutomaticJoin = async () => {
    try {
      setIsPrecallLoading(true);

      if (hasPrecallStarted) {
        await stopPrecallAssistant();
      }

      const isReadyToJoinRoom = username && roomName && isValidRoomName(roomName);

      if (!isReadyToJoinRoom) {
        return;
      }

      setUser((previousUser: UserType) => ({
        ...previousUser,
        defaultSettings: {
          ...previousUser.defaultSettings,
          name: username,
        },
      }));

      setStorageItem(STORAGE_KEYS.USERNAME, username);

      navigate(`/room/${roomName}`, {
        state: {
          hasAccess: true,
        },
      });
    } catch (error) {
      console.error('Auto-join error:', error);
    } finally {
      setIsPrecallLoading(false);
    }
  };

  const isInterruptedSignal = (payload: SignalPayload | null): boolean => {
    if (!payload) return false;

    const checkForInterrupted = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      return (obj as Record<string, unknown>).interrupted === true;
    };

    const parseAndCheck = (value: unknown): boolean => {
      // If it's already an object, check it
      if (checkForInterrupted(value)) return true;

      // If it's a string, try to parse it and check
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (checkForInterrupted(parsed)) return true;
        } catch {
          // Not JSON, skip
        }
      }

      return false;
    };

    return parseAndCheck(payload.content);
  };

  const handleSignalMessage = (event: SessionSignalEvent) => {
    const signalPayload = parseSignalPayload(event.data);

    // Skip interrupted signals
    if (isInterruptedSignal(signalPayload)) {
      return;
    }

    const message = extractMessageFromSignal(signalPayload);

    if (!message?.content) {
      return;
    }

    const isEndOfConversation = isEndOfConversationMessage(message.content);

    if (message.role === 'ASSISTANT') {
      addIncomingMessage(t('waitingRoom.aiIntake.agentName'), message.content);

      if (isEndOfConversation && hasPrecallStartedRef.current) {
        setTimeout(() => {
          void handleAutomaticJoin();
        }, 1000);
      }
      return;
    }

    if (message.role === 'USER') {
      addIncomingMessage(latestUsernameRef.current || 'You', message.content);
      return;
    }

    // Fallback for payloads without role; assume AI assistant while pre-call session is active.
    if (hasPrecallStartedRef.current || !!activePrecallVonageSession.current) {
      addIncomingMessage(t('waitingRoom.aiIntake.agentName'), message.content);

      if (isEndOfConversation && hasPrecallStartedRef.current) {
        setTimeout(() => {
          void handleAutomaticJoin();
        }, 1000);
      }
    }
  };

  const detachSignalHandlers = (session: Session) => {
    const handlers = activeSignalHandlers.current;

    if (!handlers) {
      return;
    }

    session.off('signal:chat', handlers.handleChatSignal);
    session.off('signal:join', handlers.handleJoinSignal);
    session.off('signal', handlers.handleAnySignal);
    session.off('streamCreated', handlers.handleStreamCreated);
    activeSignalHandlers.current = null;
  };

  function disconnectPrecallVonageSession() {
    if (activePrecallVonageSession.current) {
      detachSignalHandlers(activePrecallVonageSession.current);
      activePrecallVonageSession.current.disconnect();
      activePrecallVonageSession.current = null;
    }

    if (activeAiSubscriberRef.current) {
      activeAiSubscriberRef.current = null;
    }
  }

  const attachSignalHandlers = (session: Session) => {
    const handleChatSignal = (event: SessionSignalEvent) => {
      try {
        const parsedData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (!parsedData || typeof parsedData !== 'object') {
          return;
        }

        const signalData = parsedData as {
          role?: string;
          content?: string;
          [key: string]: unknown;
        };

        // Skip interrupted signals early
        if (isInterruptedSignal(signalData as SignalPayload)) {
          return;
        }

        if (signalData.role === 'ASSISTANT') {
          if (!signalData.content) {
            return;
          }

          const content = signalData.content.trim();

          if (!content) {
            return;
          }

          const isEndOfConversation = isEndOfConversationMessage(content);

          if (isEndOfConversation && hasPrecallStartedRef.current) {
            setTimeout(() => {
              void handleAutomaticJoin();
            }, 1000);
          }

          addIncomingMessage(t('waitingRoom.aiIntake.agentName'), content);
          return;
        }

        if (signalData.role === 'USER') {
          if (!signalData.content) {
            return;
          }

          const content = signalData.content.trim();

          if (!content) {
            return;
          }

          const isTestMessage = isTestUserMessage(content);

          if (isTestMessage) {
            return;
          }

          addIncomingMessage(latestUsernameRef.current || 'You', content);
          return;
        }
      } catch (error) {
        console.error('[Signal API] Signal processing error:', error, 'Raw data:', event.data);
      }

      handleSignalMessage(event);
    };

    const handleJoinSignal = (event: SessionSignalEvent) => {
      const signalPayload = parseSignalPayload(event.data);
      const isJoinSignal = signalPayload?.type === 'join';

      if (!isJoinSignal) {
        return;
      }

      void handleAutomaticJoin();
    };

    const handleAnySignal = (event: SessionSignalEvent) => {
      if (event.type === 'signal:chat' || event.type === 'signal:join') {
        return;
      }

      const payload = parseSignalPayload(event.data);
      if (isInterruptedSignal(payload)) {
        return;
      }
      handleSignalMessage(event);
    };

    const handleStreamCreated = (event: { stream?: unknown }) => {
      const stream = event.stream as
        | {
            streamId?: string;
            connection?: { connectionId?: string };
          }
        | undefined;

      if (!stream) {
        return;
      }

      const currentConnectionId = session.connection?.connectionId;
      const streamConnectionId = stream.connection?.connectionId;

      if (currentConnectionId && streamConnectionId === currentConnectionId) {
        return;
      }

      const audioContainer = document.getElementById('ai-audio-container');

      if (!audioContainer) {
        return;
      }

      const subscriber = session.subscribe(
        stream as never,
        audioContainer,
        {
          insertMode: 'append',
          subscribeToAudio: true,
          subscribeToVideo: false,
          style: { buttonDisplayMode: 'off' },
        },
        (error?: unknown) => {
          if (error) {
            console.error('Error subscribing to AI stream:', error);
          }
        }
      );

      if (!subscriber) {
        return;
      }

      activeAiSubscriberRef.current = subscriber;
    };

    session.on('signal:chat', handleChatSignal);
    session.on('signal:join', handleJoinSignal);
    session.on('signal', handleAnySignal);
    session.on('streamCreated', handleStreamCreated);

    activeSignalHandlers.current = {
      handleChatSignal,
      handleJoinSignal,
      handleAnySignal,
      handleStreamCreated,
    };
  };

  const registerPrecallSession = async (): Promise<PrecallSessionResponse> => {
    const registerResponse = await fetch(getPrecallApiUrl('/vregister'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomName }),
    });

    if (!registerResponse.ok) {
      throw new Error('Pre-call check-in failed');
    }

    const registerData = (await registerResponse.json()) as {
      session?: PrecallSessionResponse;
      sessionId?: string;
      token?: string;
      jwt?: string;
      apiKey?: string;
    };

    const normalizedSession = (() => {
      if (registerData.session) {
        return registerData.session;
      }

      return {
        sessionId: registerData.sessionId,
        token: registerData.token ?? registerData.jwt,
        apiKey: registerData.apiKey,
      } satisfies PrecallSessionResponse;
    })();

    const hasRequiredCredentials =
      !!normalizedSession.sessionId && !!normalizedSession.token && !!normalizedSession.apiKey;

    if (!hasRequiredCredentials) {
      throw new Error('Invalid /vregister response. Missing sessionId, token, or apiKey.');
    }

    precallSession.current = normalizedSession;

    return normalizedSession;
  };

  const connectAndPublishPrecallSession = async (
    sessionCredentials: Required<Pick<PrecallSessionResponse, 'sessionId' | 'token' | 'apiKey'>>
  ): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const previewPublisher = publisher as Publisher | null;

    if (!previewPublisher) {
      throw new Error('No publisher available to publish.');
    }

    const vonageSession = initSession(sessionCredentials.apiKey, sessionCredentials.sessionId);
    activePrecallVonageSession.current = vonageSession;

    let publishedStreamId: string | undefined;

    await new Promise<void>((resolve, reject) => {
      vonageSession.connect(sessionCredentials.token, (connectionError) => {
        if (connectionError) {
          reject(connectionError);
          return;
        }

        // Attach signal handlers immediately after connect, before publish
        attachSignalHandlers(vonageSession);

        vonageSession.publish(previewPublisher, (publishError) => {
          if (publishError) {
            reject(publishError);
            return;
          }

          // Capture streamId immediately after publish succeeds
          publishedStreamId = previewPublisher.stream?.streamId;

          // Small delay to ensure stream is fully initialized before resolving
          setTimeout(() => {
            resolve();
          }, 100);
        });
      });
    });

    if (!publishedStreamId) {
      throw new Error('No streamId available after publishing to pre-call session.');
    }

    return publishedStreamId;
  };

  const handlePrecallToggle = async () => {
    try {
      setIsPrecallLoading(true);

      if (!hasPrecallStarted) {
        // Always register a fresh pre-call session to avoid reuse issues
        const registerResult = await registerPrecallSession();

        if (!registerResult.sessionId || !registerResult.token || !registerResult.apiKey) {
          throw new Error('Cannot start pre-call due to missing credentials.');
        }

        const streamIdFromPublisher = await connectAndPublishPrecallSession({
          sessionId: registerResult.sessionId,
          token: registerResult.token,
          apiKey: registerResult.apiKey,
        });

        // eslint-disable-next-line @cspell/spellchecker
        const promptId = import.meta.env.VITE_NOVASONIC_ID || '';
        const currentLanguage = i18n.language;
        const connectorVoice = getConnectorVoiceFromLanguage(currentLanguage);

        const startPayload = {
          sessionId: registerResult.sessionId,
          token: registerResult.token,
          streamId: streamIdFromPublisher,
          language: 'en-US',
          promptId,
          filter: false,
          voice: connectorVoice,
        };

        const startResponse = await fetch(getPrecallApiUrl('/vstart'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(startPayload),
        });

        if (!startResponse.ok) {
          throw new Error('Pre-call start failed');
        }

        setHasPrecallStarted(true);
        return;
      }

      await stopPrecallAssistant();
    } catch (error) {
      console.error('Pre-call toggle error:', error);
    } finally {
      setIsPrecallLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (activePrecallVonageSession.current) {
        detachSignalHandlers(activePrecallVonageSession.current);
        activePrecallVonageSession.current.disconnect();
        activePrecallVonageSession.current = null;
      }

      if (activeAiSubscriberRef.current) {
        activeAiSubscriberRef.current = null;
      }
    };
  }, []);

  return (
    <backgroundEffectsDialog$.Provider>
      <precallNetworkTestDialog$.Provider>
        <Box data-testid="waitingRoom">
          <PageLayout>
            <PageLayout.Banner>
              <Banner />
            </PageLayout.Banner>

            <PageLayout.Left>
              <Box
                className={`relative flex flex-col sm:inline-flex h-auto max-w-full sm:h-100 animate-fade-in`}
              >
                {isRoomReady && (
                  <>
                    <VideoContainer username={username} />

                    <ControlPanel
                      handleAudioInputOpen={handleAudioInputOpen}
                      handleVideoInputOpen={handleVideoInputOpen}
                      handleAudioOutputOpen={handleAudioOutputOpen}
                      handleClose={handleClose}
                      openAudioInput={openAudioInput}
                      openVideoInput={openVideoInput}
                      openAudioOutput={openAudioOutput}
                      anchorEl={anchorEl}
                    />
                  </>
                )}

                {!isRoomReady && <VideoContainerSkeleton />}
              </Box>
            </PageLayout.Left>

            <PageLayout.Right>
              {isRoomReady && (
                <Box className="flex flex-col gap-4 w-full max-w-125">
                  <Box
                    id="ai-audio-container"
                    className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none"
                    aria-hidden
                  />

                  <UsernameInput
                    className={`flex-col sm:inline-flex h-auto animate-fade-in`}
                    username={username}
                    setUsername={setUsername}
                    roomName={roomName}
                    preCallButton={{
                      onClick: handlePrecallToggle,
                      color: hasPrecallStarted ? 'error' : 'info',
                      disabled: isPrecallLoading || (!hasPrecallStarted && !publisher),
                      label: hasPrecallStarted
                        ? t('waitingRoom.aiIntake.stopButton')
                        : t('waitingRoom.aiIntake.startButton'),
                    }}
                  />

                  <Box className="w-full rounded-md border border-vera-border p-3 min-h-32 max-h-52 overflow-y-auto bg-vera-surface">
                    <Typography className="text-vera-secondary text-vera-heading-4! mb-2">
                      {t('waitingRoom.aiIntake.title')}
                    </Typography>

                    {messages.length === 0 && (
                      <Typography className="text-vera-tertiary text-vera-heading-4!">
                        {t('waitingRoom.aiIntake.emptyState')}
                      </Typography>
                    )}

                    {messages.map((message, index) => (
                      <Box key={`${message.sender}-${index}`} className="mb-2">
                        <Box className="flex items-baseline gap-2">
                          <Typography className="text-vera-secondary text-vera-heading-4!">
                            {message.sender}
                          </Typography>
                          <Typography
                            className="text-vera-tertiary"
                            style={{ fontSize: '0.65rem' }}
                          >
                            {message.timestamp}
                          </Typography>
                        </Box>
                        <Typography className="text-vera-tertiary text-vera-heading-4!">
                          {message.text}
                        </Typography>
                      </Box>
                    ))}
                    <div ref={messagesEndRef} />
                  </Box>
                </Box>
              )}

              {!isRoomReady && <UsernameInputSkeleton />}
            </PageLayout.Right>

            <PageLayout.Footer>
              <Footer />
            </PageLayout.Footer>
          </PageLayout>
          {accessStatus !== DEVICE_ACCESS_STATUS.ACCEPTED && (
            <DeviceAccessAlert accessStatus={accessStatus} />
          )}
        </Box>
      </precallNetworkTestDialog$.Provider>
    </backgroundEffectsDialog$.Provider>
  );
};

export default WaitingRoom;
