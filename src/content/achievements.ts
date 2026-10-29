export type AchievementKind = 'win' | 'finalist' | 'runner-up' | 'patent-filed' | 'leadership'

export interface Achievement {
  id: string
  kind: AchievementKind
  badge: string
  title: string
  detail: string
  /** Constellation glyph the drones form for this entry. */
  glyph: 'cycle' | 'circuit' | 'network' | 'probe' | 'document' | 'team'
  projectId?: string
}

// Wording follows the resume exactly: wins, finalist, runner-up and filings are kept distinct.
export const achievements: Achievement[] = [
  {
    id: 'bcdc',
    kind: 'win',
    badge: 'Winner',
    title: 'Bharath Cycle Design Challenge (AICTE)',
    detail:
      'Secured 1st place in the national-level cycle design competition organised by AICTE for a Cargo-cum-Commute Electric Cycle concept emphasising sustainability and modular utility.',
    glyph: 'cycle',
  },
  {
    id: 'sih',
    kind: 'finalist',
    badge: 'Finalist',
    title: 'Smart India Hackathon 2023',
    detail:
      'Developed and presented a Digital Assistant for Legal Awareness & KYC Framework, selected for national-level evaluation in the software category.',
    glyph: 'document',
    projectId: 'legal-kyc',
  },
  {
    id: 'design-patent',
    kind: 'patent-filed',
    badge: 'Design patent filed',
    title: 'Cargo-cum-Commute Electric Cycle',
    detail: 'A design patent application has been filed for the dual-purpose E-cycle. (Filed — not a granted patent.)',
    glyph: 'circuit',
  },
  {
    id: 'utility-patent',
    kind: 'patent-filed',
    badge: 'Utility / prototype patent filed',
    title: 'Cargo-cum-Commute Electric Cycle',
    detail:
      'A utility / prototype patent application has been filed for efficient cargo transport and personal commuting. (Filed — not a granted patent.)',
    glyph: 'circuit',
  },
  {
    id: 'idex',
    kind: 'runner-up',
    badge: 'Runner-up',
    title: 'IDEX Defence Innovation Challenge',
    detail:
      'Recognised for HUPSS (Hanging Underwater Probes for Ships) as a top-performing solution in the underwater naval research category under the Ministry of Defence innovation programme.',
    glyph: 'probe',
    projectId: 'hupss',
  },
  {
    id: 'clux-founder',
    kind: 'leadership',
    badge: 'Founder',
    title: 'CLUX (startup)',
    detail:
      'Founded CLUX and mentored a 10-member team in R&D and manufacturing; led three teams across mini-projects, Smart India Hackathon and the Bharath Cycle Design Challenge.',
    glyph: 'team',
  },
]
