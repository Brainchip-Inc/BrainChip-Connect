import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCEPTANCE_KEYS = {
  privacy: '@spark_privacy_accepted',
  terms: '@spark_terms_accepted',
} as const;

export interface AcceptanceState {
  privacyAccepted: boolean;
  termsAccepted: boolean;
}

export const getAcceptanceState = async (): Promise<AcceptanceState> => {
  try {
    const [privacy, terms] = await Promise.all([
      AsyncStorage.getItem(ACCEPTANCE_KEYS.privacy),
      AsyncStorage.getItem(ACCEPTANCE_KEYS.terms),
    ]);

    return {
      privacyAccepted: privacy === 'true',
      termsAccepted: terms === 'true',
    };
  } catch {
    return {
      privacyAccepted: false,
      termsAccepted: false,
    };
  }
};

export const setPrivacyAcceptedPersisted = async (value: boolean): Promise<void> => {
  await AsyncStorage.setItem(ACCEPTANCE_KEYS.privacy, String(value));
};

export const setTermsAcceptedPersisted = async (value: boolean): Promise<void> => {
  await AsyncStorage.setItem(ACCEPTANCE_KEYS.terms, String(value));
};

export const setAcceptancePersisted = async ({
  privacyAccepted,
  termsAccepted,
}: AcceptanceState): Promise<void> => {
  await Promise.all([
    setPrivacyAcceptedPersisted(privacyAccepted),
    setTermsAcceptedPersisted(termsAccepted),
  ]);
};
