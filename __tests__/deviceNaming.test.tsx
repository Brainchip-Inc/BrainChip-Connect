/**
 * Pins that the app calls the connected board by the name that board gave, and
 * that it does not pass off a part inside the board as the board itself.
 *
 * The app serves more than one board, and every screen used to say "AkidaTag"
 * whatever was in the user's hand, so someone updating a BrainBoard1500 was
 * told about hardware they do not own. A fixed model name in this copy is the
 * bug, which is why these cases drive the same endings through two different
 * boards and insist the wording follows.
 *
 * The preview screen made the same mistake the other way round: it labelled
 * the AKD1500 accelerator id "Device Type", and every board carries that part,
 * so it never said which board was being previewed.
 *
 * @format
 */

import { Buffer } from 'buffer';
import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import ReactTestRenderer from 'react-test-renderer';
import FirmwareUpdateStatus from '../src/components/common/FirmwareUpdateStatus';
import ModelUpdateStatus from '../src/components/common/ModelUpdateStatus';
import {
  nameForDevice,
  UNNAMED_DEVICE,
  useBleStore,
} from '../src/app/store/useBleStore';

/** Route params the preview screen is opened with, set per case. */
let mockPreviewParams: object = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: mockPreviewParams }),
}));

// Required rather than imported so the navigation mock above is in place
// before the screen is loaded.
const DevicePreviewScreen =
  require('../src/app/screens/Device/DevicePreviewScreen').default;
import { describeModelUpdateEnding } from '../src/services/ble/modelUpdateAnnouncement';
import { describeUpdateEnding } from '../src/services/firmware/firmwareUpdateAnnouncement';
import {
  FirmwareUpdateEnding,
  FirmwareUpdateStage,
} from '../src/types/firmwareUpdate';
import { ModelUpdateEnding, ModelUpdateStage } from '../src/types/modelUpdate';

const BOARDS = ['AkidaTag', 'BrainBoard1500'];

const FIRMWARE_ENDINGS: FirmwareUpdateEnding[] = [
  { status: 'installed', version: '1.2.0' },
  { status: 'rejected', runningVersion: '1.1.1' },
  { status: 'rejected', runningVersion: null },
  { status: 'not-restarted', runningVersion: '1.1.1' },
  { status: 'unconfirmed', reason: 'unidentifiable' },
  { status: 'unconfirmed', reason: 'unreachable' },
  { status: 'unconfirmed', reason: 'unrecognised' },
  { status: 'unconfirmed', reason: 'unanswered' },
  { status: 'failed', detail: 'The board stopped accepting the firmware.' },
  { status: 'failed' },
];

const MODEL_ENDINGS: ModelUpdateEnding[] = [
  { status: 'installed' },
  { status: 'not-running' },
  {
    status: 'failed',
    detail: 'The board refused this model.',
    boardHasNoModel: false,
  },
  { status: 'failed', boardHasNoModel: true },
];

/**
 * Every string a rendered card actually puts on screen, run together.
 *
 * @param element - The card to render, already given its props.
 * @returns One line of everything the user would read.
 */
const renderedText = async (element: React.ReactElement): Promise<string> => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <PaperProvider>{element}</PaperProvider>,
    );
  });

  const shown = renderer.root
    .findAll(node => typeof node.type === 'string')
    .flatMap(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).filter((child: unknown) => typeof child === 'string'),
    )
    .join(' ');

  await ReactTestRenderer.act(() => renderer.unmount());

  return shown.replace(/\s+/g, ' ');
};

describe('naming the device the app is connected to', () => {
  it('takes the name from the device record', () => {
    expect(
      nameForDevice({
        id: 'x',
        name: 'BrainBoard1500',
        rssi: null,
        deviceInfo: null,
        serviceUUIDs: null,
      }),
    ).toBe('BrainBoard1500');
  });

  it('reads as a sentence when there is no name to use', () => {
    // A board can be picked, connected and updated before it ever reports a
    // name, and an update that ends with the board gone has no record left at
    // all. Neither may put an empty gap or the word undefined on screen.
    expect(nameForDevice(null)).toBe(UNNAMED_DEVICE);
    expect(
      nameForDevice({
        id: 'x',
        name: null,
        rssi: null,
        deviceInfo: null,
        serviceUUIDs: null,
      }),
    ).toBe(UNNAMED_DEVICE);
    expect(
      nameForDevice({
        id: 'x',
        name: '   ',
        rssi: null,
        deviceInfo: null,
        serviceUUIDs: null,
      }),
    ).toBe(UNNAMED_DEVICE);
    expect(`Your ${UNNAMED_DEVICE} is still running the model it had.`).toBe(
      'Your device is still running the model it had.',
    );
  });
});

