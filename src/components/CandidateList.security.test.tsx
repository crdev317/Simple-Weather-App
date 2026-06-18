import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { CandidateList } from './CandidateList'
import type { Location } from '../domain/types'

afterEach(() => {
  cleanup()
  delete (globalThis as Record<string, unknown>).__xss
})

// A candidate Location field is untrusted external input from Open-Meteo
// (Seam 1). The candidate list renders name/region/country, so markup smuggled
// into any of them must cross the API → DOM boundary as inert text, never HTML.
describe('CandidateList renders external Location fields as inert text (XSS guard)', () => {
  it('renders a candidate name containing markup as literal visible text', () => {
    const malicious: Location = {
      name: '<img src=x onerror="globalThis.__xss=1">',
      latitude: 1,
      longitude: 2,
    }

    const { container } = render(
      <CandidateList candidates={[malicious]} onPick={() => {}} />,
    )

    // The payload is not interpreted as HTML: no element is created from it...
    expect(container.querySelector('img')).toBeNull()
    // ...and its onerror handler never executes.
    expect((globalThis as Record<string, unknown>).__xss).toBeUndefined()
    // The markup is shown to the user verbatim, as a text node.
    expect(screen.getByText(malicious.name)).toBeInTheDocument()
  })
})
