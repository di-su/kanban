import React, { useState, useEffect } from 'react';

export default function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  // Always start with initialValue to prevent hydration mismatch
  const [value, setValue] = useState<T>(initialValue);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage after mount
  useEffect(() => {
    setMounted(true);
    
    try {
      const item = localStorage.getItem(key);
      if (item) {
        setValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Update localStorage when state changes (but not on initial mount)
  useEffect(() => {
    if (!mounted) return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }, [key, value, mounted]);

  return [value, setValue, mounted];
}
