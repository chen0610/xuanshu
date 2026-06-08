import { create } from 'zustand'

export interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

export interface UpdateProgressInfo {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

interface UpdateState {
  status: UpdateStatus
  updateInfo: UpdateInfo | null
  progress: UpdateProgressInfo | null
  error: string | null
  isDialogOpen: boolean

  // Actions
  setStatus: (status: UpdateStatus) => void
  setUpdateInfo: (info: UpdateInfo) => void
  setProgress: (progress: UpdateProgressInfo) => void
  setError: (error: string) => void
  setDialogOpen: (open: boolean) => void
  reset: () => void
}

const initialState = {
  status: 'idle' as UpdateStatus,
  updateInfo: null,
  progress: null,
  error: null,
  isDialogOpen: false
}

export const useUpdateStore = create<UpdateState>((set) => ({
  ...initialState,

  setStatus: (status: UpdateStatus) => set({ status }),

  setUpdateInfo: (updateInfo: UpdateInfo) => set({ updateInfo }),

  setProgress: (progress: UpdateProgressInfo) => set({ progress }),

  setError: (error: string) => set({ status: 'error', error }),

  setDialogOpen: (isDialogOpen: boolean) => set({ isDialogOpen }),

  reset: () => set(initialState)
}))
