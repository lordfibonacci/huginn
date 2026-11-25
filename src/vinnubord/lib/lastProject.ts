// The project this browser opened last, so "/" returns to it instead of to
// the first project by name. One key for the whole browser, not per user:
// a slug the viewer is not a participant of is ignored.

export const LAST_PROJECT_KEY = 'hg.lastProject'

export function startSlug(projects: { slug: string }[], stored: string | null): string | null {
  if (projects.length === 0) return null
  const last = stored ? projects.find((p) => p.slug === stored) : undefined
  return (last ?? projects[0]).slug
}

export function readLastProject(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY)
  } catch {
    return null
  }
}

export function writeLastProject(slug: string): void {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, slug)
  } catch {
    // Storage is off (private mode): "/" opens the first project, as before.
  }
}
