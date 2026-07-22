export function courseToneClass(courseId: string): string {
  const localId = courseId.includes(":") ? courseId.split(":").at(-1)! : courseId;
  return `course-${localId.replace("course-", "")}`;
}
