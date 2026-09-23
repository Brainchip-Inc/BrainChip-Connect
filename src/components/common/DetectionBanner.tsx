import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

/** How the two classes the human detection model scores read on screen. */
const VISION_DETECTION_WORDING: Record<string, string> = {
  person: 'Person detected',
  no_person: 'No person detected',
};

/** What the banner says for an application before its first detection. */
const NOTHING_DETECTED_YET: Record<string, string> = {
  keyword: 'No keyword detected yet',
  vision: 'No person detected yet',
};

/**
 * Put a detection label into words for the application it came from.
 *
 * @param appId - The application that reported the detection.
 * @param label - The class label the board reported.
 */
export const describeDetection = (appId: string, label: string): string => {
  if (appId === 'vision' && label in VISION_DETECTION_WORDING) {
    return VISION_DETECTION_WORDING[label];
  }
  return `"${label}" detected`;
};

/**
 * Say whether a detection label is a real result rather than the store's
 * placeholder from before the first one arrived.
 *
 * @param label - What the store holds as the latest detection.
 */
export const isDetectionLabel = (label: string | undefined): label is string =>
  label !== undefined && !label.startsWith('Waiting');

/**
 * Say how long ago a detection arrived, coarsely enough to read at a glance.
 *
 * @param receivedAt - When the report arrived.
 * @param now - The current time.
 */
export const describeAge = (receivedAt: Date, now: Date): string => {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - receivedAt.getTime()) / 1000),
  );
  if (seconds < 2) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds} s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  return `${Math.floor(minutes / 60)} h ago`;
};

/**
 * The current time, refreshed every second while something is being aged.
 *
 * @param ticking - Whether anything on screen depends on the time passing.
 */
const useNow = (ticking: boolean): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!ticking) {
      return undefined;
    }
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
};

interface DetectionBannerProps {
  appId: string;
  label: string | undefined;
  confidence: number | undefined;
  receivedAt: Date | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * The board's latest detection, with how long ago it arrived.
 *
 * A board reports a detection when something happens and says nothing in
 * between, so the same label arriving again is the news. The age is what makes
 * that visible, and what tells a reading from a minute ago apart from one that
 * just came in.
 *
 * @param appId - The application whose detection is shown.
 * @param label - The latest class label, or the store's placeholder.
 * @param confidence - The board's confidence in that label, in percent.
 * @param receivedAt - When the latest report arrived, or null before the first.
 * @param style - Layout of the banner within its parent.
 */
const DetectionBanner = ({
  appId,
  label,
  confidence,
  receivedAt,
  style,
}: DetectionBannerProps) => {
  const theme = useTheme();
  const detected = isDetectionLabel(label);
  const now = useNow(detected && receivedAt !== null);

  return (
    <View style={[styles.block, { borderColor: theme.colors.primary }, style]}>
      {detected ? (
        <>
          <View style={styles.row}>
            <Text style={[styles.value, { color: theme.colors.primary }]}>
              {describeDetection(appId, label)}
            </Text>
            <Text style={[styles.value, { color: theme.colors.secondary }]}>
              {`${(confidence ?? 0).toFixed(1)}% Confidence`}
            </Text>
          </View>
          {receivedAt !== null && (
            <Text
              style={[styles.age, { color: theme.colors.onSurfaceVariant }]}
            >
              {describeAge(receivedAt, now)}
            </Text>
          )}
        </>
      ) : (
        <Text style={[styles.value, { color: theme.colors.onSurfaceVariant }]}>
          {NOTHING_DETECTED_YET[appId] ?? 'Nothing detected yet'}
        </Text>
      )}
    </View>
  );
};

export default DetectionBanner;

const styles = StyleSheet.create({
  block: {
    padding: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(0,97,237,0.05)',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontSize: 12, fontWeight: '600' },
  age: { fontSize: 11, marginTop: 4 },
});
