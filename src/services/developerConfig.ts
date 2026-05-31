import type { DeveloperConfig, AdminModules } from '../types/developer';

const CONFIG_KEY = 'eventix_developer_config';

export const defaultDeveloperConfig: DeveloperConfig = {
  featureFlags: {
    enableReports: false,
    enableProducerOnboarding: true,
    enableBetaFeatures: false,
    enableV2Features: false,
    maintenanceMode: false,
  },
  siteSettings: {
    platformName: 'Eventix',
    supportEmail: 'suporte@eventix.com',
    whatsappNumber: '5511999999999',
  },
  theme: {
    primaryColor: '#d4af37',
    accentColor: '#ffffff',
  },
  payment: {
    provider: 'mock',
    allowMockInProduction: false,
  },
  envUrls: {
    devUrl: 'http://localhost:5173',
    prodUrl: 'https://eventix.com',
  },
  adminModules: {
    approvals_kyc: false,
    reports: false,
    integrations: false,
    notifications: false,
    support: false,
  } satisfies AdminModules,
};

export function loadDeveloperConfig(): DeveloperConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return structuredClone(defaultDeveloperConfig);
    const parsed = JSON.parse(stored) as Partial<DeveloperConfig>;
    return {
      featureFlags: { ...defaultDeveloperConfig.featureFlags, ...parsed.featureFlags },
      siteSettings: { ...defaultDeveloperConfig.siteSettings, ...parsed.siteSettings },
      theme: { ...defaultDeveloperConfig.theme, ...parsed.theme },
      payment: { ...defaultDeveloperConfig.payment, ...parsed.payment },
      envUrls: { ...defaultDeveloperConfig.envUrls, ...parsed.envUrls },
      adminModules: { ...defaultDeveloperConfig.adminModules, ...parsed.adminModules },
    };
  } catch {
    return structuredClone(defaultDeveloperConfig);
  }
}

export function saveDeveloperConfig(config: DeveloperConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function resetDeveloperConfig(): DeveloperConfig {
  localStorage.removeItem(CONFIG_KEY);
  return structuredClone(defaultDeveloperConfig);
}