describe('what a firmware update tells the user about their board', () => {
  it('names the board it was given and no other', () => {
    BOARDS.forEach(board => {
      const other = BOARDS.filter(name => name !== board);

      FIRMWARE_ENDINGS.forEach(ending => {
        [true, false].forEach(stillConnected => {
          const { title, message } = describeUpdateEnding(
            ending,
            stillConnected,
            board,
          );
          const said = `${title} ${message}`;

          expect(said).toContain(board);
          other.forEach(wrongBoard => {
            expect(said).not.toContain(wrongBoard);
          });
        });
      });
    });
  });

  it('says which board it means wherever it says "your" board', () => {
    FIRMWARE_ENDINGS.forEach(ending => {
      const { title, message } = describeUpdateEnding(
        ending,
        false,
        'BrainBoard1500',
      );

      expect(`${title} ${message}`).not.toMatch(/your board/i);
    });
  });
});

describe('what a model update tells the user about their board', () => {
  it('names the board it was given and no other', () => {
    BOARDS.forEach(board => {
      const other = BOARDS.filter(name => name !== board);

      MODEL_ENDINGS.forEach(ending => {
        const { title, message } = describeModelUpdateEnding(ending, board);
        const said = `${title} ${message}`;

        expect(said).toContain(board);
        other.forEach(wrongBoard => {
          expect(said).not.toContain(wrongBoard);
        });
      });
    });
  });
});

describe('the cards an update runs behind', () => {
  it('names the board while the model is being installed on it', async () => {
    const stage: ModelUpdateStage = { kind: 'installing' };

    expect(
      await renderedText(
        <ModelUpdateStatus
          stage={stage}
          deviceName="BrainBoard1500"
          onStop={() => {}}
          onDone={() => {}}
        />,
      ),
    ).toContain('Installing on your BrainBoard1500');
  });

  it('names the board in the answer it gives about the model', async () => {
    const stage: ModelUpdateStage = {
      kind: 'done',
      ending: { status: 'installed' },
    };

    const shown = await renderedText(
      <ModelUpdateStatus
        stage={stage}
        deviceName="BrainBoard1500"
        onStop={() => {}}
        onDone={() => {}}
      />,
    );

    expect(shown).toContain('Your BrainBoard1500 has the new model');
    expect(shown).not.toContain('AkidaTag');
  });

  it('names the board while it is away installing firmware', async () => {
    const stage: FirmwareUpdateStage = { kind: 'checking' };

    const shown = await renderedText(
      <FirmwareUpdateStatus
        stage={stage}
        sentVersion="1.2.0"
        deviceName="BrainBoard1500"
        onDone={() => {}}
      />,
    );

    expect(shown).toContain('Waiting for your BrainBoard1500');
    expect(shown).not.toContain('AkidaTag');
  });

  it('names the board in the answer it gives about the firmware', async () => {
    const stage: FirmwareUpdateStage = {
      kind: 'done',
      ending: { status: 'rejected', runningVersion: '1.1.1' },
      stillConnected: true,
    };

    const shown = await renderedText(
      <FirmwareUpdateStatus
        stage={stage}
        sentVersion="1.2.0"
        deviceName="BrainBoard1500"
        onDone={() => {}}
      />,
    );

    expect(shown).toContain('Your BrainBoard1500 is still running firmware');
    expect(shown).not.toContain('AkidaTag');
  });
});

describe('what the preview screen calls the part inside the board', () => {
  beforeEach(() => {
    useBleStore.getState().setParsedDeviceInfo({
      aiAccelerator: 'Unknown',
      firmwareVersion: 'Unknown',
      bleVersion: 'Unknown',
    });
  });

  /**
   * Open the preview screen on one advertisement.
   *
   * @param manufacturerData - What the board broadcast, or null for a board
   *   that gave none.
   * @returns Everything the screen puts on the page.
   */
  const preview = async (manufacturerData: string | null): Promise<string> => {
    mockPreviewParams = {
      deviceId: 'AA:BB:CC:DD:EE:01',
      deviceName: 'BrainBoard1500',
      rssi: -50,
      deviceInfo: manufacturerData,
      serviceUUIDs: null,
    };

    return renderedText(<DevicePreviewScreen />);
  };

  it('labels the accelerator id for the part it identifies', async () => {
    // AKD1500 is the AI accelerator, and both boards carry one, so calling it
    // the device type claimed it said which board this is. It never did.
    const shown = await preview(
      Buffer.from('53100AKD1500', 'latin1').toString('base64'),
    );

    expect(shown).toContain('AI Accelerator AKD1500');
    expect(shown).not.toContain('Device Type');
  });

  it('names the board from the name the board advertised', async () => {
    const shown = await preview(
      Buffer.from('53100AKD1500', 'latin1').toString('base64'),
    );

    expect(shown).toContain('BrainBoard1500');
  });

  it('says the accelerator is unknown rather than showing a gap', async () => {
    const shown = await preview(null);

    expect(shown).toContain('AI Accelerator Unknown');
    expect(shown).not.toMatch(/undefined/);
  });
});
