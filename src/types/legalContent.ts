/**
 * Shapes of the Terms and Conditions and Privacy Policy documents rendered by
 * the legal screens. The content itself ships with the app; see
 * `src/app/content/`.
 */

export interface Banner {
  title: string;
  content: string;
}

export interface TermsItem {
  title: string;
}

export interface TermsSection {
  title: string;
  description: string;
  items: TermsItem[];
}

export interface TermsContent {
  title: string;
  last_updated: string;
  banners: Banner[];
  sections: TermsSection[];
}

export interface PolicyItem {
  icon?: string;
  title: string;
  description?: string | null;
}

export interface PolicySection {
  title: string;
  icon?: string;
  description?: string | null;
  items: PolicyItem[];
}

export interface PrivacyPolicyContent {
  title: string;
  last_updated: string;
  banners: Banner[];
  sections: PolicySection[];
}
