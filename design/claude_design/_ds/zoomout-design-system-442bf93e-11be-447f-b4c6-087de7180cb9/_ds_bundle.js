/* @ds-bundle: {"format":4,"namespace":"ZoomOutDesignSystem_442bf9","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"FeedbackNote","sourcePath":"components/feedback/FeedbackNote.jsx"},{"name":"LockedPanel","sourcePath":"components/feedback/LockedPanel.jsx"},{"name":"ProgressBar","sourcePath":"components/feedback/ProgressBar.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"OptionButton","sourcePath":"components/forms/OptionButton.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"TrackGraph","sourcePath":"components/graph/TrackGraph.jsx"},{"name":"SlideFrame","sourcePath":"components/lesson/SlideFrame.jsx"},{"name":"StickyNote","sourcePath":"components/lesson/StickyNote.jsx"},{"name":"TrackCard","sourcePath":"components/lesson/TrackCard.jsx"},{"name":"SlideProgress","sourcePath":"components/navigation/SlideProgress.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"},{"name":"StreakBadge","sourcePath":"components/rewards/StreakBadge.jsx"},{"name":"XpChip","sourcePath":"components/rewards/XpChip.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"c8a4639cb9b1","components/core/Button.jsx":"00bc05c40b4a","components/core/Card.jsx":"6b8dd2008b84","components/core/Icon.jsx":"0b8bbeb4ce24","components/core/IconButton.jsx":"041ad883d30e","components/feedback/FeedbackNote.jsx":"ef2eb2c3183a","components/feedback/LockedPanel.jsx":"5b767eb93ce5","components/feedback/ProgressBar.jsx":"443c491932e3","components/forms/Input.jsx":"30931ba75cca","components/forms/OptionButton.jsx":"cf796f0e97d1","components/forms/Switch.jsx":"b1387304a652","components/graph/TrackGraph.jsx":"73824ab9bdfa","components/lesson/SlideFrame.jsx":"d06992673a46","components/lesson/StickyNote.jsx":"dbfa9d7474f2","components/lesson/TrackCard.jsx":"2b4c3cc2b390","components/navigation/SlideProgress.jsx":"27482d8e2c45","components/navigation/TabBar.jsx":"4697c6e7d217","components/navigation/TopBar.jsx":"7ada5ff04901","components/rewards/StreakBadge.jsx":"dcd3fa6dba11","components/rewards/XpChip.jsx":"515ea8509af7","ui_kits/mobile/App.jsx":"a65591a6e349","ui_kits/mobile/ExploreScreen.jsx":"8a15990f50c6","ui_kits/mobile/LeafScreen.jsx":"317c25a6c69a","ui_kits/mobile/TodayScreen.jsx":"449293aa9ece","ui_kits/mobile/TrackScreen.jsx":"70dde6c715e8","ui_kits/mobile/YouScreen.jsx":"cf8cdfac76e7","ui_kits/mobile/data.js":"78794c6afaaf"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ZoomOutDesignSystem_442bf9 = window.ZoomOutDesignSystem_442bf9 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Card.jsx
try { (() => {
const LEVELS = {
  card: 'var(--surface-card)',
  raised: 'var(--surface-raised)',
  page: 'var(--surface-page)'
};

/**
 * Depth comes from surface lightness plus a hairline border — never a shadow.
 * Shadows are invisible on the dark default theme and are not used anywhere.
 */
