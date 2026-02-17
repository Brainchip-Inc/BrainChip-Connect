// theme.js
import { MD3LightTheme } from 'react-native-paper';
import { MD3Theme, ThemeProp } from 'react-native-paper/lib/typescript/types';

type CustomTheme = MD3Theme & {
  colors: MD3Theme['colors'] & {
    success: string;
    warning: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
  };
};

export const BrainChipTheme: CustomTheme = {
  ...MD3LightTheme,
  // Disable rounded corners globally
  roundness: 0,

  colors: {
    ...MD3LightTheme.colors,
    // Primary Colors
    primary: '#0061ED', // BrainChip Blue
    primaryContainer: '#0061ED',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#FFFFFF',

    // Secondary Colors (using Success Green)
    secondary: '#0BD6A5', // Success Green
    secondaryContainer: '#0BD6A5',
    onSecondary: '#000000',
    onSecondaryContainer: '#000000',

    // Tertiary Colors (using Warning Orange)
    tertiary: '#FFC524', // Warning Orange
    tertiaryContainer: '#FFC524',
    onTertiary: '#000000',
    onTertiaryContainer: '#000000',

    // Error Colors
    error: '#FF004E', // Error Red
    errorContainer: '#FF004E',
    onError: '#FFFFFF',
    onErrorContainer: '#FFFFFF',

    // Background Colors
    background: '#F8F8F9', // Background Gray
    onBackground: '#000000', // Pure Black

    // Surface Colors
    surface: '#FFFFFF', // White for cards/clickable elements
    surfaceVariant: '#F8F8F9',
    onSurface: '#000000',
    onSurfaceVariant: '#000000',

    // Outline Colors
    outline: 'rgba(0, 0, 0, 0.1)', // Subtle stroke borders
    outlineVariant: 'rgba(0, 0, 0, 0.05)',

    // Other Colors
    surfaceDisabled: 'rgba(0, 0, 0, 0.12)',
    onSurfaceDisabled: 'rgba(0, 0, 0, 0.38)',
    backdrop: 'rgba(0, 0, 0, 0.4)',

    // Custom Colors for Design System
    success: '#0BD6A5',
    warning: '#FFC524',
    textPrimary: '#000000',
    textSecondary: 'rgba(0, 0, 0, 0.7)',
    textTertiary: 'rgba(0, 0, 0, 0.6)',
  },

  fonts: {
    ...MD3LightTheme.fonts,
    // Headings using Sora
    displayLarge: {
      fontFamily: 'Sora-Bold',
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 31.2, // 24 * 1.3
      letterSpacing: -0.48, // -0.02em
    },
    displayMedium: {
      fontFamily: 'Sora-SemiBold',
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 26, // 20 * 1.3
      letterSpacing: -0.2, // -0.01em
    },
    displaySmall: {
      fontFamily: 'Sora-SemiBold',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20.8, // 16 * 1.3
      letterSpacing: 0,
    },

    // H1 - Page Titles
    headlineLarge: {
      fontFamily: 'Sora-Bold',
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 31.2,
      letterSpacing: -0.48,
    },
    // H2 - Section Headers
    headlineMedium: {
      fontFamily: 'Sora-SemiBold',
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 26,
      letterSpacing: -0.2,
    },
    // H3 - Subsection Headers
    headlineSmall: {
      fontFamily: 'Sora-SemiBold',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20.8,
      letterSpacing: 0,
    },

    // H4 - Card Titles, Labels
    titleLarge: {
      fontFamily: 'Sora-SemiBold',
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18.2,
      letterSpacing: 0,
    },
    titleMedium: {
      fontFamily: 'Sora-SemiBold',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18.2,
      letterSpacing: 0,
    },
    titleSmall: {
      fontFamily: 'Sora-SemiBold',
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18.2,
      letterSpacing: 0,
    },

    // Body Text using Inter
    // Body Large - Featured Text
    bodyLarge: {
      fontFamily: 'Inter-Medium',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 22.4, // 14 * 1.6
      letterSpacing: 0,
    },
    // Body Default - Paragraphs
    bodyMedium: {
      fontFamily: 'Inter-Regular',
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 20.8, // 13 * 1.6
      letterSpacing: 0,
    },
    // Body Small - Secondary Info
    bodySmall: {
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 18, // 12 * 1.5
      letterSpacing: 0,
    },

    // Labels
    labelLarge: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      letterSpacing: 0,
    },
    labelMedium: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      letterSpacing: 0,
    },
    labelSmall: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      fontWeight: '400',
      lineHeight: 16.5, // 11 * 1.5
      letterSpacing: 0,
    },
  },
};

// Typography Presets for easy usage
export const Typography = {
  // Headings
  h1: {
    fontFamily: 'Sora-Bold',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31.2,
    letterSpacing: -0.48,
    color: '#000000',
  },
  h2: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.2,
    color: '#000000',
  },
  h3: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20.8,
    letterSpacing: 0,
    color: '#000000',
  },
  h4: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18.2,
    letterSpacing: 0,
    color: '#000000',
  },

  // Body Text
  bodyLarge: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22.4,
    color: '#000000',
  },
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20.8,
    color: '#000000',
  },
  bodySmall: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#000000',
  },
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16.5,
    color: '#000000',
  },

  // Button Labels
  buttonLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
};

// Color Palette Export
export const Colors = {
  primary: '#0061ED',
  success: '#0BD6A5',
  warning: '#FFC524',
  error: '#FF004E',
  background: '#F8F8F9',
  black: '#000000',
  white: '#FFFFFF',
  lightWhite: '#FDEDED',
  verylightWhite: '#FFF5F5',
  lightGrey: '#555555',

  // Text with opacity variations
  text: {
    primary: '#000000',
    secondary: 'rgba(0, 0, 0, 0.7)',
    tertiary: 'rgba(0, 0, 0, 0.6)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },

  // Borders
  border: {
    light: '#E5E7EB',
    default: '#E5E7EB',
    dark: 'rgba(0, 0, 0, 0.2)',
  },
};

// Component Styles
export const ComponentStyles = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },

  cardNonClickable: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },

  button: {
    borderRadius: 0,
  },

  input: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },

  statusIndicator: {
    active: {
      backgroundColor: '#0BD6A5',
    },
    warning: {
      backgroundColor: '#FFC524',
    },
    error: {
      backgroundColor: '#FF004E',
    },
  },
};

export default BrainChipTheme;
