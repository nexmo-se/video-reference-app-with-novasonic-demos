import { useLocation } from 'react-router-dom';

type DemoType = 'default' | 'banking' | 'healthcare';

type LogoMetadata = {
  path: string;
  alt: string;
};

type RuntimeExperienceConfiguration = {
  demoType: DemoType;
  isDemoParameterProvided: boolean;
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
  banking: {
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
  banking: 'landing.welcome.titleByDemo.trustedBank',
  healthcare: 'landing.welcome.titleByDemo.healthcare',
};

const waitingRoomAgentTranslationKeyPrefixByDemoType: Record<DemoType, string> = {
  default: 'waitingRoom.aiAgents.banker',
  banking: 'waitingRoom.aiAgents.banker',
  healthcare: 'waitingRoom.aiAgents.healthcareIntake',
};

const promptIdentifierByDemoType = (() => {
  // eslint-disable-next-line @cspell/spellchecker
  const defaultPromptIdentifier = import.meta.env.VITE_BANKING_NOVASONIC_ID;
  const environmentVariables = import.meta.env as Record<string, string | undefined>;

  return {
    default: defaultPromptIdentifier,
    banking: defaultPromptIdentifier,
    healthcare:
      // eslint-disable-next-line @cspell/spellchecker
      environmentVariables.VITE_HEALTHCARE_NOVASONIC_ID ?? defaultPromptIdentifier,
  } satisfies Record<DemoType, string>;
})();

const resolveDemoType = ({ searchParams }: { searchParams: URLSearchParams }): DemoType => {
  const legacyLogoValue = searchParams.get('logo');
  const requestedDemoType = searchParams.get('demo') ?? legacyLogoValue;

  if (requestedDemoType === 'banking' || requestedDemoType === 'trusted-bank') {
    return 'banking';
  }

  if (requestedDemoType === 'healthcare') {
    return 'healthcare';
  }

  return 'default';
};

const useRuntimeExperienceConfiguration = (): RuntimeExperienceConfiguration => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDemoParameterProvided = searchParams.has('demo');

  const demoType = resolveDemoType({ searchParams });

  return {
    demoType,
    isDemoParameterProvided,
    logoMetadata: logoMetadataByDemoType[demoType],
    landingWelcomeTitleSecondLineTranslationKey:
      landingWelcomeTitleSecondLineTranslationKeyByDemoType[demoType],
    waitingRoomAgentTranslationKeyPrefix: waitingRoomAgentTranslationKeyPrefixByDemoType[demoType],
    preCallPromptIdentifier: promptIdentifierByDemoType[demoType],
  };
};

export type { DemoType, RuntimeExperienceConfiguration };

export default useRuntimeExperienceConfiguration;
