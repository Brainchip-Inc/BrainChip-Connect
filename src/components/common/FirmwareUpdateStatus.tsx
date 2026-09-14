import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Colors } from '../../app/theme/theme';
import { formatKeyFingerprint } from '../../services/firmware/mcubootImage';
import {
  FirmwareUpdateStage,
  SigningKeyWarning,
} from '../../types/firmwareUpdate';

interface FirmwareUpdateStatusProps {
  stage: FirmwareUpdateStage;
  /** Version read out of the selected file, shown while the board installs. */
  sentVersion: string | null;
}

interface SigningKeyWarningCardProps {
  warning: SigningKeyWarning;
  fileName: string;
  onSendAnyway: () => void;
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
  </View>
);

/**
 * Show what the update is doing, and nothing once it is over.
 *
 * How an update ended is announced instead of drawn, so that it reaches the
 * user whether or not they stayed on this screen to watch.
 */
const FirmwareUpdateStatus = ({
  stage,
  sentVersion,
}: FirmwareUpdateStatusProps) => {
  if (stage.kind === 'idle') {
    return null;
  }

  return <ProgressCard stage={stage} sentVersion={sentVersion} />;
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
