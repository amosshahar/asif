export interface Shift {
  id: string
  collectorId: string
  startedAt: string
  /** Set when shift ends; omitted or null while `open` is true. */
  endedAt: string | null
  open: boolean
}
