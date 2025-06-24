import { Column } from '../types';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'kanban.json');

// Helper to generate unique ids
export const uid = () => Math.random().toString(36).slice(2, 9);

// Default columns for new boards
export const defaultColumns: Column[] = [
  { id: uid(), title: "To Do", cards: [{ id: uid(), content: "Sample Task" }] },
  { id: uid(), title: "In Progress", cards: [] },
  { id: uid(), title: "Done", cards: [] },
];

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(DATA_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Read columns from file
export async function getColumns(): Promise<Column[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return default columns
    return defaultColumns;
  }
}

// Save columns to file
export async function saveColumns(columns: Column[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(columns, null, 2));
}