function Card({
  children,
  elevation = 'card',
  padding = 'var(--space-lg)',
  radius = 'var(--radius-lg)',
  interactive = false,
  bordered = true,
  onClick,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const bg = pressed && interactive ? 'var(--surface-pressed)' : LEVELS[elevation] || LEVELS.card;
  return /*#__PURE__*/React.createElement("div", {
    role: interactive ? 'button' : undefined,
    tabIndex: interactive ? 0 : undefined,
    onClick: onClick,
    onMouseLeave: () => setPressed(false),
    onMouseDown: () => interactive && setPressed(true),
    onMouseUp: () => setPressed(false),
    style: {
      background: bg,
      border: bordered ? '1px solid var(--border-hairline)' : '1px solid transparent',
      borderRadius: radius,
      padding,
      cursor: interactive ? 'pointer' : undefined,
      transform: pressed && interactive ? 'scale(0.99)' : 'scale(1)',
      transition: 'background var(--duration-tap) var(--ease-snappy), transform var(--duration-tap) var(--ease-snappy)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
const PASCAL = name => name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
function lucideNodes(name) {
  const L = typeof window !== 'undefined' ? window.lucide : null;
  if (!L) return null;
  const key = PASCAL(name);
  const set = L.icons || L;
  return set[key] || null;
}

/**
 * Every icon in ZoomOut is a stroke-based 24px-grid Lucide glyph at one consistent
 * weight. Never emoji, never a filled icon set, never a second stroke weight.
 * Requires the Lucide UMD build on the page (see prompt.md).
 */
function Icon({
  name,
  size = 24,
  strokeWidth = 2,
  color = 'currentColor',
  label,
  style,
  className
}) {
  const [, retry] = React.useState(0);
  const nodes = lucideNodes(name);
  React.useEffect(() => {
    if (nodes) return undefined;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (lucideNodes(name) || tries > 40) {
        clearInterval(id);
        retry(n => n + 1);
      }
    }, 50);
    return () => clearInterval(id);
  }, [name, nodes]);
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    style: {
      flex: '0 0 auto',
      ...style
    },
    'aria-hidden': label ? undefined : true,
    role: label ? 'img' : undefined,
    'aria-label': label
  };
  if (!nodes) return /*#__PURE__*/React.createElement("svg", shared);
  return /*#__PURE__*/React.createElement("svg", shared, nodes.map(([tag, attrs], i) => React.createElement(tag, {
    key: i,
    ...attrs
  })));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const TONES = {
  neutral: {
    bg: 'var(--surface-raised)',
    fg: 'var(--text-secondary)',
    border: 'var(--border-hairline)'
  },
  primary: {
    bg: 'var(--surface-raised)',
    fg: 'var(--primary)',
    border: 'var(--primary)'
  },
  reward: {
    bg: 'var(--reward)',
    fg: 'var(--text-on-reward)',
    border: 'transparent'
  },
  correct: {
    bg: 'var(--surface-raised)',
    fg: 'var(--correct)',
    border: 'var(--correct)'
  },
  incorrect: {
    bg: 'var(--surface-raised)',
    fg: 'var(--incorrect)',
    border: 'var(--incorrect)'
  }
};

/** Small pill label. `reward` tone is for XP/streak/achievement moments only. */
function Badge({
  children,
  tone = 'neutral',
  icon,
  style
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-xs)',
      padding: '4px 10px',
      borderRadius: 'var(--radius-full)',
      background: t.bg,
      color: t.fg,
      border: '1px solid ' + t.border,
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-caption-size)',
      lineHeight: 'var(--text-caption-leading)',
      letterSpacing: 'var(--text-caption-tracking)',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const SIZES = {
  sm: {
    height: 44,
    padding: '0 18px',
    font: 'var(--text-small-size)',
    icon: 18
  },
  md: {
    height: 52,
    padding: '0 24px',
    font: 'var(--text-body-size)',
    icon: 20
  },
  lg: {
    height: 56,
    padding: '0 28px',
    font: 'var(--text-h3-size)',
    icon: 22
  }
};
function surfaces(variant, state) {
  if (variant === 'primary') {
    return {
      background: state === 'press' ? 'var(--primary-press)' : state === 'hover' ? 'var(--primary-hover)' : 'var(--primary)',
      color: 'var(--text-on-primary)',
      border: '1px solid transparent'
    };
  }
  if (variant === 'secondary') {
    return {
      background: state === 'press' ? 'var(--surface-pressed)' : state === 'hover' ? 'var(--surface-pressed)' : 'var(--surface-raised)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-hairline)'
    };
  }
  return {
    background: state === 'press' ? 'var(--surface-raised)' : 'transparent',
    color: 'var(--text-link)',
    border: '1px solid transparent'
  };
}

/** Fully rounded pill button. Teal is the interface — amber is never a button. */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  fullWidth = false,
  type = 'button',
  onClick,
  style
}) {
  const [state, setState] = React.useState('rest');
  const s = SIZES[size] || SIZES.md;
  const skin = surfaces(variant, disabled ? 'rest' : state);
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setState('hover'),
    onMouseLeave: () => setState('rest'),
    onMouseDown: () => setState('press'),
    onMouseUp: () => setState('hover'),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-sm)',
      minHeight: s.height,
      minWidth: 'var(--touch-target-min)',
      width: fullWidth ? '100%' : undefined,
      padding: s.padding,
      borderRadius: 'var(--radius-full)',
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: s.font,
      lineHeight: 1.2,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transform: state === 'press' && !disabled ? 'scale(0.97)' : 'scale(1)',
      transition: 'background var(--duration-tap) var(--ease-snappy), transform var(--duration-tap) var(--ease-snappy), color var(--duration-tap) var(--ease-snappy)',
      ...skin,
      ...style
    }
  }, icon && iconPosition === 'left' && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.icon
  }), /*#__PURE__*/React.createElement("span", null, children), icon && iconPosition === 'right' && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.icon
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
/** Square tappable icon control, never smaller than the 44px minimum target. */
function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 44,
  iconSize = 24,
  disabled = false,
  onClick,
  style
}) {
  const [state, setState] = React.useState('rest');
  const pressed = state === 'press' && !disabled;
  const bg = variant === 'secondary' ? pressed ? 'var(--surface-pressed)' : 'var(--surface-raised)' : pressed ? 'var(--surface-raised)' : 'transparent';
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseLeave: () => setState('rest'),
    onMouseDown: () => setState('press'),
    onMouseUp: () => setState('rest'),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: Math.max(size, 44),
      height: Math.max(size, 44),
      borderRadius: 'var(--radius-full)',
      background: bg,
      border: variant === 'secondary' ? '1px solid var(--border-hairline)' : '1px solid transparent',
      color: 'var(--text-body)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transform: pressed ? 'scale(0.94)' : 'scale(1)',
      transition: 'background var(--duration-tap) var(--ease-snappy), transform var(--duration-tap) var(--ease-snappy)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/FeedbackNote.jsx
try { (() => {
const KINDS = {
  correct: {
    color: 'var(--correct)',
    icon: 'check',
    title: 'Correct'
  },
  incorrect: {
    color: 'var(--incorrect)',
    icon: 'x',
    title: 'Not quite'
  },
  info: {
    color: 'var(--primary)',
    icon: 'circle-alert',
    title: ''
  }
};

/**
 * Answer feedback. Colour is never the only signal: the icon and the entry motion
 * carry the same information, because correct green and primary teal are adjacent in hue.
 */
function FeedbackNote({
  kind = 'info',
  title,
  children,
  style
}) {
  const k = KINDS[kind] || KINDS.info;
  const animation = kind === 'incorrect' ? 'zo-shake var(--duration-transition) var(--ease-standard)' : 'zo-unlock-rise var(--duration-transition) var(--ease-reward)';
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      gap: 'var(--space-md)',
      padding: 'var(--space-lg)',
      background: 'var(--surface-raised)',
      border: '1px solid ' + k.color,
      borderRadius: 'var(--radius-md)',
      animation,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-full)',
      border: '1px solid ' + k.color
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: k.icon,
    size: 16,
    color: k.color
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-xs)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: 'var(--text-h3-size)',
      color: k.color
    }
  }, title || k.title), children && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-small-size)',
      lineHeight: 'var(--text-small-leading)',
      color: 'var(--text-body)'
    }
  }, children)));
}
Object.assign(__ds_scope, { FeedbackNote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/FeedbackNote.jsx", error: String((e && e.message) || e) }); }

// components/feedback/LockedPanel.jsx
try { (() => {
/**
 * The Payoff gate. The Payoff slide stays locked until the reader answers the Scenario
 * question correctly — active recall is the product thesis, not decoration.
 */
function LockedPanel({
  unlocked = false,
  title = 'Payoff locked',
  hint = 'Answer the scenario to unlock',
  children,
  style
}) {
  if (unlocked) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        animation: 'zo-unlock-rise var(--duration-transition) var(--ease-reward)',
        ...style
      }
    }, children);
  }
  return /*#__PURE__*/React.createElement("div", {
    "aria-live": "polite",
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-md)',
      padding: 'var(--space-xxl) var(--space-xl)',
      background: 'var(--surface-raised)',
      border: '1px dashed var(--border-hairline)',
      borderRadius: 'var(--radius-lg)',
      textAlign: 'center',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 48,
      height: 48,
      borderRadius: 'var(--radius-full)',
      background: 'var(--surface-pressed)',
      border: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "lock",
    size: 22,
    color: "var(--text-secondary)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: 'var(--text-h3-size)',
      color: 'var(--text-body)'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-small-size)',
      lineHeight: 'var(--text-small-leading)',
      color: 'var(--text-secondary)',
      maxWidth: '30ch'
    }
  }, hint));
}
Object.assign(__ds_scope, { LockedPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/LockedPanel.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressBar.jsx
try { (() => {
/** Track/track-completion progress. `reward` tone only for XP and streak progress. */
function ProgressBar({
  value = 0,
  tone = 'primary',
  label,
  valueLabel,
  height = 8,
  style
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = tone === 'reward' ? 'var(--reward)' : 'var(--primary)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)',
      ...style
    }
  }, (label || valueLabel) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 'var(--space-sm)',
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-caption-size)',
      letterSpacing: 'var(--text-caption-tracking)',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)'
    }
  }, label && /*#__PURE__*/React.createElement("span", null, label), valueLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      color: tone === 'reward' ? 'var(--reward)' : 'var(--text-body)'
    }
  }, valueLabel)), /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": Math.round(pct),
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    style: {
      height,
      borderRadius: 'var(--radius-full)',
      background: 'var(--surface-raised)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: pct + '%',
      height: '100%',
      borderRadius: 'var(--radius-full)',
      background: fill,
      transition: 'width var(--duration-transition) var(--ease-standard)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
/** Text field. Inputs sit on the raised surface with a hairline and an 8px radius. */
function Input({
  label,
  value,
  placeholder,
  helper,
  error,
  icon,
  type = 'text',
  disabled = false,
  onChange,
  style
}) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = error ? 'var(--incorrect)' : focused ? 'var(--primary)' : 'var(--border-hairline)';
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-caption-size)',
      lineHeight: 'var(--text-caption-leading)',
      letterSpacing: 'var(--text-caption-tracking)',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      minHeight: 'var(--touch-target-min)',
      padding: '0 var(--space-md)',
      background: 'var(--surface-input)',
      border: (focused || error ? 'var(--border-width-focus)' : 'var(--border-width-hairline)') + ' solid ' + borderColor,
      borderRadius: 'var(--radius-sm)',
      opacity: disabled ? 0.45 : 1,
      transition: 'border-color var(--duration-tap) var(--ease-snappy)'
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onChange: e => onChange && onChange(e.target.value),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--text-body)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-body-size)',
      lineHeight: 'var(--text-body-leading)',
      padding: 'var(--space-sm) 0'
    }
  })), (error || helper) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-xs)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-small-size)',
      lineHeight: 'var(--text-small-leading)',
      color: error ? 'var(--incorrect)' : 'var(--text-secondary)'
    }
  }, error && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "circle-alert",
    size: 14
  }), error || helper));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/OptionButton.jsx
