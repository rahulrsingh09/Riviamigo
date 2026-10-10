import { createContext, useContext } from 'react';
import type { ThemeColorPair } from '@riviamigo/themes';
import type { ThemePalette } from '@riviamigo/types';
import { useThemeRuntime } from '../lib/themeRuntime';

export interface DataPaletteOverride {
  palette: ThemePalette;
  chartColorPairs?: Record<string, ThemeColorPair>;
}
const DataPaletteContext = createContext<DataPaletteOverride | undefined>(undefined);
export const DataPaletteProvider = DataPaletteContext.Provider;

export function useDocumentPalette(): ThemePalette {
  const override = useContext(DataPaletteContext);
  const runtime = useThemeRuntime();
  return override?.palette ?? runtime.legacyPalette;
}

export function useChartColorPairs() {
  const override = useContext(DataPaletteContext);
  const runtime = useThemeRuntime();
  return override?.chartColorPairs ?? runtime.chartColorPairs;
}
