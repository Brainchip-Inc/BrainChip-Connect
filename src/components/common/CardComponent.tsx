import React from 'react';
import { View, Dimensions } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { SvgProps, SvgXml } from 'react-native-svg';

interface CardComponentProps {
  title: string;
  subtitle: string;
  Icon: string; // Accept SVG component
}

const { width } = Dimensions.get('window');

const CardComponent: React.FC<CardComponentProps> = ({
  title,
  subtitle,
  Icon,
}) => {
  return (
    <Card style={{ marginBottom: 20, borderRadius: 12, elevation: 2 }}>
      <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* SVG Icon */}
        {Icon && <SvgXml xml={Icon} width={80} height={80} />}

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontWeight: '700',
              fontSize: width * 0.045,
              marginBottom: 4,
            }}
          >
            {title}
          </Text>
          <Text style={{ color: 'gray', fontSize: width * 0.035 }}>
            {subtitle}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
};

export default CardComponent;
