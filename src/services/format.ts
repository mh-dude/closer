/**
 * Turns a raw value plus a puzzle's unit into the string players read.
 *
 * Authored puzzles only need `value`; this produces the display string and the
 * labels at each end of the scale. A puzzle can still override any of them when
 * it wants wording this can't reach ("8 hours" rather than "8 hr").
 *
 * Unknown units fall back to `<grouped number> <unit>`, which is correct but
 * plain — checkPuzzles warns so you notice you're getting the fallback.
 */

/** Sensible precision for a magnitude: fewer decimals as numbers get bigger. */
function sig(n: number): string {
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  let decimals: number
  if (abs >= 100) decimals = 0
  else if (abs >= 10) decimals = abs % 1 === 0 ? 0 : 1
  else if (abs >= 1) decimals = abs % 1 === 0 ? 0 : 1
  else if (abs >= 0.1) decimals = 2
  else decimals = 3
  return Number(n.toFixed(decimals)).toLocaleString('en-US', {
    maximumFractionDigits: decimals,
  })
}

function grouped(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** Words rather than digits past a million — "13.8 billion" beats 13,800,000,000. */
function magnitude(n: number, suffix = ''): string {
  const tail = suffix ? ` ${suffix}` : ''
  if (Math.abs(n) >= 1e12) return `${sig(n / 1e12)} trillion${tail}`
  if (Math.abs(n) >= 1e9) return `${sig(n / 1e9)} billion${tail}`
  if (Math.abs(n) >= 1e6) return `${sig(n / 1e6)} million${tail}`
  // sig, not grouped: this branch also carries converted units, where rounding
  // to a whole number would turn 3.8 km into 4 km.
  return `${sig(n)}${tail}`
}

function duration(seconds: number): string {
  if (seconds < 60) return `${sig(seconds)} sec`
  if (seconds < 3600) {
    const min = Math.floor(seconds / 60)
    const sec = Math.round(seconds % 60)
    return sec ? `${min} min ${sec} sec` : `${min} min`
  }
  if (seconds < 86400) {
    const hr = Math.floor(seconds / 3600)
    const min = Math.round((seconds % 3600) / 60)
    return min ? `${hr} hr ${min} min` : `${hr} hr`
  }
  const days = seconds / 86400
  return `${sig(days)} ${days === 1 ? 'day' : 'days'}`
}

function length(meters: number): string {
  // Below a millimetre the metric prefixes keep going — without these, a
  // nanometre-scale puzzle renders its whole axis as "0 mm".
  if (meters < 1e-6) return `${sig(meters * 1e9)} nm`
  if (meters < 1e-3) return `${sig(meters * 1e6)} µm`
  if (meters < 0.01) return `${sig(meters * 1000)} mm`
  if (meters < 1) return `${sig(meters * 100)} cm`
  if (meters < 1000) return `${sig(meters)} m`
  return `${magnitude(meters / 1000)} km`
}

function mass(kilograms: number): string {
  if (kilograms < 1) return `${sig(kilograms * 1000)} g`
  if (kilograms < 1000) return `${sig(kilograms)} kg`
  return `${magnitude(kilograms / 1000)} t`
}

function money(dollars: number): string {
  if (dollars >= 1e6) return `$${magnitude(dollars)}`
  if (dollars < 10 && dollars % 1 !== 0) return `$${dollars.toFixed(2)}`
  return `$${grouped(dollars)}`
}

type Formatter = (value: number) => string

const FORMATTERS: Record<string, Formatter> = {
  seconds: duration,
  meters: length,
  kilograms: mass,
  'US dollars': money,
  people: (v) => magnitude(v),
  years: (v) => magnitude(v, v === 1 ? 'year' : 'years'),
  // The puzzle title supplies the "ago"; the value just needs the span.
  'years ago': (v) => magnitude(v, v === 1 ? 'year' : 'years'),
  '°C': (v) => `${sig(v)} °C`,
  'km/h': (v) => `${sig(v)} km/h`,
  'beats per minute': (v) => `${sig(v)} bpm`,
}

export const KNOWN_UNITS = Object.keys(FORMATTERS)

export function formatValue(value: number, unit: string): string {
  const formatter = FORMATTERS[unit]
  return formatter ? formatter(value) : `${sig(value)} ${unit}`
}

/**
 * Shorter form for axis gridlines, where a compound reading like
 * "1 min 40 sec" is noise. Only durations differ from formatValue.
 */
export function formatTick(value: number, unit: string): string {
  if (unit !== 'seconds') return formatValue(value, unit)
  if (value < 60) return `${sig(value)} sec`
  if (value < 3600) return `${sig(value / 60)} min`
  if (value < 86400) return `${sig(value / 3600)} hr`
  const days = value / 86400
  return `${sig(days)} ${days === 1 ? 'day' : 'days'}`
}
