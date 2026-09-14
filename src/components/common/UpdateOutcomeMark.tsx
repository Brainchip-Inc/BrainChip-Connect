import { CheckCircle, XCircle } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { Colors } from '../../app/theme/theme';
import { UpdateMark } from '../../services/firmware/firmwareUpdateAnnouncement';

interface UpdateOutcomeMarkProps {
  mark: UpdateMark;
}

const MARK_SIZE = 42;
const GROW_FROM = 0.8;
const GROW_MS = 220;

/**
 * Follow the reduce-motion accessibility setting for as long as it is needed.
 *
 * The setting can be turned on while a screen is open, and an animation that
 * started before that should not be the one thing that ignores it.
 *
 * @returns Whether the user has asked for less movement, starting false until
 *   the setting has been read.
 */
const useReduceMotion = (): boolean => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let watching = true;

    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (watching) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      watching = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
};

/**
 * Show how an update ended as a tick or a cross above the wording.
 *
 * The mark arrives after a wait long enough to have looked away from, so it
 * grows and fades in rather than appearing, which is what draws the eye back.
 * It settles without overshooting: this is a full stop on a process the user
 * did not choose the ending of, and a bounce would read as celebrating one of
 * the two endings it has to cover.
 *
 * @param mark - Which mark to show, or null to show none, which is every
 *   ending the app could not decide.
 * @returns The mark, or nothing at all when there is none to show.
 */
const UpdateOutcomeMark = ({ mark }: UpdateOutcomeMarkProps) => {
  const reduceMotion = useReduceMotion();
  const grown = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      grown.setValue(1);
      return;
    }

    Animated.timing(grown, {
      toValue: 1,
      duration: GROW_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [grown, mark, reduceMotion]);

  if (mark === null) {
    return null;
  }

  const Mark = mark === 'success' ? CheckCircle : XCircle;
  const color = mark === 'success' ? Colors.success : Colors.error;

  return (
    <Animated.View
      style={[
        styles.mark,
        {
          opacity: grown,
          transform: [
            {
              scale: grown.interpolate({
                inputRange: [0, 1],
                outputRange: [GROW_FROM, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Mark size={MARK_SIZE} color={color} />
    </Animated.View>
  );
};

export default UpdateOutcomeMark;

const styles = StyleSheet.create({
  mark: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
});
