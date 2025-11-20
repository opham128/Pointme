import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Category, Place, Location } from '../types';

interface AppContextType {
  selectedCategory: Category | null;
  setSelectedCategory: (category: Category | null) => void;
  targetPlace: Place | null;
  setTargetPlace: (place: Place | null) => void;
  userLocation: Location | null;
  setUserLocation: (location: Location | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [targetPlace, setTargetPlace] = useState<Place | null>(null);
  const [userLocation, setUserLocation] = useState<Location | null>(null);

  return (
    <AppContext.Provider
      value={{
        selectedCategory,
        setSelectedCategory,
        targetPlace,
        setTargetPlace,
        userLocation,
        setUserLocation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

