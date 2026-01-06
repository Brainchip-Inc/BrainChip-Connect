import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { colors } from './colors';

const baseTheme = {
  roundness: 0, // 🔒 NO rounded corners (critical requirement)
  colors: {
    primary: colors.brainChipBlue,
    secondary: colors.successGreen,
    error: colors.errorRed,

    background: colors.backgroundGray,
    surface: colors.white,

    onPrimary: colors.white,
    onSecondary: colors.pureBlack,
    onSurface: colors.pureBlack,
    onBackground: colors.pureBlack,

    outline: colors.borderSubtle,
  },
};

export const lightTheme = {
  ...MD3LightTheme,
  ...baseTheme,
};

export const darkTheme = {
  ...MD3DarkTheme,
  ...baseTheme, // same colors for now (as requested)
};
