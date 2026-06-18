import styled from 'styled-components'

const Input = styled.input`
  font-size: 1rem;
  padding: 0.5rem;
  width: 100%;
  max-width: 400px;
`

interface Props {
  value: string
  onChange: (value: string) => void
}

/** Controlled input that emits Query changes. */
export function SearchBar({ value, onChange }: Props) {
  return (
    <Input
      type="text"
      placeholder="Search for a place"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
