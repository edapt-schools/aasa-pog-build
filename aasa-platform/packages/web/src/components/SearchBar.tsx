import { Input } from './ui/input'
import { Button } from './ui/button'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  placeholder?: string
  isLoading?: boolean
  className?: string
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Search districts...',
  isLoading = false,
  className = '',
}: SearchBarProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className="flex-1"
        disabled={isLoading}
      />
      <Button onClick={onSearch} disabled={isLoading || !value.trim()}>
        {isLoading ? 'Searching...' : 'Search'}
      </Button>
    </div>
  )
}
