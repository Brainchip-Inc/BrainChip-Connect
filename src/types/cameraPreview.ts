/** One camera preview image, encoded so the `Image` component can show it. */
export interface CameraPreviewFrame {
  /** A `data:` URI holding the frame as a PNG. */
  uri: string;
  /** Native size of the frame in pixels, which is what the model was given. */
  width: number;
  height: number;
  /** The board's own sequence number for the frame. */
  sequence: number;
}
