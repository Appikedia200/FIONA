import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CustomSelect({ value, onChange, options, placeholder, className = '', disabled = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selectedOption ? 'text-white' : 'text-white/30'}>
          {selectedOption?.label || placeholder || 'Select...'}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#151823] shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <Check className="h-4 w-4 text-[#4F7FFF]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
