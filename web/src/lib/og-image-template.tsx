import type { ReactElement } from 'react';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Raster OG layout (Facebook crawlers handle PNG from ImageResponse better than SVG placeholders). */
export function OgBrandedFrame(props: {
  title: string;
  subtitle?: string;
  kicker?: string;
}): ReactElement {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 56,
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 45%, #075985 100%)',
        color: '#ffffff',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 600, opacity: 0.9, marginBottom: 14 }}>
        {props.kicker ?? 'Digit Properties'}
      </div>
      <div
        style={{
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1.12,
          letterSpacing: -0.5,
          marginBottom: props.subtitle ? 20 : 0,
        }}
      >
        {props.title}
      </div>
      {props.subtitle ? (
        <div style={{ fontSize: 32, fontWeight: 500, opacity: 0.9, lineHeight: 1.25 }}>{props.subtitle}</div>
      ) : null}
    </div>
  );
}
