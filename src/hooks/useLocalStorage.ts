import React, { useState, useEffect } from 'react';

export default function useLocalStorage<T>(key: string, initialValue: T): [T | null, React.Dispatch<React.SetStateAction<T>>, boolean] {
  // Start with null to avoid showing defaults until we check localStorage
  const [value, setValue] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage after mount
  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      setValue(item ? JSON.parse(item) : initialValue);
      setLoaded(true);
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      setValue(initialValue);
      setLoaded(true);
    }
  }, [key]);

  // Update localStorage when state changes (but not before initial load)
  useEffect(() => {
    if (!loaded || value === null) return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }, [key, value, loaded]);

  // Wrapper to handle the type mismatch
  const setValueWrapper: React.Dispatch<React.SetStateAction<T>> = (action) => {
    if (typeof action === 'function') {
      setValue((prev) => prev === null ? initialValue : (action as (prev: T) => T)(prev));
    } else {
      setValue(action);
    }
  };

  return [value, setValueWrapper, loaded];
}
