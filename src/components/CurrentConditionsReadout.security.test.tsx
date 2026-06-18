import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { CurrentConditionsReadout } from './CurrentConditionsReadout'
import type { CurrentConditions, Location } from '../domain/types'

afterEach(() => {
  cleanup()
  delete (globalThis as Record<string, unknown>).__xss
})

const location: Location = { name: 'Springfield', latitude: 1, longitude: 2 }

// The Weather Condition label is derived from untrusted external input (the
// provider's weather_code, mapped in our table today — but the readout must not
// assume its inputs are trusted). The temperature and label both render into the
// DOM and must cross the boundary as inert text, never HTML.
describe('CurrentConditionsReadout renders Current Conditions as inert text (XSS guard)', () => {
  it('renders a Weather Condition label containing markup as literal visible text', () => {
    const conditions: CurrentConditions = {
      temperatureC: 21,
      condition: { label: '<img src=x onerror="globalThis.__xss=1">' },
    }

    const { container } = render(
      <CurrentConditionsReadout location={location} conditions={conditions} />,
    )

    expect(container.querySelector('img')).toBeNull()
    expect((globalThis as Record<string, unknown>).__xss).toBeUndefined()
    expect(screen.getByText(/onerror/)).toBeInTheDocument()
  })

  it('renders the temperature as a text node', () => {
    const conditions: CurrentConditions = {
      temperatureC: 23.6,
      condition: { label: 'Overcast' },
    }

    render(<CurrentConditionsReadout location={location} conditions={conditions} />)

    // Rounded temperature and label appear together as plain text.
    expect(screen.getByText(/24°C — Overcast/)).toBeInTheDocument()
  })
})
