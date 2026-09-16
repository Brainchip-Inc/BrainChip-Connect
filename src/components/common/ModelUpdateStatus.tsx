import { RefreshCw } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Colors } from '../../app/theme/theme';
import { describeModelUpdateEnding } from '../../services/ble/modelUpdateAnnouncement';
import { ModelUpdateEnding, ModelUpdateStage } from '../../types/modelUpdate';
import UpdateOutcomeMark from './UpdateOutcomeMark';

interface ModelUpdateStatusProps {
  stage: ModelUpdateStage;
  onStop: () => void;
  onDone: () => void;
}

/**
 * How far the transfer has got, as a bar that is filled in directly.
 *
 * It is two plain views rather than an animated progress component because
 * sending a model keeps the JavaScript thread busy from the moment this card
 * appears, and a bar that has to measure itself before it can animate never
 * gets the chance: it stays empty for the whole transfer.
 */
const ProgressBar = ({ percent }: { percent: number }) => (
  <View style={styles.progressTrack}>
    <View style={[styles.progressFill, { width: `${percent}%` }]} />
  </View>
);

/**
 * Show the model going to the board, with the way out of it.
 *
 * Stopping is offered only here. Once the last byte is across, the board
 * installs the model whether or not the app is still watching, so a button
 * promising to stop it would be promising something the app cannot do.
 */
const SendingBody = ({
  percent,
  onStop,
}: {
  percent: number;
  onStop: () => void;
}) => (
  <View style={styles.centered}>
    <RefreshCw size={36} color={Colors.warning} />
    <Text style={styles.title}>Sending model…</Text>

    <ProgressBar percent={percent} />
    <Text style={styles.percent}>{percent.toFixed(0)}%</Text>

    <Button
      mode="outlined"
      textColor={Colors.error}
      style={styles.stop}
      onPress={onStop}
    >
      Stop Update
    </Button>

    <View style={styles.warning}>
      <Text style={styles.warningText}>
        Do not disconnect or power off the device during the update process.
      </Text>
    </View>
  </View>
);

/**
 * Show the wait between the model arriving and the model running.
 *
 * The bar is full because the transfer really is finished, and the wording is
 * what stops that reading as the update being done: the board still has to
 * program the model into the Akida chip and prove it runs.
 */
const InstallingBody = () => (
  <View style={styles.centered}>
    <RefreshCw size={36} color={Colors.warning} />
    <Text style={styles.title}>Installing on your AkidaTag…</Text>

    <ProgressBar percent={100} />
    <Text style={styles.percent}>100%</Text>

    <Text style={styles.body}>
      The whole model is on the board. It is being programmed into the Akida
      chip and tested, which takes a few seconds.
    </Text>

    <View style={styles.warning}>
      <Text style={styles.warningText}>
        Do not disconnect or power off the device during the update process.
      </Text>
    </View>
  </View>
);

/** Report what the board did with the model, once its answer is in. */
const OutcomeBody = ({
  ending,
  onDone,
}: {
  ending: ModelUpdateEnding;
  onDone: () => void;
}) => {
  const { title, message, mark } = describeModelUpdateEnding(ending);

  return (
    <View>
      <UpdateOutcomeMark mark={mark} />
      <Text style={styles.outcomeTitle}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
      <Button mode="contained" style={styles.action} onPress={onDone}>
        Done
      </Button>
    </View>
  );
};

/**
 * The card an update runs behind, from the first byte to the board's answer.
 *
 * It names each step as it happens rather than showing one bar to the end,
 * because the two steps take different lengths of time and only the second one
 * decides whether the update worked.
 *
 * @returns The card, or nothing at all when no update is running.
 */
const ModelUpdateStatus = ({
  stage,
  onStop,
  onDone,
}: ModelUpdateStatusProps) => {
  if (stage.kind === 'idle') {
    return null;
  }

  return (
    <View style={styles.card}>
      {stage.kind === 'sending' && (
        <SendingBody percent={stage.percent} onStop={onStop} />
      )}
      {stage.kind === 'installing' && <InstallingBody />}
      {stage.kind === 'done' && (
        <OutcomeBody ending={stage.ending} onDone={onDone} />
      )}
    </View>
  );
};

export default ModelUpdateStatus;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 24,
    marginTop: 10,
    marginBottom: 12,
  },

  centered: {
    alignItems: 'center',
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 16,
    textAlign: 'center',
  },

  outcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },

  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border.light,
    marginVertical: 12,
  },

  progressFill: {
    height: '100%',
    backgroundColor: Colors.warning,
  },

  percent: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },

  body: {
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },

  stop: {
    width: '100%',
    borderColor: Colors.error,
    borderRadius: 0,
  },

  action: {
    marginTop: 16,
    width: '100%',
    borderRadius: 0,
    backgroundColor: Colors.primary,
  },

  warning: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#FFD199',
    width: '100%',
  },

  warningText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
});