try { (() => {
const LETTERS = ['A', 'B', 'C', 'D'];
function skin(state) {
  if (state === 'correct') return {
    bg: 'var(--surface-raised)',
    border: 'var(--correct)',
    fg: 'var(--text-body)',
    accent: 'var(--correct)',
    icon: 'check'
  };
  if (state === 'incorrect') return {
    bg: 'var(--surface-raised)',
    border: 'var(--incorrect)',
    fg: 'var(--text-body)',
    accent: 'var(--incorrect)',
    icon: 'x'
  };
  if (state === 'selected') return {
    bg: 'var(--surface-raised)',
    border: 'var(--primary)',
    fg: 'var(--text-body)',
    accent: 'var(--primary)',
    icon: null
  };
  return {
    bg: 'var(--surface-raised)',
    border: 'var(--border-hairline)',
    fg: 'var(--text-body)',
    accent: 'var(--text-secondary)',
    icon: null
  };
}

/**
 * One answer in the Scenario slide's three-option question. Active recall is the
 * product thesis, so this control is load-bearing: correct/incorrect always carry an
 * icon and a motion cue in addition to colour.
 */
function OptionButton({
  children,
  index = 0,
  state = 'default',
  disabled = false,
  onClick,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const s = skin(state);
  const animation = state === 'correct' ? 'zo-reward-pop var(--duration-transition) var(--ease-reward)' : state === 'incorrect' ? 'zo-shake var(--duration-transition) var(--ease-standard)' : undefined;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onMouseLeave: () => setPressed(false),
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    "aria-pressed": state === 'selected',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-md)',
      width: '100%',
      minHeight: 60,
      padding: 'var(--space-md) var(--space-lg)',
      textAlign: 'left',
      background: pressed && !disabled ? 'var(--surface-pressed)' : s.bg,
      border: (state === 'default' ? 'var(--border-width-hairline)' : 'var(--border-width-focus)') + ' solid ' + s.border,
      borderRadius: 'var(--radius-md)',
      color: s.fg,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled && state === 'default' ? 0.5 : 1,
      transition: 'background var(--duration-tap) var(--ease-snappy), border-color var(--duration-tap) var(--ease-snappy)',
      animation,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-full)',
      border: '1px solid ' + s.accent,
      color: s.accent,
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: 'var(--text-small-size)'
    }
  }, s.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: s.icon,
    size: 16,
    color: s.accent
  }) : LETTERS[index] || '?'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-body-size)',
      lineHeight: 1.45
    }
  }, children));
}
Object.assign(__ds_scope, { OptionButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/OptionButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/** Settings toggle. The track is teal when on — reward amber is never a control. */
function Switch({
  checked = false,
  label,
  description,
  disabled = false,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-lg)',
      minHeight: 'var(--touch-target-min)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      ...style
    }
  }, (label || description) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flex: 1
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-h3-size)',
      color: 'var(--text-body)'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-small-size)',
      lineHeight: 'var(--text-small-leading)',
      color: 'var(--text-secondary)'
    }
  }, description)), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'relative',
      width: 52,
      height: 32,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-full)',
      background: checked ? 'var(--primary)' : 'var(--surface-raised)',
      border: '1px solid ' + (checked ? 'var(--primary)' : 'var(--border-hairline)'),
      transition: 'background var(--duration-tap) var(--ease-snappy)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? 24 : 3,
      width: 24,
      height: 24,
      borderRadius: 'var(--radius-full)',
      background: checked ? 'var(--on-primary)' : 'var(--text-secondary)',
      transition: 'left var(--duration-tap) var(--ease-snappy)'
    }
  })));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/graph/TrackGraph.jsx
