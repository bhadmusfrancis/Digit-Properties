import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, View, type TextStyle, type StyleProp } from 'react-native';

type Block =
  | { type: 'p' | 'h2' | 'h3' | 'li' | 'quote'; runs: Run[] };

type Run = { text: string; bold?: boolean; italic?: boolean; href?: string };

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseRuns(inner: string): Run[] {
  const runs: Run[] = [];
  const re = /<(strong|b|em|i|a)(\s[^>]*)?>([\s\S]*?)<\/\1>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    if (m[4]) {
      const text = decodeEntities(m[4].replace(/\s+/g, ' '));
      if (text) runs.push({ text });
      continue;
    }
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const text = stripTags(m[3]);
    if (!text) continue;
    if (tag === 'a') {
      const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
      runs.push({ text, href });
    } else if (tag === 'strong' || tag === 'b') {
      runs.push({ text, bold: true });
    } else {
      runs.push({ text, italic: true });
    }
  }
  return runs.length ? runs : [{ text: stripTags(inner) || '' }];
}

function htmlToBlocks(html: string): Block[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<\/?(div|span|section|article)[^>]*>/gi, '');

  const blocks: Block[] = [];
  const re = /<(h2|h3|p|blockquote|ul|ol)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(cleaned))) {
    if (m.index > last) {
      const loose = stripTags(cleaned.slice(last, m.index));
      if (loose) blocks.push({ type: 'p', runs: [{ text: loose }] });
    }
    const tag = m[1].toLowerCase();
    const inner = m[3];
    if (tag === 'ul' || tag === 'ol') {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
      for (const item of items) {
        blocks.push({ type: 'li', runs: parseRuns(item[1]) });
      }
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'quote', runs: parseRuns(inner) });
    } else if (tag === 'h2') {
      blocks.push({ type: 'h2', runs: parseRuns(inner) });
    } else if (tag === 'h3') {
      blocks.push({ type: 'h3', runs: parseRuns(inner) });
    } else {
      const text = stripTags(inner);
      if (text) blocks.push({ type: 'p', runs: parseRuns(inner) });
    }
    last = m.index + m[0].length;
  }
  const tail = stripTags(cleaned.slice(last));
  if (tail) blocks.push({ type: 'p', runs: [{ text: tail }] });
  return blocks;
}

function Runs({ runs, baseStyle }: { runs: Run[]; baseStyle?: StyleProp<TextStyle> }) {
  return (
    <Text style={baseStyle}>
      {runs.map((r, i) => (
        <Text
          key={i}
          style={[
            r.bold && styles.bold,
            r.italic && styles.italic,
            r.href && styles.link,
          ]}
          onPress={r.href ? () => Linking.openURL(r.href!) : undefined}
        >
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

export function TrendHtmlBody({ html }: { html: string }) {
  const blocks = useMemo(() => htmlToBlocks(html || ''), [html]);

  if (!html?.trim() || blocks.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.type === 'h2') {
          return (
            <View key={i} style={[styles.h2Wrap, i === 0 && styles.firstBlock]}>
              <Runs runs={b.runs} baseStyle={styles.h2} />
            </View>
          );
        }
        if (b.type === 'h3') {
          return (
            <View key={i} style={styles.h3Wrap}>
              <Runs runs={b.runs} baseStyle={styles.h3} />
            </View>
          );
        }
        if (b.type === 'li') {
          const prev = blocks[i - 1];
          const next = blocks[i + 1];
          const first = prev?.type !== 'li';
          const last = next?.type !== 'li';
          return (
            <View
              key={i}
              style={[styles.liRow, first && styles.liFirst, last && styles.liLast]}
            >
              <Text style={styles.bullet}>•</Text>
              <View style={styles.liText}>
                <Runs runs={b.runs} baseStyle={styles.li} />
              </View>
            </View>
          );
        }
        if (b.type === 'quote') {
          return (
            <View key={i} style={styles.quote}>
              <Runs runs={b.runs} baseStyle={styles.quoteText} />
            </View>
          );
        }
        return (
          <View key={i} style={styles.pWrap}>
            <Runs runs={b.runs} baseStyle={styles.p} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  firstBlock: { marginTop: 0 },
  pWrap: { marginBottom: 14 },
  p: { fontSize: 16, lineHeight: 26, color: '#334155' },
  h2Wrap: {
    marginTop: 22,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  h2: { fontSize: 20, fontWeight: '700', color: '#0f172a', lineHeight: 28 },
  h3Wrap: { marginTop: 16, marginBottom: 8 },
  h3: { fontSize: 17, fontWeight: '600', color: '#1e293b', lineHeight: 24 },
  liRow: { flexDirection: 'row', gap: 10, paddingLeft: 2, marginBottom: 8 },
  liFirst: { marginTop: 4 },
  liLast: { marginBottom: 14 },
  bullet: { color: '#0d9488', fontSize: 16, lineHeight: 26, fontWeight: '700', width: 14 },
  liText: { flex: 1 },
  li: { fontSize: 16, lineHeight: 26, color: '#334155' },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: '#2dd4bf',
    backgroundColor: '#f0fdfa',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginVertical: 12,
  },
  quoteText: { fontSize: 16, lineHeight: 25, color: '#334155', fontStyle: 'italic' },
  bold: { fontWeight: '700', color: '#0f172a' },
  italic: { fontStyle: 'italic' },
  link: { color: '#0d9488', fontWeight: '600' },
});
