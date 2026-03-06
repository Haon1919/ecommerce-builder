import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from './../Modal/Modal';

export interface SelectOption {
    label: string;
    value: string | number;
}

export interface SelectProps {
    options: SelectOption[];
    value?: string | number;
    onChange: (value: string | number) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function Select({
    options,
    value,
    onChange,
    placeholder = 'Select an option',
    className,
    disabled = false,
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = (val: string | number) => {
        onChange(val);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen(prev => !prev);
            e.preventDefault();
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        } else if (isOpen && e.key === 'ArrowDown') {
            // Basic keyboard navigation could be added here
            e.preventDefault();
        }
    };

    return (
        <div
            className={cn("relative w-full", className)}
            ref={containerRef}
        >
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    !selectedOption && "text-muted-foreground"
                )}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
            </button>

            {isOpen && (
                <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80">
                    <ul
                        role="listbox"
                        tabIndex={-1}
                        className="p-1"
                    >
                        {options.map((option) => (
                            <li
                                key={option.value}
                                role="option"
                                aria-selected={value === option.value}
                                onClick={() => handleSelect(option.value)}
                                className={cn(
                                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                    value === option.value && "bg-accent text-accent-foreground"
                                )}
                                data-testid={`select-option-${option.value}`}
                            >
                                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                    {value === option.value && (
                                        <Check className="h-4 w-4" />
                                    )}
                                </span>
                                <span className="truncate">{option.label}</span>
                            </li>
                        ))}
                        {options.length === 0 && (
                            <li className="py-6 text-center text-sm text-muted-foreground">
                                No options found.
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
