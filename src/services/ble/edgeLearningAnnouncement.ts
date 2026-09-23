import { EdgeCommand } from '../../types/edgeLearning';

/** What each edge learning command is called on the control that sends it. */
const COMMAND_LABELS: Record<EdgeCommand, string> = {
  [EdgeCommand.ToggleLearningMode]: 'Edge Learning',
  [EdgeCommand.StartLearning]: 'Start Learning',
  [EdgeCommand.DeleteClass]: 'Delete Class',
  [EdgeCommand.NextClass]: 'Next Class',
};

/** What stays as it was when the board does not take each command. */
const UNCHANGED_OUTCOMES: Record<EdgeCommand, string> = {
  [EdgeCommand.ToggleLearningMode]: 'Edge Learning stays as it was.',
  [EdgeCommand.StartLearning]: 'Learning has not started.',
  [EdgeCommand.DeleteClass]: 'No class was deleted.',
  [EdgeCommand.NextClass]: 'The class was not changed.',
};

/**
 * Name an edge learning command the way its control is labelled on screen.
 *
 * @param command - The command to name.
 * @returns The label the user pressed or switched.
 */
export const describeEdgeCommand = (command: EdgeCommand): string =>
  COMMAND_LABELS[command];

/**
 * Put an edge learning command the board did not take into words, saying only
 * what is known: which command, which board, why the app gave up on it, and
 * that nothing on the board has changed as a result.
 *
 * The switch and buttons only change once the board acknowledges a command,
 * so this is also where the user learns that they still show the old state.
 *
 * @param command - The command that failed.
 * @param deviceName - What the board calls itself.
 * @param reason - Why the command failed, as the BLE layer reported it.
 * @returns Title and message for an alert.
 */
export const describeEdgeCommandFailure = (
  command: EdgeCommand,
  deviceName: string,
  reason: string,
): { title: string; message: string } => ({
  title: `No answer from ${deviceName}`,
  message:
    `The ${describeEdgeCommand(command)} command was sent, but your ` +
    `${deviceName} did not confirm it. ${reason} ${UNCHANGED_OUTCOMES[command]}`,
});
