import { Sliders } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useBleCommandStore } from '../../app/store/useBleCommandStore';
import { AppType } from '../../app/store/useLiveSensorStore';
import { Colors } from '../../app/theme/theme';
import {
  formatKwsValue,
  KWS_PARAMS,
  KwsParamId,
  KwsParamMeta,
  parseKwsValue,
} from '../../types/appConfig';

type InputMap = Partial<Record<KwsParamId, string>>;

const labelFor = (meta: KwsParamMeta) =>
  meta.unit ? `${meta.label} (${meta.unit})` : meta.label;

const rangeHint = (meta: KwsParamMeta) => {
  if (meta.max !== undefined) return `${meta.min}–${meta.max}`;
  return `≥ ${meta.min}`;
};

const displayValue = (meta: KwsParamMeta, live: number | undefined): string => {
  if (live === undefined) return '';
  return formatKwsValue(meta, live);
};

const AppControlsSection: React.FC<{ appType: AppType }> = ({ appType }) => {
  const theme = useTheme();
  const connectedDevice = useBleCommandStore(s => s.connectedDevice);
  const kwsConfig = useBleCommandStore(s => s.kwsConfig);
  const kwsConfigDraft = useBleCommandStore(s => s.kwsConfigDraft);
  const kwsConfigPending = useBleCommandStore(s => s.kwsConfigPending);
  const kwsConfigError = useBleCommandStore(s => s.kwsConfigError);
  const requestKwsConfig = useBleCommandStore(s => s.requestKwsConfig);
  const setKwsConfigDraft = useBleCommandStore(s => s.setKwsConfigDraft);
  const applyKwsConfigDraft = useBleCommandStore(s => s.applyKwsConfigDraft);
  const resetKwsConfig = useBleCommandStore(s => s.resetKwsConfig);

  const [inputs, setInputs] = useState<InputMap>({});
  const [localError, setLocalError] = useState<
    Partial<Record<KwsParamId, string>>
  >({});
  const [isApplying, setIsApplying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (appType !== 'keyword') return;
    if (!connectedDevice) return;
    requestKwsConfig().catch(err => {
      if (__DEV__) console.warn('requestKwsConfig failed', err);
    });
  }, [appType, connectedDevice, requestKwsConfig]);

  const draftDirty = useMemo(
    () =>
      (Object.keys(kwsConfigDraft) as unknown as KwsParamId[]).some(
        k => kwsConfigDraft[k] !== undefined,
      ),
    [kwsConfigDraft],
  );

  if (appType !== 'keyword') return null;

  const handleBlur = (meta: KwsParamMeta) => {
    const raw = inputs[meta.id];
    if (raw === undefined || raw === '') {
      // Empty → clear the draft for this field; UI falls back to live value.
      setKwsConfigDraft(meta.id, undefined);
      setLocalError(e => ({ ...e, [meta.id]: undefined }));
      return;
    }
    const parsed = parseKwsValue(meta, raw);
    if (parsed === null) {
      setLocalError(e => ({
        ...e,
        [meta.id]: `Expected ${meta.kind} in ${rangeHint(meta)}`,
      }));
      return;
    }
    setLocalError(e => ({ ...e, [meta.id]: undefined }));
    setKwsConfigDraft(meta.id, parsed);
    // Normalize the displayed text to the canonical wire form.
    setInputs(s => ({ ...s, [meta.id]: formatKwsValue(meta, parsed) }));
  };

  const handleApply = async () => {
    if (!connectedDevice) return;
    setIsApplying(true);
    try {
      const { ok, failed } = await applyKwsConfigDraft();
      if (failed.length === 0 && ok.length > 0) {
        // Silent success — the fields will update as CONFIG_SET_ACK arrives.
        setInputs({});
      } else if (failed.length > 0) {
        const lines = failed
          .map(f => {
            const meta = KWS_PARAMS.find(p => p.id === f.id);
            return `• ${meta?.label ?? f.id}: ${f.reason}`;
          })
          .join('\n');
        Alert.alert(
          'Some changes failed',
          `${ok.length} applied, ${failed.length} failed:\n${lines}`,
        );
      }
    } catch (err) {
      Alert.alert(
        'Apply Failed',
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = () => {
    if (!connectedDevice) return;
    Alert.alert(
      'Reset to defaults?',
      'All six Keyword Spotting parameters will be reset on the device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetKwsConfig();
              setInputs({});
              setLocalError({});
            } catch (err) {
              Alert.alert(
                'Reset Failed',
                err instanceof Error ? err.message : 'Unknown error',
              );
            } finally {
              setIsResetting(false);
            }
          },
        },
      ],
    );
  };

  const disabled = !connectedDevice || isApplying || isResetting;
  const applyDisabled = disabled || !draftDirty;

  return (
    <>
      <View style={styles.sectionHeader}>
        <Sliders size={20} />
        <Text style={styles.sectionTitle}>App Controls</Text>
      </View>
      <View style={styles.card}>
        {KWS_PARAMS.map(meta => {
          const pending = kwsConfigPending.has(meta.id);
          const live = kwsConfig[meta.id];
          const draft = kwsConfigDraft[meta.id];
          const focused = inputs[meta.id] !== undefined;
          const value = focused
            ? inputs[meta.id] ?? ''
            : draft !== undefined
            ? formatKwsValue(meta, draft)
            : displayValue(meta, live);
          const error = localError[meta.id] ?? kwsConfigError[meta.id];
          return (
            <View key={meta.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowLabel}>{labelFor(meta)}</Text>
                <Text style={styles.rowHint}>{rangeHint(meta)}</Text>
              </View>
              <View
                style={[styles.inputWrap, !!error && styles.inputWrapError]}
              >
                <TextInput
                  style={styles.input}
                  value={value}
                  placeholder={formatKwsValue(meta, meta.default)}
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType={
                    meta.kind === 'float' ? 'decimal-pad' : 'number-pad'
                  }
                  onChangeText={t => setInputs(s => ({ ...s, [meta.id]: t }))}
                  onBlur={() => {
                    handleBlur(meta);
                    setInputs(s => {
                      const next = { ...s };
                      delete next[meta.id];
                      return next;
                    });
                  }}
                  editable={!disabled}
                  returnKeyType="done"
                />
                {pending && (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                )}
              </View>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          );
        })}

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleApply}
            disabled={applyDisabled}
            loading={isApplying}
            style={styles.footerButton}
          >
            Apply
          </Button>
          <Button
            mode="outlined"
            onPress={handleReset}
            disabled={disabled}
            loading={isResetting}
            style={styles.footerButton}
          >
            Reset
          </Button>
        </View>

        {!connectedDevice && (
          <Text style={styles.disabledHint}>
            Connect to a device to change parameters.
          </Text>
        )}
      </View>
    </>
  );
};

export default AppControlsSection;

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    marginTop: 16,
  },
  sectionTitle: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 16,
    backgroundColor: Colors.white,
    marginBottom: 8,
  },
  row: {
    marginBottom: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  rowHint: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: Colors.text.tertiary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: 10,
    backgroundColor: Colors.white,
  },
  inputWrapError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: 'Inter',
    fontSize: 14,
    color: Colors.text.primary,
  },
  errorText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: Colors.error,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  footerButton: {
    flex: 1,
  },
  disabledHint: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 10,
    textAlign: 'center',
  },
});
