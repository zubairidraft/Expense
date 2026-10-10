import { useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { buildScheme, normalizeHex, contrastRatio, DEFAULT_APPEARANCE } from '../../lib/theme';
import Icon from '../ui/Icon';

function ColorField({ label, value, onChange, allowAuto = false, autoLabel = 'Auto' }) {
  const isAuto = allowAuto && !value;

  const commit = (v) => {
    const hex = normalizeHex(v, '');
    if (hex && hex !== value) onChange(hex);
  };

  return (
    <div className="ap-color-input">
      <input
        type="color"
        aria-label={label}
        value={normalizeHex(value || '#888888')}
        onChange={(e) => onChange(e.target.value)}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label>{label}</label>
        <input
          key={value || 'auto'}
          type="text"
          aria-label={`${label} hex code`}
          defaultValue={isAuto ? '' : value}
          placeholder={isAuto ? autoLabel : ''}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
          spellCheck={false}
        />
      </div>
      {allowAuto && value && (
        <button
          type="button"
          className="md-icon-btn"
          title="Back to automatic"
          aria-label={`Reset ${label} to automatic`}
          onClick={() => onChange('')}
          style={{ width: 28, height: 28, minWidth: 28 }}
        >
          <Icon name="restart_alt" size={18} />
        </button>
      )}
    </div>
  );
}

function Segment({ options, value, onChange, ariaLabel }) {
  return (
    <div className="ap-segment" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {value === o.value && <Icon name="check" size={18} />}
          {o.icon && value !== o.value && <Icon name={o.icon} size={18} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AppearancePanel() {
  const { appearance, updateAppearance, resetAppearance, mode, setMode, presets, fonts } = useTheme();
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState('');

  const resolvedMode =
    mode === 'system'
      ? typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode;

  const scheme = useMemo(() => buildScheme(appearance, resolvedMode), [appearance, resolvedMode]);

  const presetSchemes = useMemo(
    () => presets.map((p) => ({ ...p, scheme: buildScheme({ ...appearance, seed: p.seed, secondary: '', tertiary: '' }, resolvedMode) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presets, resolvedMode, appearance.surfaceTint]
  );

  const primaryContrast = contrastRatio(scheme['--md-primary'], scheme['--md-on-primary']);
  const textContrast = contrastRatio(scheme['--md-on-surface'], scheme['--md-surface']);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(appearance));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleImport = () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importText);
      const allowed = Object.keys(DEFAULT_APPEARANCE);
      const clean = Object.fromEntries(Object.entries(parsed).filter(([k]) => allowed.includes(k)));
      if (!Object.keys(clean).length) throw new Error('No theme settings found');
      updateAppearance(clean);
      setImportText('');
    } catch (err) {
      setImportError(err.message || 'Invalid theme code');
    }
  };

  return (
    <div className="appearance-panel">
      <div>
        {/* Mode */}
        <div className="ap-section">
          <h3><Icon name="contrast" size={20} /> Theme mode</h3>
          <Segment
            ariaLabel="Theme mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'Light', icon: 'light_mode' },
              { value: 'dark', label: 'Dark', icon: 'dark_mode' },
              { value: 'system', label: 'System', icon: 'contrast' },
            ]}
          />
        </div>

        {/* Presets */}
        <div className="ap-section">
          <h3><Icon name="palette" size={20} /> Color scheme</h3>
          <p className="ap-hint">Pick a preset or your own brand colour. The full palette (buttons, cards, charts, light &amp; dark) is generated from it.</p>
          <div className="ap-presets">
            {presetSchemes.map((p) => {
              const active = normalizeHex(appearance.seed) === normalizeHex(p.seed) && !appearance.secondary && !appearance.tertiary;
              return (
                <div key={p.id}>
                  <button
                    type="button"
                    className={`ap-swatch ${active ? 'active' : ''}`}
                    title={p.label}
                    aria-label={`${p.label} preset`}
                    aria-pressed={active}
                    onClick={() => updateAppearance({ seed: p.seed, secondary: '', tertiary: '' })}
                  >
                    <span style={{ background: p.scheme['--md-primary'] }} />
                    <span style={{ background: p.scheme['--md-tertiary'] }} />
                    <span style={{ background: p.scheme['--md-secondary-container'] }} />
                    <span style={{ background: p.scheme['--md-surface-container-high'] }} />
                  </button>
                  <div className="ap-swatch-label">{p.label}</div>
                </div>
              );
            })}
          </div>

          <div className="ap-color-row" style={{ marginTop: '0.5rem' }}>
            <ColorField label="Main colour" value={appearance.seed} onChange={(v) => v && updateAppearance({ seed: v })} />
            <ColorField label="Secondary" value={appearance.secondary} allowAuto onChange={(v) => updateAppearance({ secondary: v })} />
            <ColorField label="Accent" value={appearance.tertiary} allowAuto onChange={(v) => updateAppearance({ tertiary: v })} />
          </div>
        </div>

        {/* Money colours */}
        <div className="ap-section">
          <h3><Icon name="payments" size={20} /> Money colours</h3>
          <p className="ap-hint">Used for income / expense amounts, charts and badges.</p>
          <div className="ap-color-row">
            <ColorField label="Income" value={appearance.income} onChange={(v) => v && updateAppearance({ income: v })} />
            <ColorField label="Expense" value={appearance.expense} onChange={(v) => v && updateAppearance({ expense: v })} />
          </div>
        </div>

        {/* Surfaces */}
        <div className="ap-section">
          <h3><Icon name="format_paint" size={20} /> Background &amp; surfaces</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Tint surfaces with theme colour</div>
              <div className="ap-hint">Off = neutral grey cards and backgrounds</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appearance.surfaceTint === 'tinted'}
              className={`md-switch ${appearance.surfaceTint === 'tinted' ? 'on' : ''}`}
              onClick={() => updateAppearance({ surfaceTint: appearance.surfaceTint === 'tinted' ? 'neutral' : 'tinted' })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Soft colour glow in background</div>
              <div className="ap-hint">Subtle gradient behind the app</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appearance.background === 'gradient'}
              className={`md-switch ${appearance.background === 'gradient' ? 'on' : ''}`}
              onClick={() => updateAppearance({ background: appearance.background === 'gradient' ? 'plain' : 'gradient' })}
            />
          </div>
        </div>

        {/* Shape */}
        <div className="ap-section">
          <h3><Icon name="rounded_corner" size={20} /> Corner shape</h3>
          <Segment
            ariaLabel="Corner presets"
            value={[0, 8, 16, 28].includes(Number(appearance.radius)) ? Number(appearance.radius) : null}
            onChange={(v) => updateAppearance({ radius: v })}
            options={[
              { value: 0, label: 'Sharp' },
              { value: 8, label: 'Subtle' },
              { value: 16, label: 'Rounded' },
              { value: 28, label: 'Extra' },
            ]}
          />
          <input
            className="ap-slider"
            type="range"
            min="0"
            max="32"
            step="1"
            value={appearance.radius}
            aria-label="Corner radius"
            onChange={(e) => updateAppearance({ radius: Number(e.target.value) })}
          />
          <span className="ap-hint">{appearance.radius}px card radius</span>
        </div>

        {/* Density & type */}
        <div className="ap-section">
          <h3><Icon name="text_fields" size={20} /> Font &amp; density</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="ap-font">Font family</label>
            <select
              id="ap-font"
              className="select-field"
              value={appearance.font}
              onChange={(e) => updateAppearance({ font: e.target.value })}
            >
              {fonts.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <label className="form-label" htmlFor="ap-font-scale">Text size: {appearance.fontScale}%</label>
          <input
            id="ap-font-scale"
            className="ap-slider"
            type="range"
            min="85"
            max="125"
            step="5"
            value={appearance.fontScale}
            onChange={(e) => updateAppearance({ fontScale: Number(e.target.value) })}
          />
          <Segment
            ariaLabel="Density"
            value={appearance.density}
            onChange={(v) => updateAppearance({ density: v })}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ]}
          />
        </div>

        {/* Share */}
        <div className="ap-section">
          <h3><Icon name="upload" size={20} /> Share or restore a theme</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="md-btn-outlined" onClick={handleCopy}>
              <Icon name={copied ? 'check' : 'download'} size={18} /> {copied ? 'Copied' : 'Copy theme code'}
            </button>
            <button type="button" className="md-btn-text" onClick={resetAppearance}>
              <Icon name="restart_alt" size={18} /> Reset to default
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="input-field"
              placeholder="Paste theme code"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn-secondary" onClick={handleImport} disabled={!importText.trim()}>
              Apply
            </button>
          </div>
          {importError && <span className="ap-hint" style={{ color: 'var(--md-error)' }}>{importError}</span>}
        </div>
      </div>

      {/* Live preview */}
      <aside className="ap-preview" aria-label="Theme preview">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontWeight: 500 }}>Live preview</strong>
          <span className="ap-hint">{resolvedMode === 'dark' ? 'Dark' : 'Light'} mode</span>
        </div>

        <div className="ap-tone-strip" aria-hidden="true">
          {['--md-primary', '--md-primary-container', '--md-secondary-container', '--md-tertiary', '--md-success', '--md-error'].map((k) => (
            <span key={k} style={{ background: scheme[k] }} />
          ))}
        </div>

        <div className="stat-card balance" style={{ boxShadow: 'none' }}>
          <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Net worth</span>
            <span className="stat-icon"><Icon name="account_balance" size={22} /></span>
          </div>
          <div className="stat-value" style={{ fontSize: '1.6rem' }}>Rs 1,25,400</div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--md-success)' }}>+ Rs 85,000 income</span>
            <span style={{ color: 'var(--md-error)' }}>− Rs 32,150 spent</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="md-btn-filled"><Icon name="add" size={18} /> Add expense</button>
          <button type="button" className="md-btn-tonal">Tonal</button>
          <button type="button" className="md-btn-outlined">Outlined</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="preset-chip active" style={{ padding: '0.3rem 0.75rem' }}>Groceries</span>
          <span className="preset-chip" style={{ padding: '0.3rem 0.75rem' }}>Fuel</span>
          <span className="preset-chip" style={{ padding: '0.3rem 0.75rem' }}>Bills</span>
        </div>

        <div className="ap-roles">
          <div className="ap-role" style={{ background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}>Primary container</div>
          <div className="ap-role" style={{ background: 'var(--md-tertiary-container)', color: 'var(--md-on-tertiary-container)' }}>Accent container</div>
          <div className="ap-role" style={{ background: 'var(--md-success-container)', color: 'var(--md-on-success-container)' }}>Income</div>
          <div className="ap-role" style={{ background: 'var(--md-error-container)', color: 'var(--md-on-error-container)' }}>Expense</div>
        </div>

        <div className="ap-hint" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span className={primaryContrast >= 4.5 ? 'ap-contrast-ok' : 'ap-contrast-bad'}>
            Button text contrast {primaryContrast.toFixed(1)}:1 {primaryContrast >= 4.5 ? '✓ readable' : '— pick a different shade'}
          </span>
          <span className={textContrast >= 7 ? 'ap-contrast-ok' : 'ap-contrast-bad'}>
            Body text contrast {textContrast.toFixed(1)}:1
          </span>
        </div>
      </aside>
    </div>
  );
}
