const fileExtensionRegex = /([-\.\w]+)(\.[^.]+)$/;

export function strippedFilename(filename: string): string | undefined {
  if (!filename) {
    return "No filename found";
  }
  return fileExtensionRegex.exec(filename)[1];
}
