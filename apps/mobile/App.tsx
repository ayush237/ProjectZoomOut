import { trackSchema } from '@zoomout/shared';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { buildBootSummary } from './src/boot/bootSummary';

/**
 * Boot screen.
 *
 * WP0's only mobile deliverable: prove that a value whose type comes from
 * `packages/shared` renders in the app. Every real surface — Explore, Library,
 * Journey, Profile — arrives in WP6/WP7 behind a design direction that is still an
 * open question in the Phase 1 plan.
 *
 * The Track below is local, obviously-placeholder data. It is parsed through the
 * shared schema rather than cast, so the screen exercises validation as well as types.
 */
const PLACEHOLDER_TRACK = trackSchema.parse({
  id: 'track-placeholder',
  bookTitle: 'Placeholder Book Title',
  author: 'Placeholder Author',
  publisher: 'Placeholder Publisher',
  coverUrl: 'https://example.test/cover.png',
  description: 'Placeholder description. Real Tracks are authored in the CMS from WP1.',
  disclaimer:
    'Placeholder disclaimer. ZoomOut is not affiliated with or endorsed by the author or publisher.',
  purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/book' }],
  status: 'draft',
  leafCount: 20,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
});

export default function App(): React.JSX.Element {
  const summary = buildBootSummary(PLACEHOLDER_TRACK);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="auto" />

      <View style={styles.content}>
        <Text style={styles.eyebrow}>ZoomOut</Text>
        <Text style={styles.headline}>{summary.headline}</Text>
        <Text style={styles.byline}>{summary.byline}</Text>

        {summary.placeholderWarning !== null && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>{summary.placeholderWarning}</Text>
          </View>
        )}

        <Text style={styles.disclaimer}>{summary.disclaimer}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#faf9f6',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  eyebrow: {
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#8a8578',
  },
  headline: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1c1b17',
  },
  byline: {
    fontSize: 15,
    color: '#5c584d',
  },
  warning: {
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#e6cf7a',
  },
  warningText: {
    fontSize: 13,
    color: '#6b5504',
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 17,
    color: '#8a8578',
  },
});
