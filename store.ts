import { create } from 'zustand';

interface StarData {
  id: number;
  mass: number;
  temp: number;
  spectralClass: string;
  age: number;
  velocity: number;
  position: [number, number, number];
}

interface AppState {
  timeScale: number;
  setTimeScale: (scale: number) => void;
  selectedStar: StarData | null;
  setSelectedStar: (star: StarData | null) => void;
  selectedStarPos: [number, number, number] | null;
  setSelectedStarPos: (pos: [number, number, number] | null) => void;
  selectedStarAge: number | null;
  setSelectedStarAge: (age: number | null) => void;
  selectedStarMass: number | null;
  setSelectedStarMass: (mass: number | null) => void;
  cameraMode: 'free' | 'follow';
  setCameraMode: (mode: 'free' | 'follow') => void;
  cameraTarget: [number, number, number] | null;
  setCameraTarget: (target: [number, number, number] | null) => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  timeScale: 1.0,
  setTimeScale: (scale) => set({ timeScale: scale }),
  selectedStar: null,
  setSelectedStar: (star) => set({ selectedStar: star }),
  selectedStarPos: null,
  setSelectedStarPos: (pos) => set({ selectedStarPos: pos }),
  selectedStarAge: null,
  setSelectedStarAge: (age) => set({ selectedStarAge: age }),
  selectedStarMass: null,
  setSelectedStarMass: (mass) => set({ selectedStarMass: mass }),
  cameraMode: 'free',
  setCameraMode: (mode) => set({ cameraMode: mode }),
  cameraTarget: null,
  setCameraTarget: (target) => set({ cameraTarget: target }),
  isPaused: false,
  setIsPaused: (paused) => set({ isPaused: paused }),
}));
