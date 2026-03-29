import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Colors } from '../../app/theme/theme';

export const PrivacySectionCard = ({ title, children }: any) => {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: Colors.border.light,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text
        variant="titleMedium"
        style={{ fontWeight: '700', marginBottom: 8 }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
};
