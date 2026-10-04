import React from 'react';
import {
  Accession,
  Button,
  Field,
  Margin,
  Rule,
  ScreenHeader,
} from '../ui';
import { COPY } from '../copy';

export const DevTokensPage: React.FC = () => {
  const typeSteps = [
    { label: '0.8rem (xs)', size: 'var(--text-xs)', sample: 'Margin labels and running header', font: 'var(--font-body)' },
    { label: '1.0rem (sm / base body)', size: 'var(--text-sm)', sample: 'The register records item titles, restriction rules, and attestations.', font: 'var(--font-body)' },
    { label: '1.25rem (base)', size: 'var(--text-base)', sample: 'Heirloom access layer for digital estate succession.', font: 'var(--font-body)' },
    { label: '1.563rem (md)', size: 'var(--text-md)', sample: 'Finding Aid Section Title', font: 'var(--font-display)' },
    { label: '1.953rem (lg)', size: 'var(--text-lg)', sample: 'Archive Series Ledger', font: 'var(--font-display)' },
    { label: '2.441rem (xl)', size: 'var(--text-xl)', sample: 'Collection Accession', font: 'var(--font-display)' },
    { label: '3.052rem (2xl)', size: 'var(--text-2xl)', sample: 'Family Heritage Register', font: 'var(--font-display)' },
    { label: '3.815rem (3xl / maximum headline)', size: 'var(--text-3xl)', sample: 'Heirloom', font: 'var(--font-display)' },
  ];

  const palette = [
    { name: 'Page', token: 'var(--color-paper)', desc: 'Surface background, white' },
    { name: 'Ink', token: 'var(--color-ink)', desc: 'Primary text, borders, primary button fill' },
    { name: 'Ink secondary', token: 'var(--color-ink-secondary)', desc: 'Annotations and sublines' },
    { name: 'Rule', token: 'var(--color-rule)', desc: 'Hairline rules and table dividers' },
    { name: 'Error', token: 'var(--color-error)', desc: 'Error text and error rule only' },
  ];

  return (
    <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
      <ScreenHeader
        title={COPY.nav.devTokens}
      />

      {/* Type Scale */}
      <Margin
        margin={
          <div>
            <Accession number="TOK-01/TYPE" />
            <div style={{ marginTop: 'var(--space-1)' }}>Scale 1.25</div>
          </div>
        }
      >
        <h2>Type Scale (Ratio 1.25, Base 1rem)</h2>
        <p style={{ color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-4)' }}>
          Headlines in Gloock (-0.02em tracking). Body in Source Serif 4. Numbers and accession
          references in Azeret Mono.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {typeSteps.map((step) => (
            <div
              key={step.label}
              style={{
                borderBottom: '1px solid var(--color-rule)',
                paddingBottom: 'var(--space-3)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-secondary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {step.label}
              </div>
              <div
                style={{
                  fontFamily: step.font,
                  fontSize: step.size,
                  lineHeight: 1.2,
                  color: 'var(--color-ink)',
                }}
              >
                {step.sample}
              </div>
            </div>
          ))}
        </div>
      </Margin>

      <Rule />

      {/* Palette */}
      <Margin
        margin={
          <div>
            <Accession number="TOK-02/PALETTE" />
            <div style={{ marginTop: 'var(--space-1)' }}>Color Swatches</div>
          </div>
        }
      >
        <h2>Color Palette</h2>
        <p style={{ color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-4)' }}>
          Strict material palette: white page, ink, secondary ink, hairline rule, and error red.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {palette.map((item) => (
            <div
              key={item.name}
              style={{
                border: '1px solid var(--color-ink)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3)',
              }}
            >
              <div
                style={{
                  height: '60px',
                  backgroundColor: item.token,
                  border: '1px solid var(--color-ink)',
                  borderRadius: 'var(--radius)',
                  marginBottom: 'var(--space-2)',
                }}
              />
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                {item.name}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-secondary)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {item.token}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-secondary)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </Margin>

      <Rule />

      {/* Focus Ring & Keyboard Accessibility */}
      <Margin
        margin={
          <div>
            <Accession number="TOK-03/FOCUS" />
            <div style={{ marginTop: 'var(--space-1)' }}>Focus Visibility</div>
          </div>
        }
      >
        <h2>Focus Ring & Interactive Elements</h2>
        <p style={{ color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-4)' }}>
          Every focusable element has a 2px ink outline with 3px offset under :focus-visible.
          Tab through the elements below to verify visibility.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button variant="primary">Primary Button Focus</Button>
            <Button variant="secondary">Secondary Button Focus</Button>
            <Button variant="tertiary">Tertiary Link Focus</Button>
          </div>

          <Field
            id="test-focus-input"
            label="Interactive Input"
            accession="KEY-TAB/01"
            placeholder="Focus here with Tab key"
          />
        </div>
      </Margin>
    </div>
  );
};
