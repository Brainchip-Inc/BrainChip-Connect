import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../../app/theme/theme';
import { describeUpdateEnding } from '../../services/firmware/firmwareUpdateAnnouncement';
import {
  FirmwareUpdateEnding,
  FirmwareUpdateStage,
} from '../../types/firmwareUpdate';
import UpdateOutcomeMark from './UpdateOutcomeMark';

interface FirmwareUpdateStatusProps {
  stage: FirmwareUpdateStage;
  /** Version read out of the selected file, shown while the board installs. */
  sentVersion: string | null;
  /** What the board being updated calls itself. */
  deviceName: string;
  onDone: () => void;
}

interface SigningKeyWarningCardProps {
  fileName: string;
  onSendAnyway: () => void;
  disabled: boolean;
}

/**
 * Describe what the app is doing to the board right now.
 *
 * The long wait is the last step, not the restart: the board is away for as
 * long as it takes to install the image, and the app spends that time looking
 * for it. So that is where the estimate and the warning against cutting the
 * power belong, since pulling the power there is what does real harm.
 */
const ProgressBody = ({
  stage,
  sentVersion,
  deviceName,
}: {
  stage: Exclude<FirmwareUpdateStage, { kind: 'idle' | 'done' }>;
  sentVersion: string | null;
  deviceName: string;
}) => {
  if (stage.kind === 'sending') {
    return (
      <View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${stage.percent}%` }]} />
        </View>
        <Text style={styles.progressText}>
          Sending firmware… {stage.percent.toFixed(0)}%
        </Text>
        <Text style={styles.body}>
          Keep the app open and stay near the board.
        </Text>
      </View>
    );
  }

  if (stage.kind === 'restarting') {
    return (
      <View>
        <Text style={styles.title}>Restarting your {deviceName}…</Text>
        <Text style={styles.body}>
          The firmware is on the board and it has been asked to restart.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.title}>Waiting for your {deviceName}…</Text>
      <Text style={styles.body}>
        The board installs
        {sentVersion ? ` firmware ${sentVersion}` : ' the firmware'} while it is
        away, which can take up to two minutes. The app is looking for it and
        will say which firmware it came back running.
      </Text>
      <Text style={styles.body}>Do not power the board off.</Text>
    </View>
  );
};

/**
 * Report what the board did with the firmware, once its answer is in.
 *
 * The board never says why it turned an image down, so a refusal is stated
 * without a cause; every other ending says only what the app watched happen.
 */
const OutcomeBody = ({
  ending,
  stillConnected,
  deviceName,
  onDone,
}: {
  ending: FirmwareUpdateEnding;
  stillConnected: boolean;
  deviceName: string;
  onDone: () => void;
}) => {
  const { title, message, mark } = describeUpdateEnding(
    ending,
    stillConnected,
    deviceName,
  );

  return (
    <View>
      <UpdateOutcomeMark mark={mark} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
      <Button mode="contained" style={styles.action} onPress={onDone}>
        Done
      </Button>
    </View>
  );
};

/**
 * Warn before the upload that a board is unlikely to accept this file.
 *
 * The fingerprints behind this warning stay out of it. They are what the app
 * compared, but a hex digest means nothing to someone holding a board, and
 * spelling out which key signed what invites reading the refusal that may
 * follow as proven to be the key's fault, which the board never says. The
 * development log keeps them for whoever is diagnosing a report.
 */
export const SigningKeyWarningCard = ({
  fileName,
  onSendAnyway,
  disabled,
}: SigningKeyWarningCardProps) => (
  <View style={[styles.outcome, { borderColor: Colors.warning }]}>
    <Text style={styles.title}>This file may not install</Text>
    <Text style={styles.body}>
      {fileName} is signed with a different signing key and may not be accepted
      by the board.
    </Text>
    <Button
      mode="outlined"
      style={styles.action}
      disabled={disabled}
      onPress={onSendAnyway}
    >
      Send it anyway
    </Button>
  </View>
);

/**
 * The one modal an update runs behind, from the first byte to the answer.
 *
 * It opens when the install starts, names each step as it happens, and then
 * holds the result until the user presses Done. There is nothing to dismiss it
 * with before that: an update the app has stopped following would leave the
 * board mid-flash with nobody watching, and the steps are what tell the user
 * the two-minute silence while the board restarts is expected.
 */
const FirmwareUpdateStatus = ({
  stage,
  sentVersion,
  deviceName,
  onDone,
}: FirmwareUpdateStatusProps) => {
  if (stage.kind === 'idle') {
    return null;
  }

  return (
    <Portal>
      <Modal
        visible
        dismissable={false}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modal}>
          {stage.kind === 'done' ? (
            <OutcomeBody
              ending={stage.ending}
              stillConnected={stage.stillConnected}
              deviceName={deviceName}
              onDone={onDone}
            />
          ) : (
            <ProgressBody
              stage={stage}
              sentVersion={sentVersion}
              deviceName={deviceName}
            />
          )}
        </View>
      </Modal>
    </Portal>
  );
};

export default FirmwareUpdateStatus;

const styles = StyleSheet.create({
  modalContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  modal: {
    width: '100%',
    backgroundColor: Colors.white,
    padding: 20,
  },

  outcome: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.white,
    padding: 16,
    marginBottom: 16,
  },

  title: {
    fontFamily: 'Sora',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },

  body: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 8,
  },

  action: {
    borderRadius: 0,
    marginTop: 8,
  },

  progressBar: {
    height: 6,
    backgroundColor: Colors.border.light,
    marginBottom: 8,
  },

  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },

  progressText: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 8,
  },
});
