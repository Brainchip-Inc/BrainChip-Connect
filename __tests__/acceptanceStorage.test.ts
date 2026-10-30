/**
 * Pins where the app remembers that the user accepted Privacy and Terms.
 *
 * The keys are persisted state on a real install, so their names are a
 * contract rather than an implementation detail: the acceptance screens write
 * them once and every later launch reads them back to decide whether to ask
 * again. BrainChip Connect stores them under `@brainchip_connect_*`.
 *
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAcceptanceState,
  setPrivacyAcceptedPersisted,
  setTermsAcceptedPersisted,
} from '../src/app/store/acceptanceStorage';

describe('acceptance persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('reports nothing accepted on a fresh install', async () => {
    await expect(getAcceptanceState()).resolves.toEqual({
      privacyAccepted: false,
      termsAccepted: false,
    });
  });

  it('remembers both acceptances across a relaunch', async () => {
    await setPrivacyAcceptedPersisted(true);
    await setTermsAcceptedPersisted(true);

    await expect(getAcceptanceState()).resolves.toEqual({
      privacyAccepted: true,
      termsAccepted: true,
    });
  });

  it('writes each acceptance under its BrainChip Connect key', async () => {
    await setPrivacyAcceptedPersisted(true);
    await setTermsAcceptedPersisted(true);

    await expect(
      AsyncStorage.getItem('@brainchip_connect_privacy_accepted'),
    ).resolves.toBe('true');
    await expect(
      AsyncStorage.getItem('@brainchip_connect_terms_accepted'),
    ).resolves.toBe('true');
    const keys = await AsyncStorage.getAllKeys();
    expect([...keys].sort()).toEqual([
      '@brainchip_connect_privacy_accepted',
      '@brainchip_connect_terms_accepted',
    ]);
  });

  it('carries a withdrawn acceptance back to the acceptance screen', async () => {
    await setPrivacyAcceptedPersisted(true);
    await setTermsAcceptedPersisted(true);
    await setTermsAcceptedPersisted(false);

    await expect(getAcceptanceState()).resolves.toEqual({
      privacyAccepted: true,
      termsAccepted: false,
    });
  });

});