try { (() => {
/* Deterministic pseudo-random so the ambient web never reshuffles between renders. */
function prng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
function pathPoints(count, orientation, w, h) {
  const pad = 28;
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    if (orientation === 'vertical') {
      pts.push({
        x: w / 2 + Math.sin(i * 0.95) * (w * 0.22),
        y: pad + t * (h - pad * 2)
      });
    } else {
      pts.push({
        x: pad + t * (w - pad * 2),
        y: h / 2 + Math.sin(i * 0.95) * (h * 0.22)
      });
    }
  }
  return pts;
}

/**
 * The knowledge graph: a book is a path of connected nodes through a wider web of
 * ideas not yet reached. Fine edges, precise nodes, depth from density rather than mass.
 *
 * The metaphor owns exactly one thing — progress through a book. It is never extended
 * to XP, streaks or anything else.
 */
function TrackGraph({
  nodes = [],
  orientation = 'horizontal',
  width = 320,
  height = 160,
  ambientDensity = 14,
  showCurrentLabel = true,
  onSelectNode,
  style
}) {
  const pts = pathPoints(nodes.length, orientation, width, height);
  const rand = prng(nodes.length * 977 + 13);
  const ambient = React.useMemo(() => {
    const list = [];
    for (let i = 0; i < ambientDensity; i += 1) {
      list.push({
        x: 10 + rand() * (width - 20),
        y: 10 + rand() * (height - 20),
        r: 1.2 + rand() * 1.4
      });
    }
    return list;
  }, [ambientDensity, width, height, nodes.length]);
  const currentIndex = nodes.findIndex(n => n.state === 'current');
  const current = currentIndex >= 0 ? nodes[currentIndex] : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: '0 0 ' + width + ' ' + height,
    width: "100%",
    height: height,
    role: "img",
    "aria-label": 'Track progress: ' + nodes.filter(n => n.state === 'done').length + ' of ' + nodes.length + ' leaves complete'
  }, ambient.map((a, i) => {
    const anchor = pts[i % Math.max(pts.length, 1)] || {
      x: width / 2,
      y: height / 2
    };
    return /*#__PURE__*/React.createElement("line", {
      key: 'ae' + i,
      x1: a.x,
      y1: a.y,
      x2: anchor.x,
      y2: anchor.y,
      stroke: "var(--graph-edge)",
      strokeWidth: "1",
      opacity: "0.5"
    });
  }), ambient.map((a, i) => /*#__PURE__*/React.createElement("circle", {
    key: 'an' + i,
    cx: a.x,
    cy: a.y,
    r: a.r,
    fill: "var(--graph-node-unreached)"
  })), pts.slice(1).map((p, i) => {
    const a = pts[i];
    const reached = nodes[i + 1] && nodes[i + 1].state !== 'locked';
    return /*#__PURE__*/React.createElement("line", {
      key: 'pe' + i,
      x1: a.x,
      y1: a.y,
      x2: p.x,
      y2: p.y,
      stroke: reached ? 'var(--graph-edge-reached)' : 'var(--graph-edge)',
      strokeWidth: reached ? 1.75 : 1.25
    });
  }), pts.map((p, i) => {
    const node = nodes[i] || {};
    const done = node.state === 'done';
    const isCurrent = node.state === 'current';
    return /*#__PURE__*/React.createElement("g", {
      key: node.id || i,
      onClick: () => onSelectNode && onSelectNode(node.id, i),
      style: {
        cursor: onSelectNode ? 'pointer' : undefined
      }
    }, /*#__PURE__*/React.createElement("circle", {
      cx: p.x,
      cy: p.y,
      r: "22",
      fill: "transparent"
    }), isCurrent && /*#__PURE__*/React.createElement("circle", {
      cx: p.x,
      cy: p.y,
      r: "9",
      fill: "none",
      stroke: "var(--primary)",
      strokeWidth: "1.75"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: p.x,
      cy: p.y,
      r: isCurrent ? 4.5 : 5,
      fill: done || isCurrent ? 'var(--primary)' : 'var(--surface-raised)',
      stroke: done || isCurrent ? 'var(--primary)' : 'var(--border-hairline)',
      strokeWidth: "1.25"
    }));
  })), showCurrentLabel && current && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-sm)',
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-caption-size)',
      letterSpacing: 'var(--text-caption-tracking)',
      textTransform: 'uppercase',
      color: 'var(--primary)'
    }
  }, "Leaf ", currentIndex + 1, " \xB7 ", current.label));
}
Object.assign(__ds_scope, { TrackGraph });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/graph/TrackGraph.jsx", error: String((e && e.message) || e) }); }

// components/lesson/SlideFrame.jsx
try { (() => {
/**
 * The container for one of a leaf's five slides. A leaf is exactly five slides —
 * Summary, Scenario, Payoff, Sticky Notes, Takeaway — and never a sixth.
 */
function SlideFrame({
  kind,
  title,
  children,
  footer,
  tone = 'neutral',
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)',
      padding: 'var(--space-xl)',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-lg)',
      ...style
    }
  }, kind && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: tone
  }, kind)), title && /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: 'var(--text-h1-size)',
      lineHeight: 'var(--text-h1-leading)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)',
      flex: 1
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)'
    }
  }, footer));
}
Object.assign(__ds_scope, { SlideFrame });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/lesson/SlideFrame.jsx", error: String((e && e.message) || e) }); }

