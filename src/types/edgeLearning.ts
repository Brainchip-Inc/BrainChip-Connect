/**
 * The edge learning commands the app can write to the board, one byte each.
 *
 * The firmware treats each value as a button press on the board rather than
 * as an instruction, so what a command does depends on the state the board is
 * in: `ToggleLearningMode` moves it between inference and class selection in
 * either direction, and the other three only mean anything once it is
 * selecting or learning a class. The codes are fixed by
 * `edge_learning_cmd_process` in the AkidaTag firmware.
 */
export enum EdgeCommand {
  ToggleLearningMode = 0,
  StartLearning = 1,
  DeleteClass = 2,
  NextClass = 3,
}
