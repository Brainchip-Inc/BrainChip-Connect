/**
 * Pins what the pre-flight warning is allowed to put in front of a user.
 *
 * The card exists to stop someone sending a file the board is unlikely to
 * take, and the two key digests it compared are deliberately not part of that:
 * they mean nothing to the person holding the board, and naming them alongside
 * a refusal the board never explains reads as blaming the key. So the copy is
 * fixed here, and so is the absence of any digest behind it.
 *
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SigningKeyWarningCard } from '../src/components/common/FirmwareUpdateStatus';

const FILE_NAME = 'akidatag-1.2.0.signed.bin';

/** Every string the card actually renders, in order. */
const renderCardText = async (): Promise<string[]> => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <SigningKeyWarningCard
        fileName={FILE_NAME}
        onSendAnyway={() => {}}
        disabled={false}
      />,
    );
  });

  const text: string[] = [];
  const collect = (node: ReactTestRenderer.ReactTestRendererJSON | string) => {
    if (typeof node === 'string') {
      text.push(node);
      return;
    }
    (node.children ?? []).forEach(collect);
  };

  const tree = renderer.toJSON();
  if (tree) {
    (Array.isArray(tree) ? tree : [tree]).forEach(collect);
  }
  await ReactTestRenderer.act(() => renderer.unmount());

  return text;
};

describe('the pre-flight signing key warning', () => {
  it('names the file and says the key differs, in one sentence', async () => {
    const shown = (await renderCardText()).join(' ').replace(/\s+/g, ' ');

    expect(shown).toContain('This file may not install');
    expect(shown).toContain(
      `${FILE_NAME} is signed with a different signing key and may not be ` +
        'accepted by the board',
    );
    expect(shown).toContain('Send it anyway');
  });

  it('puts no key digest on screen', async () => {
    const shown = (await renderCardText()).join(' ');

    expect(shown).not.toMatch(/[0-9a-f]{8,}/i);
    expect(shown).not.toMatch(/…/);
  });

  it('does not explain what the board did with the last firmware', async () => {
    // The app infers the board's key from the last install that worked. That
    // inference is not something to put in front of a user, and it is wrong
    // often enough to matter: a board can be given a new key without the app
    // ever seeing it happen.
    const shown = (await renderCardText()).join(' ').toLowerCase();

    expect(shown).not.toContain('last firmware');
    expect(shown).not.toContain('accepted was signed');
  });
});
