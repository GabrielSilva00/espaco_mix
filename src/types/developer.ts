export interface FeatureFlags {
  enableReports: boolean;
  enableProducerOnboarding: boolean;
  enableBetaFeatures: boolean;
  enableV2Features: boolean;
  maintenanceMode: boolean;
}

export interface SiteSettings {
  platformName: string;
  supportEmail: string;
  whatsappNumber: string;
}

export interface ThemeSettings {
  primaryColor: string;
  accentColor: string;
}

export interface PaymentConfig {
  provider: 'mock' | 'stripe' | 'mercadopago';
  allowMockInProduction: boolean;
}

export interface EnvUrls {
  devUrl: string;
  prodUrl: string;
}

export interface DeveloperConfig {
  featureFlags: FeatureFlags;
  siteSettings: SiteSettings;
  theme: ThemeSettings;
  payment: PaymentConfig;
  envUrls: EnvUrls;
}
