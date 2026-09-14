import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../../app/theme/theme';
import { describeUpdateEnding } from '../../services/firmware/firmwareUpdateAnnouncement';
import { formatKeyFingerprint } from '../../services/firmware/mcubootImage';
import {
  FirmwareUpdateEnding,
  FirmwareUpdateStage,
  SigningKeyWarning,
} from '../../types/firmwareUpdate';

interface FirmwareUpdateStatusProps {
  stage: FirmwareUpdateStage;
  /** Version read out of the selected file, shown while the board installs. */
  sentVersion: string | null;
  onDone: () => void;
}

interface SigningKeyWarningCardProps {
  warning: SigningKeyWarning;
  fileName: string;
  onSendAnyway: () => void;
  disabled: boolean;
}

/**
 * Describe what the app is doing to the board right now.
 *
 * Restarting and checking are separate steps because the board is unreachable
 * for the first and answering for the second, and only the second can tell the
 * user anything.
 */
const ProgressBody = ({
  stage,
  sentVersion,
}: {
  stage: Exclude<FirmwareUpdateStage, { kind: 'idle' | 'done' }>;
  sentVersion: string | null;
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
        <Text style={styles.title}>Restarting your AkidaTag…</Text>
        <Text style={styles.body}>
          The board is installing
          {sentVersion ? ` firmware ${sentVersion}` : ' the firmware'}. This can
          take up to two minutes.
        </Text>
        <Text style={styles.body}>Do not power the board off.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.title}>Checking the board…</Text>
      <Text style={styles.body}>
        Reconnecting to confirm which firmware your AkidaTag is running.
      </Text>
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
  onDone,
}: {
  ending: FirmwareUpdateEnding;
  onDone: () => void;
}) => {
  const { title, message } = describeUpdateEnding(ending);

  return (
    <View>
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
 * This is the one place a signing key is named, because it is the one place
 * the app knows both keys for certain: the file's own, and the one that signed
 * the last firmware this board took.
 */
export const SigningKeyWarningCard = ({
  warning,
  fileName,
  onSendAnyway,
  disabled,
}: SigningKeyWarningCardProps) => (
  <View style={[styles.outcome, { borderColor: Colors.warning }]}>
    <Text style={styles.title}>This file may not install</Text>
    <Text style={styles.body}>
      {fileName} is signed with key {formatKeyFingerprint(warning.fileKeyHash)}.
      The last firmware this board accepted was signed with{' '}
      {formatKeyFingerprint(warning.boardKeyHash)}.
    </Text>
    <Text style={styles.body}>
      If your board still only trusts that key it will refuse this file and keep
      running its current firmware.
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
            <OutcomeBody ending={stage.ending} onDone={onDone} />
          ) : (
            <ProgressBody stage={stage} sentVersion={sentVersion} />
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