// components/lesson/StickyNote.jsx
try { (() => {
/**
 * One of the two to six retention notes, pinned to a textured board — a physical
 * paper note (raised surface, rotated a few degrees, taped at the top edge, soft
 * drop shadow), never a yellow paper sticky, and never amber, which belongs to
 * reward moments alone. Sits inside a `.zo-board` container for the board texture.
 */
const STICKY_ROT = [-4, 3, -2, 5, -3, 2];
function StickyNote({
  index = 1,
  children,
  rotate,
  style
}) {
  const r = rotate != null ? rotate : STICKY_ROT[(index - 1) % STICKY_ROT.length];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      transform: 'rotate(' + r + 'deg)',
      background: 'var(--surface-raised)',
      borderRadius: 'var(--radius-sm)',
      padding: 'var(--space-lg) var(--space-md) var(--space-md)',
      boxShadow: '0 10px 18px -8px rgba(0,0,0,0.45), 0 2px 5px rgba(0,0,0,0.28)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: -9,
      left: '50%',
      width: 36,
      height: 14,
      marginLeft: -18,
      background: 'color-mix(in srgb, var(--surface-raised) 55%, var(--border-hairline) 45%)',
      opacity: 0.85,
      borderRadius: 2,
      transform: 'rotate(' + (-r * 0.6) + 'deg)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: 6,
      right: 8,
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: 10,
      color: 'var(--text-secondary)',
      opacity: 0.55
    }
  }, index), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--font-handwritten)',
      fontWeight: 600,
      fontSize: 'calc(var(--text-body-size) * 1.35)',
      lineHeight: 1.35,
      color: 'var(--text-body)'
    }
  }, children));
}
Object.assign(__ds_scope, { StickyNote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/lesson/StickyNote.jsx", error: String((e && e.message) || e) }); }

// components/lesson/TrackCard.jsx
try { (() => {
/** A track is one book. The card shows its graph, not a cover image. */
function TrackCard({
  title,
  author,
  leavesDone = 0,
  leavesTotal = 5,
  nodes,
  onOpen,
  style
}) {
  const derived = nodes || Array.from({
    length: leavesTotal
  }).map((_, i) => ({
    id: 'n' + i,
    state: i < leavesDone ? 'done' : i === leavesDone ? 'current' : 'locked'
  }));
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    interactive: true,
    onClick: onOpen,
    padding: "var(--space-lg)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-page)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-sm)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.TrackGraph, {
    nodes: derived,
    width: 280,
    height: 92,
    ambientDensity: 16,
    showCurrentLabel: false
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: 'var(--text-h3-size)',
      lineHeight: 'var(--text-h3-leading)',
      color: 'var(--text-heading)'
    }
  }, title), author && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-small-size)',
      lineHeight: 'var(--text-small-leading)',
      color: 'var(--text-secondary)'
    }
  }, author)), /*#__PURE__*/React.createElement(__ds_scope.ProgressBar, {
    value: leavesTotal ? leavesDone / leavesTotal : 0,
    valueLabel: leavesDone + ' / ' + leavesTotal + ' leaves',
    height: 6
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-xs)',
      color: 'var(--primary)',
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-caption-size)',
      letterSpacing: 'var(--text-caption-tracking)',
      textTransform: 'uppercase'
    }
  }, "Continue", /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 14
  })));
}
Object.assign(__ds_scope, { TrackCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/lesson/TrackCard.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SlideProgress.jsx
try { (() => {
const KINDS = ['Summary', 'Scenario', 'Payoff', 'Sticky Notes', 'Takeaway'];

/**
 * Progress through a leaf's five slides — Summary, Scenario, Payoff, Sticky Notes,
 * Takeaway. Five, always: a leaf never has a sixth slide.
 */
function SlideProgress({
  current = 0,
  total = 5,
  showLabel = true,
  style
}) {
  const count = Math.min(total, 5);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-xs)'
    },
    role: "progressbar",
    "aria-valuenow": current + 1,
    "aria-valuemin": 1,
    "aria-valuemax": count
  }, Array.from({
    length: count
  }).map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      height: 4,
      borderRadius: 'var(--radius-full)',
      background: i < current ? 'var(--primary-press)' : i === current ? 'var(--primary)' : 'var(--surface-raised)',
      transition: 'background var(--duration-transition) var(--ease-standard)'
    }
  }))), showLabel && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-caption-size)',
      letterSpacing: 'var(--text-caption-tracking)',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--primary)'
    }
  }, KINDS[current] || ''), /*#__PURE__*/React.createElement("span", null, current + 1, " / ", count)));
}
Object.assign(__ds_scope, { SlideProgress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SlideProgress.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
/** Bottom tab bar. Active tab is teal; tabs are never amber. */
function TabBar({
  items = [],
  activeKey,
  onSelect,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + Math.max(items.length, 1) + ', 1fr)',
      gap: 0,
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-hairline)',
      paddingBottom: 'var(--space-sm)',
      ...style
    }
  }, items.map(item => {
    const active = item.key === activeKey;
    return /*#__PURE__*/React.createElement("button", {
      key: item.key,
      type: "button",
      onClick: () => onSelect && onSelect(item.key),
      "aria-current": active ? 'page' : undefined,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-xs)',
        minHeight: 'var(--touch-target-min)',
        padding: 'var(--space-sm) 0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--primary)' : 'var(--text-secondary)',
        transition: 'color var(--duration-tap) var(--ease-snappy)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: item.icon,
      size: 24
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-semibold)',
        fontSize: 'var(--text-caption-size)',
        letterSpacing: 'var(--text-caption-tracking)',
        textTransform: 'uppercase'
      }
    }, item.label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
/** Screen header. No fake iOS status bar — the real one renders above this. */
function TopBar({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  actionIcon,
  actionLabel,
  onAction,
  sticky = false,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-md)',
      minHeight: 56,
      padding: '0 var(--space-lg)',
      background: 'var(--surface-page)',
      borderBottom: '1px solid var(--border-hairline)',
      position: sticky ? 'sticky' : undefined,
      top: sticky ? 0 : undefined,
      zIndex: sticky ? 5 : undefined,
      ...style
    }
  }, onBack ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-left",
    label: backLabel,
    onClick: onBack,
    style: {
      marginLeft: -10
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: 'var(--text-h3-size)',
      lineHeight: 1.3,
      color: 'var(--text-heading)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-caption-size)',
      letterSpacing: 'var(--text-caption-tracking)',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)'
    }
  }, subtitle)), actionIcon ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: actionIcon,
    label: actionLabel || 'Action',
    onClick: onAction,
    style: {
      marginRight: -10
    }
  }) : null);
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// components/rewards/StreakBadge.jsx
try { (() => {
/** Day streak. Amber, because a streak is a reward. Never navigational. */
function StreakBadge({
  days = 0,
  size = 'md',
  label = 'day streak',
  style
}) {
  const lg = size === 'lg';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: lg ? 'var(--space-sm)' : 'var(--space-xs)',
      padding: lg ? '10px 18px' : '6px 12px',
      borderRadius: 'var(--radius-full)',
      background: 'var(--surface-raised)',
      border: '1px solid var(--reward)',
      color: 'var(--reward)',
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "flame",
    size: lg ? 22 : 16
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: lg ? 'var(--text-h2-size)' : 'var(--text-small-size)',
      lineHeight: 1.1
    }
  }, days), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-caption-size)',
      fontWeight: 'var(--weight-semibold)',
      letterSpacing: 'var(--text-caption-tracking)',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)'
    }
  }, label));
}
Object.assign(__ds_scope, { StreakBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/rewards/StreakBadge.jsx", error: String((e && e.message) || e) }); }

// components/rewards/XpChip.jsx
try { (() => {
/**
 * XP earned. Amber is legal here and in StreakBadge — this IS the reward moment.
 * Never use this chip as a button or a navigational affordance.
 */
function XpChip({
  amount = 0,
  variant = 'solid',
  animate = false,
  style
}) {
  const solid = variant === 'solid';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-xs)',
      padding: '6px 12px',
      borderRadius: 'var(--radius-full)',
      background: solid ? 'var(--reward)' : 'var(--surface-raised)',
      color: solid ? 'var(--text-on-reward)' : 'var(--reward)',
      border: '1px solid ' + (solid ? 'transparent' : 'var(--reward)'),
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: 'var(--text-small-size)',
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
      animation: animate ? 'zo-reward-pop var(--duration-celebration) var(--ease-reward)' : undefined,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "zap",
    size: 15
  }), "+", amount, " XP");
}
Object.assign(__ds_scope, { XpChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/rewards/XpChip.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/App.jsx
try { (() => {
const {
  TabBar
} = window.ZoomOutDesignSystem_442bf9;
const TABS = [{
  key: 'today',
  label: 'Today',
  icon: 'house'
}, {
  key: 'explore',
  label: 'Explore',
  icon: 'compass'
}, {
  key: 'you',
  label: 'You',
  icon: 'user'
}];
function App() {
  const data = window.ZO_DATA;
  const [tab, setTab] = React.useState('today');
  const [trackId, setTrackId] = React.useState(null);
  const [inLeaf, setInLeaf] = React.useState(false);
  const [xpToday, setXpToday] = React.useState(80);
  const [theme, setTheme] = React.useState('dark');
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);
  const track = data.tracks.find(t => t.id === trackId) || data.tracks[0];
  let screen;
  if (inLeaf) {
    screen = /*#__PURE__*/React.createElement(LeafScreen, {
      leaf: data.leaf,
      track: data.tracks[0],
      streak: data.reader.streak,
      onClose: () => setInLeaf(false),
      onFinish: () => {
        setXpToday(x => x + data.leaf.xp);
        setInLeaf(false);
        setTrackId(null);
        setTab('today');
      }
    });
  } else if (trackId) {
    screen = /*#__PURE__*/React.createElement(TrackScreen, {
      track: track,
      onBack: () => setTrackId(null),
      onStartLeaf: () => setInLeaf(true)
    });
  } else if (tab === 'explore') {
    screen = /*#__PURE__*/React.createElement(ExploreScreen, {
      data: data,
      onOpenTrack: setTrackId
    });
  } else if (tab === 'you') {
    screen = /*#__PURE__*/React.createElement(YouScreen, {
      data: data,
      xpToday: xpToday,
      theme: theme,
      onTheme: setTheme,
      reduced: reduced,
      onReduced: setReduced
    });
  } else {
    screen = /*#__PURE__*/React.createElement(TodayScreen, {
      data: data,
      onOpenTrack: setTrackId,
      onStartLeaf: () => setInLeaf(true)
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    className: reduced ? 'zo-reduced' : '',
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      overscrollBehavior: 'contain'
    }
  }, screen), !inLeaf && /*#__PURE__*/React.createElement(TabBar, {
    items: TABS,
    activeKey: tab,
    onSelect: k => {
      setTrackId(null);
      setTab(k);
    }
  }));
}
Object.assign(window, {
  App
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/ExploreScreen.jsx
try { (() => {
const {
  Input,
  TrackCard,
  Badge,
  Card,
  Icon
} = window.ZoomOutDesignSystem_442bf9;
const TOPICS = ['Decisions', 'Habits', 'Focus', 'Money', 'Learning', 'Teams'];
function ExploreScreen({
  data,
  onOpenTrack
}) {
  const [query, setQuery] = React.useState('');
  const [topic, setTopic] = React.useState('Decisions');
  const tracks = data.tracks.filter(t => (t.title + t.author).toLowerCase().includes(query.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)',
      padding: 'var(--space-lg) var(--gutter) var(--space-xxl)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "zo-h1"
  }, "Explore"), /*#__PURE__*/React.createElement(Input, {
    icon: "compass",
    placeholder: "Search tracks or authors",
    value: query,
    onChange: setQuery
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-sm)',
      flexWrap: 'wrap'
    }
  }, TOPICS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    type: "button",
    onClick: () => setTopic(t),
    style: {
      minHeight: 'var(--touch-target-min)',
      padding: '0 var(--space-lg)',
      borderRadius: 'var(--radius-full)',
      background: topic === t ? 'var(--primary)' : 'var(--surface-raised)',
      color: topic === t ? 'var(--text-on-primary)' : 'var(--text-body)',
      border: '1px solid ' + (topic === t ? 'var(--primary)' : 'var(--border-hairline)'),
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-small-size)',
      cursor: 'pointer'
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "zo-caption"
  }, topic, " \xB7 ", tracks.length, " tracks")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)'
    }
  }, tracks.map(t => /*#__PURE__*/React.createElement(TrackCard, {
    key: t.id,
    title: t.title,
    author: t.author,
    leavesDone: t.done,
    leavesTotal: t.leaves.length,
    onOpen: () => onOpenTrack(t.id)
  })), tracks.length === 0 && /*#__PURE__*/React.createElement(Card, {
    elevation: "raised",
    style: {
      display: 'flex',
      gap: 'var(--space-md)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "compass",
    size: 20,
    color: "var(--text-muted)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "zo-small",
    style: {
      color: 'var(--text-muted)'
    }
  }, "Nothing matches that yet. Try an author or a topic."))));
}
Object.assign(window, {
  ExploreScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/ExploreScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/LeafScreen.jsx
try { (() => {
const {
  TopBar,
  SlideProgress,
  SlideFrame,
  OptionButton,
  FeedbackNote,
  LockedPanel,
  StickyNote,
  Button,
  XpChip,
  StreakBadge,
  Badge,
  Icon
} = window.ZoomOutDesignSystem_442bf9;
const KINDS = ['Summary', 'Scenario', 'Payoff', 'Sticky Notes', 'Takeaway'];
function LeafScreen({
  leaf,
  track,
  streak,
  onClose,
  onFinish
}) {
  const [slide, setSlide] = React.useState(0);
  const [picked, setPicked] = React.useState(null);
  const [checked, setChecked] = React.useState(false);
  const correct = checked && picked === leaf.scenario.correctId;
  const stateFor = id => {
    if (!checked) return picked === id ? 'selected' : 'default';
    if (id === leaf.scenario.correctId && picked === id) return 'correct';
    if (picked === id) return 'incorrect';
    return 'default';
  };
  const next = () => setSlide(s => Math.min(s + 1, 4));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    subtitle: track.title,
    title: leaf.title,
    actionIcon: "x",
    actionLabel: "Close leaf",
    onAction: onClose
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-md) var(--gutter) 0'
    }
  }, /*#__PURE__*/React.createElement(SlideProgress, {
    current: slide
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 'var(--space-lg) var(--gutter) var(--space-xxl)'
    }
  }, slide === 0 && /*#__PURE__*/React.createElement(SlideFrame, {
    kind: "Summary",
    title: leaf.title,
    footer: /*#__PURE__*/React.createElement(Button, {
      fullWidth: true,
      icon: "chevron-right",
      iconPosition: "right",
      onClick: next
    }, "Scenario")
  }, leaf.summary.map(p => /*#__PURE__*/React.createElement("p", {
    key: p,
    className: "zo-body",
    style: {
      margin: 0
    }
  }, p))), slide === 1 && /*#__PURE__*/React.createElement(SlideFrame, {
    kind: "Scenario",
    tone: "primary",
    title: leaf.scenario.question,
    footer: checked && correct ? /*#__PURE__*/React.createElement(Button, {
      fullWidth: true,
      icon: "lock-open",
      onClick: next
    }, "Unlock payoff") : /*#__PURE__*/React.createElement(Button, {
      fullWidth: true,
      disabled: !picked,
      onClick: () => setChecked(true)
    }, "Check answer")
  }, /*#__PURE__*/React.createElement("p", {
    className: "zo-body",
    style: {
      margin: 0,
      color: 'var(--text-muted)'
    }
  }, leaf.scenario.prompt), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, leaf.scenario.options.map((o, i) => /*#__PURE__*/React.createElement(OptionButton, {
    key: o.id,
    index: i,
    state: stateFor(o.id),
    onClick: () => {
      if (!correct) {
        setPicked(o.id);
        setChecked(false);
      }
    }
  }, o.text))), checked && /*#__PURE__*/React.createElement(FeedbackNote, {
    kind: correct ? 'correct' : 'incorrect'
  }, correct ? leaf.scenario.correctNote : leaf.scenario.incorrectNote)), slide === 2 && /*#__PURE__*/React.createElement(SlideFrame, {
    kind: "Payoff",
    title: "Why it works",
    footer: correct ? /*#__PURE__*/React.createElement(Button, {
      fullWidth: true,
      icon: "chevron-right",
      iconPosition: "right",
      onClick: next
    }, "Sticky notes") : /*#__PURE__*/React.createElement(Button, {
      fullWidth: true,
      variant: "secondary",
      onClick: () => setSlide(1)
    }, "Back to the scenario")
  }, /*#__PURE__*/React.createElement(LockedPanel, {
    unlocked: correct,
    hint: "Answer the scenario correctly to unlock the payoff"
  }, /*#__PURE__*/React.createElement("p", {
    className: "zo-payoff",
    style: {
      margin: 0
    }
  }, leaf.payoff))), slide === 3 && /*#__PURE__*/React.createElement(SlideFrame, {
    kind: "Sticky Notes",
    title: "Three things to keep",
    footer: /*#__PURE__*/React.createElement(Button, {
      fullWidth: true,
      icon: "chevron-right",
      iconPosition: "right",
      onClick: next
    }, "Takeaway")
  }, leaf.notes.map((n, i) => /*#__PURE__*/React.createElement(StickyNote, {
    key: n,
    index: i + 1
  }, n))), slide === 4 && /*#__PURE__*/React.createElement(SlideFrame, {
    kind: "Takeaway",
    tone: "reward",
    title: "Do this next",
    footer: /*#__PURE__*/React.createElement(Button, {
      fullWidth: true,
      size: "lg",
      onClick: onFinish
    }, "Finish leaf")
  }, /*#__PURE__*/React.createElement("p", {
    className: "zo-body",
    style: {
      margin: 0
    }
  }, leaf.takeaway), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(XpChip, {
    amount: leaf.xp,
    animate: true
  }), /*#__PURE__*/React.createElement(StreakBadge, {
    days: streak + 0,
    label: "day streak"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "network",
    size: 18,
    color: "var(--primary)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "zo-small"
  }, "One more node on the graph. Next up: Availability.")))));
}
Object.assign(window, {
  LeafScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/LeafScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/TodayScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  ProgressBar,
  StreakBadge,
  TrackCard,
  TopBar,
  Icon
} = window.ZoomOutDesignSystem_442bf9;
function TodayScreen({
  data,
  onOpenTrack,
  onStartLeaf
}) {
  const current = data.tracks[0];
  const {
    reader
  } = data;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-xl)',
      padding: 'var(--space-lg) var(--gutter) var(--space-xxl)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "zo-caption"
  }, "Wednesday"), /*#__PURE__*/React.createElement("h1", {
    className: "zo-h1",
    style: {
      marginTop: 2
    }
  }, "Pick up where you left off")), /*#__PURE__*/React.createElement(StreakBadge, {
    days: reader.streak,
    label: ""
  })), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-lg)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 'var(--space-sm)'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "primary"
  }, "Next leaf"), /*#__PURE__*/React.createElement("span", {
    className: "zo-caption"
  }, reader.minutesLeft, " min left today")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "zo-h2"
  }, current.leaves[current.done]), /*#__PURE__*/React.createElement("div", {
    className: "zo-small",
    style: {
      color: 'var(--text-muted)'
    }
  }, current.title, " \xB7 Leaf ", current.done + 1, " of ", current.leaves.length)), /*#__PURE__*/React.createElement(ProgressBar, {
    value: current.done / current.leaves.length,
    valueLabel: current.done + ' / ' + current.leaves.length + ' leaves',
    height: 6
  }), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    icon: "play",
    onClick: onStartLeaf
  }, "Start leaf \xB7 3 min")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "zo-caption"
  }, "In progress"), /*#__PURE__*/React.createElement("span", {
    className: "zo-caption",
    style: {
      color: 'var(--primary)'
    }
  }, "3 tracks")), data.tracks.slice(0, 3).map(t => /*#__PURE__*/React.createElement(Card, {
    key: t.id,
    interactive: true,
    padding: "var(--space-md)",
    onClick: () => onOpenTrack(t.id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-hairline)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--primary)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "network",
    size: 20
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "zo-h3",
    style: {
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, t.title), /*#__PURE__*/React.createElement("span", {
    className: "zo-small",
    style: {
      color: 'var(--text-muted)'
    }
  }, t.done, " / ", t.leaves.length, " leaves")), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 20,
    color: "var(--text-muted)"
  })))));
}
Object.assign(window, {
  TodayScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/TodayScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/TrackScreen.jsx
try { (() => {
const {
  TopBar,
  Button,
  Card,
  Badge,
  ProgressBar,
  TrackGraph,
  Icon
} = window.ZoomOutDesignSystem_442bf9;
function TrackScreen({
  track,
  onBack,
  onStartLeaf
}) {
  const nodes = track.leaves.map((label, i) => ({
    id: 'l' + i,
    label,
    state: i < track.done ? 'done' : i === track.done ? 'current' : 'locked'
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%'
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    subtitle: "Track",
    title: track.title,
    onBack: onBack,
    actionIcon: "bookmark",
    actionLabel: "Save track",
    sticky: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)',
      padding: 'var(--space-lg) var(--gutter) var(--space-xxl)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "zo-small",
    style: {
      color: 'var(--text-muted)'
    }
  }, track.author), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: track.done / track.leaves.length,
    label: "Track progress",
    valueLabel: track.done + ' / ' + track.leaves.length + ' leaves'
  }))), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-md)",
    elevation: "card"
  }, /*#__PURE__*/React.createElement(TrackGraph, {
    nodes: nodes,
    orientation: "vertical",
    width: 240,
    height: 300,
    ambientDensity: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "zo-caption"
  }, "Leaves"), track.leaves.map((label, i) => {
    const done = i < track.done;
    const current = i === track.done;
    return /*#__PURE__*/React.createElement("div", {
      key: label,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        minHeight: 'var(--touch-target-min)',
        padding: 'var(--space-sm) var(--space-md)',
        background: current ? 'var(--surface-raised)' : 'transparent',
        border: '1px solid ' + (current ? 'var(--primary)' : 'var(--border-hairline)'),
        borderRadius: 'var(--radius-md)',
        opacity: done || current ? 1 : 0.6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 24,
        display: 'flex',
        justifyContent: 'center',
        color: done ? 'var(--correct)' : current ? 'var(--primary)' : 'var(--text-muted)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: done ? 'check' : current ? 'play' : 'lock',
      size: done ? 18 : 16
    })), /*#__PURE__*/React.createElement("span", {
      className: "zo-body",
      style: {
        flex: 1
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      className: "zo-caption"
    }, i + 1));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      bottom: 0,
      padding: 'var(--space-md) var(--gutter) var(--space-lg)',
      background: 'var(--surface-page)',
      borderTop: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg",
    icon: "play",
    onClick: onStartLeaf
  }, "Continue \xB7 ", track.leaves[track.done])));
}
Object.assign(window, {
  TrackScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/TrackScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/YouScreen.jsx
try { (() => {
const {
  Card,
  ProgressBar,
  StreakBadge,
  XpChip,
  Switch,
  Badge,
  Icon
} = window.ZoomOutDesignSystem_442bf9;
function YouScreen({
  data,
  xpToday,
  theme,
  onTheme,
  reduced,
  onReduced
}) {
  const {
    reader
  } = data;
  const finished = data.tracks.filter(t => t.done === t.leaves.length).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)',
      padding: 'var(--space-lg) var(--gutter) var(--space-xxl)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "zo-h1"
  }, "You"), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-lg)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-md)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(StreakBadge, {
    days: reader.streak,
    size: "lg"
  }), /*#__PURE__*/React.createElement(XpChip, {
    amount: xpToday,
    variant: "soft"
  })), /*#__PURE__*/React.createElement(ProgressBar, {
    value: reader.xpInLevel / reader.xpPerLevel,
    tone: "reward",
    label: 'Level ' + reader.level,
    valueLabel: reader.xpInLevel + ' / ' + reader.xpPerLevel + ' XP'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "zo-caption"
  }, "Tracks"), data.tracks.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-md)',
      padding: 'var(--space-md)',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-md)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "zo-h3",
    style: {
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, t.title), /*#__PURE__*/React.createElement("span", {
    className: "zo-small",
    style: {
      color: 'var(--text-muted)'
    }
  }, t.done, " / ", t.leaves.length, " leaves")), t.done === t.leaves.length ? /*#__PURE__*/React.createElement(Badge, {
    tone: "reward",
    icon: "check"
  }, "Complete") : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 84
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: t.done / t.leaves.length,
    height: 6
  }))))), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-lg)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "zo-caption"
  }, "Settings"), /*#__PURE__*/React.createElement(Switch, {
    checked: theme === 'light',
    onChange: v => onTheme(v ? 'light' : 'dark'),
    label: "Light appearance",
    description: "Dark is the default and the fallback"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--border-hairline)'
    }
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: reduced,
    onChange: onReduced,
    label: "Reduced motion",
    description: "Swaps springs for an opacity fade \u2014 feedback stays"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "book-open",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "zo-small"
  }, finished, " tracks finished \xB7 sessions capped at 15 minutes by design")));
}
Object.assign(window, {
  YouScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/YouScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/data.js
try { (() => {
/* Sample content for the ZoomOut mobile UI kit. A Track is one book; a Leaf is one
   ~3-minute lesson of exactly five slides. No invented metrics — the only numbers here
   are ones the product actually tracks: leaves, XP, streak days, session minutes. */
window.ZO_DATA = {
  reader: {
    streak: 12,
    level: 6,
    xpInLevel: 240,
    xpPerLevel: 400,
    minutesLeft: 12
  },
  tracks: [{
    id: 'tfs',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    done: 4,
    leaves: ['Two systems', 'Attention', 'Anchoring', 'Availability', 'Framing', 'Regression', 'Planning fallacy', 'Loss aversion', 'Endowment', 'Peak-end', 'Two selves', 'Zooming out']
  }, {
    id: 'habits',
    title: 'Atomic Habits',
    author: 'James Clear',
    done: 9,
    leaves: ['Systems over goals', 'Cue', 'Craving', 'Response', 'Reward', 'Stacking', 'Environment', 'Two-minute rule', 'Identity', 'Plateau']
  }, {
    id: 'range',
    title: 'Range',
    author: 'David Epstein',
    done: 0,
    leaves: ['Head start', 'Wicked worlds', 'Sampling', 'Late specialising', 'Outside view', 'Analogies', 'Drop tools', 'Amateurs', 'Zooming out']
  }, {
    id: 'deep',
    title: 'Deep Work',
    author: 'Cal Newport',
    done: 2,
    leaves: ['Attention residue', 'Shallow work', 'Rituals', 'Boredom', 'Quitting feeds', 'Fixed schedule', 'Deliberate practice', 'Drain', 'Grand gestures', 'Rhythm', 'Journalist mode']
  }],
  leaf: {
    trackId: 'tfs',
    index: 4,
    title: 'Anchoring',
    summary: ['Anchoring is the pull of the first number you hear. It sets the range everything after it gets judged against — including the number you were about to say.', 'It works on people who know about it. Knowing the name of the effect is not the same as being immune to it.'],
    scenario: {
      prompt: 'You planned to offer 2,400 for a used car. The seller opens with 3,900 and explains why it is worth every penny. You settle at 3,100 and feel you did well.',
      question: 'What did the most work in that negotiation?',
      options: [{
        id: 'a',
        text: 'Your patience during the back-and-forth'
      }, {
        id: 'b',
        text: 'The seller opening with 3,900'
      }, {
        id: 'c',
        text: 'The car being worth more than you thought'
      }],
      correctId: 'b',
      correctNote: 'The opening figure moved the whole range. 3,100 only feels like a win measured against 3,900 — not against the 2,400 you arrived with.',
      incorrectNote: 'Not the negotiation itself. Look at what set the range you were judging offers against.'
    },
    payoff: 'The anchor does its work before you start reasoning, which is why noticing it afterwards rarely undoes it. The practical move is to name your own number first — or, when you cannot, to write down your figure before you hear theirs and judge every offer against that instead.',
    notes: ['The first number sets the range. Name yours first.', 'Noticing an anchor afterwards rarely undoes it.', 'Write your figure down before you hear theirs.'],
    takeaway: 'Before your next negotiation, write your number down. That is the anchor you want to be arguing from.',
    xp: 40
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.FeedbackNote = __ds_scope.FeedbackNote;

__ds_ns.LockedPanel = __ds_scope.LockedPanel;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.OptionButton = __ds_scope.OptionButton;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TrackGraph = __ds_scope.TrackGraph;

__ds_ns.SlideFrame = __ds_scope.SlideFrame;

__ds_ns.StickyNote = __ds_scope.StickyNote;

__ds_ns.TrackCard = __ds_scope.TrackCard;

__ds_ns.SlideProgress = __ds_scope.SlideProgress;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.TopBar = __ds_scope.TopBar;

__ds_ns.StreakBadge = __ds_scope.StreakBadge;

__ds_ns.XpChip = __ds_scope.XpChip;

})();
