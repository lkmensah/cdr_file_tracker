import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncate(str: string, length: number = 60) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length - 3) + '...' : str;
}
