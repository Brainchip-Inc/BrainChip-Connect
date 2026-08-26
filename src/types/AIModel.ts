/**
 * An AI model package picked from the phone's local storage. Model packages
 * are always a `.zip` bundle copied into the app cache before transfer.
 */
export interface AIModel {
  filename: string;
  description: string;
  size_kb: number;
  localPath: string;
}
