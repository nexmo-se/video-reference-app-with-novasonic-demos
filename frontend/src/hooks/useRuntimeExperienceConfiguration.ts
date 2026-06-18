import { useLocation } from 'react-router-dom';

type DemoType = 'default' | 'trusted-bank' | 'healthcare';

type AgentType = 'banker' | 'healthcare-intake';

type LogoMetadata = {
  path: string;
  alt: string;
};

type RuntimeExperienceConfiguration = {
  demoType: DemoType;
  agentType: AgentType;
  logoMetadata: LogoMetadata;
  landingWelcomeTitleSecondLineTranslationKey: string;
  waitingRoomAgentTranslationKeyPrefix: string;
  preCallPromptIdentifier: string;
};

const defaultLogoMetadata: LogoMetadata = {
  path: '/images/vonage-logo-desktop.svg',
  alt: 'Vonage desktop logo',
};

const logoMetadataByDemoType: Record<DemoType, LogoMetadata> = {
  default: defaultLogoMetadata,
  'trusted-bank': {
    path: '/images/logos/trusted-bank-logo.png',
    alt: 'Trusted Bank desktop logo',
  },
  healthcare: {
    path: '/images/logos/promony.png',
    alt: 'Promony Health desktop logo',
  },
};

const landingWelcomeTitleSecondLineTranslationKeyByDemoType: Record<DemoType, string> = {
  default: 'landing.welcome.title.2',
  'trusted-bank': 'landing.welcome.titleByDemo.trustedBank',
  healthcare: 'landing.welcome.titleByDemo.healthcare',
};

const waitingRoomAgentTranslationKeyPrefixByAgentType: Record<AgentType, string> = {
  banker: 'waitingRoom.aiAgents.banker',
  'healthcare-intake': 'waitingRoom.aiAgents.healthcareIntake',
};

const promptIdentifierByAgentType = (() => {
  // eslint-disable-next-line @cspell/spellchecker
  const defaultPromptIdentifier = import.meta.env.VITE_NOVASONIC_ID || '';
  const environmentVariables = import.meta.env as Record<string, string | undefined>;

  return {
    banker: defaultPromptIdentifier,
    'healthcare-intake':
      // eslint-disable-next-line @cspell/spellchecker
      environmentVariables.VITE_HEALTHCARE_NOVASONIC_ID ?? defaultPromptIdentifier,
  } satisfies Record<AgentType, string>;
})();

const resolveDemoType = ({ searchParams }: { searchParams: URLSearchParams }): DemoType => {
  const legacyLogoValue = searchParams.get('logo');
  const requestedDemoType = searchParams.get('demo') ?? legacyLogoValue;

  if (requestedDemoType === 'trusted-bank') {
    return 'trusted-bank';
  }

  if (requestedDemoType === 'healthcare') {
    return 'healthcare';
  }

  return 'default';
};

const resolveAgentType = ({ searchParams }: { searchParams: URLSearchParams }): AgentType => {
  const requestedAgentType = searchParams.get('agent');

  if (requestedAgentType === 'healthcare-intake') {
    return 'healthcare-intake';
  }

  return 'banker';
};

const useRuntimeExperienceConfiguration = (): RuntimeExperienceConfiguration => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const demoType = resolveDemoType({ searchParams });
  const agentType = resolveAgentType({ searchParams });

  return {
    demoType,
    agentType,
    logoMetadata: logoMetadataByDemoType[demoType],
    landingWelcomeTitleSecondLineTranslationKey:
      landingWelcomeTitleSecondLineTranslationKeyByDemoType[demoType],
    waitingRoomAgentTranslationKeyPrefix:
      waitingRoomAgentTranslationKeyPrefixByAgentType[agentType],
    preCallPromptIdentifier: promptIdentifierByAgentType[agentType],
  };
};

export type { DemoType, AgentType, RuntimeExperienceConfiguration };

export default useRuntimeExperienceConfiguration;
