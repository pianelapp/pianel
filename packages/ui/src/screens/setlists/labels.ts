export function sceneCountLabel(count: number): string {
  return count === 1 ? '1 scene' : `${count} scenes`;
}

export function setlistCountLabel(count: number): string {
  return count === 1 ? '1 setlist' : `${count} setlists`;
}
