import { create } from 'zustand';

const STORAGE_KEY = 'iphone-catalog-state';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { favorites: [], compare: [] };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      favorites: state.favorites,
      compare: state.compare,
    }));
  } catch { /* ignore */ }
}

export const useStore = create((set, get) => ({
  favorites: loadState().favorites,
  compare: loadState().compare,

  toggleFavorite: (modelId) => {
    set((state) => {
      const next = state.favorites.includes(modelId)
        ? state.favorites.filter((id) => id !== modelId)
        : [...state.favorites, modelId];
      const nextObj = { ...state, favorites: next };
      saveState(nextObj);
      return { favorites: next };
    });
  },

  isFavorite: (modelId) => get().favorites.includes(modelId),

  addToCompare: (modelId) => {
    const state = get();
    if (state.compare.length >= 4) return false;
    if (state.compare.includes(modelId)) return false;
    set(() => {
      const next = [...state.compare, modelId];
      const nextObj = { ...state, compare: next };
      saveState(nextObj);
      return { compare: next };
    });
    return true;
  },

  removeFromCompare: (modelId) => {
    set((state) => {
      const next = state.compare.filter((id) => id !== modelId);
      const nextObj = { ...state, compare: next };
      saveState(nextObj);
      return { compare: next };
    });
  },

  isInCompare: (modelId) => get().compare.includes(modelId),

  clearFavorites: () => {
    set(() => {
      const nextObj = { favorites: [], compare: get().compare };
      saveState(nextObj);
      return { favorites: [] };
    });
  },

  clearCompare: () => {
    set(() => {
      const nextObj = { favorites: get().favorites, compare: [] };
      saveState(nextObj);
      return { compare: [] };
    });
  },
}));
