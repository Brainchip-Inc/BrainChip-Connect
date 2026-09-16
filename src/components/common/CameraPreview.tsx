import { Camera } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { Colors } from '../../app/theme/theme';
import { CameraPreviewFrame } from '../../types/cameraPreview';

interface CameraPreviewProps {
  /** The newest whole frame, or null when none has arrived. */
  frame: CameraPreviewFrame | null;
  /** Whether the user has asked the board for the preview. */
  streaming: boolean;
  /** What the board calls itself, for the wording while waiting. */
  deviceName: string;
  /** Room the frame may take up, in screen points. */
  maxWidth: number;
}

/** The most screen points one camera pixel is ever given. */
export const PREVIEW_MAX_SCALE = 3;

/**
 * Pick how many screen points each camera pixel gets.
 *
 * The frame is what the model was given, so it is shown at a whole-number
 * multiple of its own size rather than stretched to the card: a 96 pixel
 * image blown up to fill the width would pretend to a detail it has not got.
 *
 * @param frameWidth - Width of the frame in camera pixels.
 * @param maxWidth - Room available, in screen points.
 * @returns The largest whole-number scale that fits, from one up to the cap.
 */
export const previewScale = (frameWidth: number, maxWidth: number): number =>
  Math.min(PREVIEW_MAX_SCALE, Math.max(1, Math.floor(maxWidth / frameWidth)));

/**
 * How long the preview may wait for a first frame before saying that the
 * board may not be sending one at all.
 */
export const FIRST_FRAME_PATIENCE_MS = 5000;

/** Wording of the three states the preview can be in. */
export const PREVIEW_COPY = {
  idle: 'Start streaming to see what the camera sees.',
  waiting: (deviceName: string) =>
    `Waiting for the first frame from your ${deviceName}…`,
  stillWaiting:
    'Nothing has arrived yet. The firmware on this board may not send a preview.',
  caption: (frame: CameraPreviewFrame) =>
    `${frame.width} × ${frame.height} grayscale, as the model sees it. ` +
    'Frames are skipped so detection keeps its pace.',
};

/**
 * Keep the frame shown before the current one.
 *
 * A new image source takes a moment to decode, and on Android the component
 * shows nothing until it has, so the previous frame stays underneath and is
 * what shows through in that moment instead of a blank.
 *
 * @param frame - The frame to show now.
 * @returns The frame that was shown before it, or null.
 */
const usePreviousFrame = (
  frame: CameraPreviewFrame | null,
): CameraPreviewFrame | null => {
  const [shown, setShown] = useState<{
    current: CameraPreviewFrame | null;
    previous: CameraPreviewFrame | null;
  }>({ current: frame, previous: null });

  if (shown.current !== frame) {
    setShown({ current: frame, previous: shown.current });
  }
  return frame === null ? null : shown.previous;
};

/**
 * Say whether the wait for a first frame has gone on long enough to remark on.
 *
 * @param waiting - True while streaming without a frame.
 */
const useLongWait = (waiting: boolean): boolean => {
  const [longWait, setLongWait] = useState(false);

  useEffect(() => {
    if (!waiting) {
      setLongWait(false);
      return;
    }
    const timer = setTimeout(() => setLongWait(true), FIRST_FRAME_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  return longWait;
};

/**
 * The live camera preview, or what stands in for it.
 *
 * Before streaming it says how to start. While streaming and waiting for the
 * first frame it says so, and after a while adds that the board may not be
 * sending one. Once frames arrive it shows the newest, at a whole-number
 * scale, with a caption saying what it is and that gaps are expected.
 */
const CameraPreview = ({
  frame,
  streaming,
  deviceName,
  maxWidth,
}: CameraPreviewProps) => {
  const previous = usePreviousFrame(frame);
  const longWait = useLongWait(streaming && frame === null);

  if (!streaming) {
    return (
      <View style={styles.placeholder}>
        <Camera size={40} color={Colors.primary} />
        <Text style={styles.placeholderText}>{PREVIEW_COPY.idle}</Text>
      </View>
    );
  }

  if (frame === null) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.placeholderText}>
          {PREVIEW_COPY.waiting(deviceName)}
        </Text>
        {longWait && (
          <Text style={styles.placeholderText}>
            {PREVIEW_COPY.stillWaiting}
          </Text>
        )}
      </View>
    );
  }

  const scale = previewScale(frame.width, maxWidth);
  const size = { width: frame.width * scale, height: frame.height * scale };

  return (
    <View style={styles.live}>
      <View style={[styles.frame, size]}>
        {previous && (
          <Image
            source={{ uri: previous.uri }}
            style={[styles.image, size]}
            resizeMode="contain"
            fadeDuration={0}
          />
        )}
        <Image
          source={{ uri: frame.uri }}
          style={[styles.image, size]}
          resizeMode="contain"
          fadeDuration={0}
          testID="camera-preview-frame"
        />
      </View>
      <Text style={styles.caption}>{PREVIEW_COPY.caption(frame)}</Text>
    </View>
  );
};

export default CameraPreview;

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  placeholderText: {
    fontFamily: 'Inter',
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'center',
  },
  live: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  frame: {
    backgroundColor: Colors.black,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  caption: {
    fontFamily: 'Inter',
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 10,
  },
});
