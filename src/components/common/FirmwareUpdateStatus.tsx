import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import {
  FirmwareUpdateEnding,
  FirmwareUpdateStage,
  SigningKeyWarning,
} from '../../app/hooks/useFirmwareUpdate';
import { Colors } from '../../app/theme/theme';
import { formatKeyFingerprint } from '../../services/firmware/mcubootImage';

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
  onChooseAnotherFile: () => void;
}

/**
 * Describe what the app is doing to the board right now.
 *
 * Restarting and checking are separate steps because the board is unreachable
 * for the first and answering for the second, and only the second can tell the
 * user anything.
 */
const ProgressCard = ({
  stage,
  sentVersion,
}: {
  stage: FirmwareUpdateStage;
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
 * Report what the board did with the firmware, once it has been asked.
 *
 * A refused update names no cause. The board never reports why it turned an
 * image down, so anything beyond "it did not install" would be a guess. An
 * update that could not be confirmed says which of the two things went wrong,
 * because being unable to recognise the board and being unable to get an
 * answer out of it are not the same news.
 */
const OutcomeCard = ({
  stage,
  onDone,
}: {
  stage: FirmwareUpdateEnding;
  onDone: () => void;
}) => {
  if (stage.kind === 'installed') {
    return (
      <View style={[styles.outcome, { borderColor: Colors.success }]}>
        <Text style={[styles.title, { color: Colors.success }]}>
          Update installed
        </Text>
        <Text style={styles.body}>
          Your AkidaTag is now running firmware {stage.version}.
        </Text>
        <Text style={styles.body}>
          Confirmed with the board after it restarted.
        </Text>
        <Button mode="contained" style={styles.action} onPress={onDone}>
          Done
        </Button>
      </View>
    );
  }

  if (stage.kind === 'rejected') {
    return (
      <View style={[styles.outcome, { borderColor: Colors.error }]}>
        <Text style={[styles.title, { color: Colors.error }]}>
          Update did not install
        </Text>
        <Text style={styles.body}>
          Your AkidaTag is still running
          {stage.runningVersion
            ? ` firmware ${stage.runningVersion}`
            : ' its previous firmware'}
          . It did not accept the firmware you sent and restarted on its
          previous version. Nothing on the board was changed.
        </Text>
        <Button mode="contained" style={styles.action} onPress={onDone}>
          Done
        </Button>
      </View>
    );
  }

  if (stage.kind === 'failed') {
    return (
      <View style={[styles.outcome, { borderColor: Colors.warning }]}>
        <Text style={styles.title}>Update failed</Text>
        <Text style={styles.body}>
          The firmware could not be sent to your AkidaTag. The board is still
          running its previous firmware and nothing on it was changed.
        </Text>
        <Text style={styles.detail}>Details: {stage.detail}</Text>
        <Button mode="contained" style={styles.action} onPress={onDone}>
          Done
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.outcome}>
      <Text style={styles.title}>Could not confirm the update</Text>
      <Text style={styles.body}>
        {stage.reason === 'unidentifiable'
          ? 'The firmware was sent and your AkidaTag restarted, but it never reported the serial number that tells one AkidaTag from another. The app could not be sure it was asking the same board, so it did not ask.'
          : 'The firmware was sent and your AkidaTag restarted, but it did not answer when the app asked which firmware it is now running.'}
      </Text>
      <Text style={styles.body}>
        Select your AkidaTag in the device list to see the firmware version it
        is running now.
      </Text>
      <Button mode="contained" style={styles.action} onPress={onDone}>
        Reconnect
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
  onChooseAnotherFile,
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
    <Button mode="outlined" style={styles.action} onPress={onSendAnyway}>
      Send it anyway
    </Button>
    <Button
      mode="contained"
      style={styles.action}
      onPress={onChooseAnotherFile}
    >
      Choose a different file
    </Button>
  </View>
);

/**
 * Render whichever of the update's states is current, and nothing when idle.
 */
const FirmwareUpdateStatus = ({
  stage,
  sentVersion,
  onDone,
}: FirmwareUpdateStatusProps) => {
  if (stage.kind === 'idle') {
    return null;
  }

  if (
    stage.kind === 'sending' ||
    stage.kind === 'restarting' ||
    stage.kind === 'checking'
  ) {
    return <ProgressCard stage={stage} sentVersion={sentVersion} />;
  }

  return <OutcomeCard stage={stage} onDone={onDone} />;
};

export default FirmwareUpdateStatus;

const styles = StyleSheet.create({
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

  detail: {
    fontSize: 12,
    color: Colors.text.tertiary,
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
