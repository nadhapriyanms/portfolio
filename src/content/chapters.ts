export type SceneKey = 'globe' | 'school' | 'college' | 'workshop' | 'city' | 'skyline' | 'constellation' | 'contact'

export interface Chapter {
  id: string
  number: string
  title: string
  nav: string
  scene: SceneKey
  /** Section height in viewport heights; also the chapter's length on the story timeline. */
  weight: number
}

export const chapters: Chapter[] = [
  { id: 'hero-globe', number: '01', title: 'The Globe', nav: 'Start', scene: 'globe', weight: 2.4 },
  { id: 'school-years', number: '02', title: 'School Years', nav: 'School', scene: 'school', weight: 2.6 },
  { id: 'college-workspace', number: '03', title: 'College & Code', nav: 'College', scene: 'college', weight: 2.4 },
  { id: 'night-flyer', number: '04', title: 'The Flyer', nav: 'The Flyer', scene: 'college', weight: 1.8 },
  { id: 'cycle-workshop', number: '05', title: 'The Cycle Workshop', nav: 'Workshop', scene: 'workshop', weight: 3.2 },
  { id: 'ride-transition', number: '06', title: 'The Ride', nav: 'The Ride', scene: 'city', weight: 2.4 },
  { id: 'cyber-city', number: '07', title: 'The Security Layer', nav: 'Security', scene: 'city', weight: 2.2 },
  { id: 'project-skyline', number: '08', title: 'Project Skyline', nav: 'Projects', scene: 'skyline', weight: 2.4 },
  { id: 'achievement-constellation', number: '09', title: 'Constellation', nav: 'Achievements', scene: 'constellation', weight: 2.2 },
  { id: 'contact-ending', number: '10', title: 'What Next', nav: 'Contact', scene: 'contact', weight: 1.8 },
]

export const chapterStarts: number[] = (() => {
  const starts: number[] = []
  let t = 0
  for (const c of chapters) {
    starts.push(t)
    t += c.weight
  }
  return starts
})()

export const storyLength = chapters.reduce((sum, c) => sum + c.weight, 0)

export const chapterIndexById = (id: string) => chapters.findIndex((c) => c.id === id)
