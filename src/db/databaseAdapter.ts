import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env';
import fs from 'fs';
import path from 'path';

export interface ExperimentRecord {
  id: string;
  slug?: string;
  title: string;
  subtitle?: string;
  subjectSlug: string;
  subjectName: string;
  category?: string;
  gradeLevel?: string;
  difficulty?: string;
  duration?: string;
  safetyLevel?: string;
  status?: string;
  tags?: string[];
  heroImage?: string;
  sections?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export class DatabaseAdapter {
  private static supabase: SupabaseClient | null = null;
  private static localDataCache: ExperimentRecord[] | null = null;
  private static filePath = path.join(process.cwd(), 'src', 'db', 'experimentsData.json');

  public static getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
        auth: { persistSession: false },
      });
    }
    return this.supabase;
  }

  public static loadLocalExperiments(): ExperimentRecord[] {
    if (this.localDataCache && this.localDataCache.length > 0) {
      return this.localDataCache;
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          this.localDataCache = parsed;
          return this.localDataCache;
        }
      }
    } catch (err) {
      console.warn('Could not read experimentsData.json, using memory store', err);
    }

    this.localDataCache = [];
    return this.localDataCache;
  }

  public static saveLocalExperiments(data: ExperimentRecord[]): void {
    this.localDataCache = data;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      // In serverless environments, in-memory cache holds state
    }
  }

  /**
   * Fetch experiments with filters, search, and pagination
   */
  public static async getExperiments(options: {
    subject?: string;
    query?: string;
    grade?: string;
    difficulty?: string;
    page?: number;
    limit?: number;
    summary?: boolean;
  }) {
    let items = this.loadLocalExperiments();

    const { subject, query, grade, difficulty, summary } = options;
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(15, Math.max(1, options.limit || 10)); // Max 15 items per page (Anti-Dumping defense)

    // Subject Filter
    if (subject && subject !== 'all') {
      items = items.filter((item) => item.subjectSlug?.toLowerCase() === subject.toLowerCase().trim());
    }

    // Search Query Filter
    if (query) {
      const q = query.toLowerCase().trim();
      items = items.filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(q);
        const subMatch = item.subtitle?.toLowerCase().includes(q);
        const catMatch = item.category?.toLowerCase().includes(q);
        const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(q));
        const slugMatch = item.slug?.toLowerCase().includes(q);
        return titleMatch || subMatch || catMatch || tagMatch || slugMatch;
      });
    }

    // Grade Filter
    if (grade && grade !== 'all') {
      items = items.filter((item) => item.gradeLevel?.toLowerCase() === grade.toLowerCase().trim());
    }

    // Difficulty Filter
    if (difficulty && difficulty !== 'all') {
      items = items.filter((item) => item.difficulty?.toLowerCase() === difficulty.toLowerCase().trim());
    }

    // Sort by recent
    items.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = items.slice(startIndex, startIndex + limit);

    // If summary is requested, strip heavy sections to save bandwidth and protect deeper content
    const result = summary
      ? paginated.map((item) => ({
          id: item.id,
          slug: item.slug || item.id,
          title: item.title,
          subtitle: item.subtitle,
          subjectSlug: item.subjectSlug,
          subjectName: item.subjectName,
          category: item.category,
          gradeLevel: item.gradeLevel,
          difficulty: item.difficulty,
          duration: item.duration,
          safetyLevel: item.safetyLevel,
          heroImage: item.heroImage,
          tags: item.tags,
          sectionsCount: item.sections?.length || 0,
        }))
      : paginated;

    return {
      items: result,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Fetch single experiment by ID, slug, or matching keyword
   */
  public static async getExperimentBySlug(queryId: string): Promise<ExperimentRecord | null> {
    const q = decodeURIComponent(queryId).toLowerCase().trim();
    const items = this.loadLocalExperiments();

    // 1. Exact ID or slug match
    const found = items.find((item) => {
      const itemSlug = (
        item.slug ||
        item.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/[\s_-]+/g, '-')
      ).toLowerCase();
      return item.id.toLowerCase() === q || itemSlug === q;
    });
    if (found) return found;

    // 2. Starts with match
    const starts = items.find((item) => {
      const itemSlug = (
        item.slug ||
        item.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/[\s_-]+/g, '-')
      ).toLowerCase();
      return q.startsWith(itemSlug) || itemSlug.startsWith(q);
    });
    if (starts) return starts;

    // 3. Keyword matching (thermite, pendulum, oxygen, elephant)
    if (q.includes('thermite')) {
      const thermite = items.find(
        (i) => i.slug?.includes('thermite') || i.tags?.some((t) => t.toLowerCase().includes('thermite'))
      );
      if (thermite) return thermite;
    }
    if (q.includes('elephant')) {
      const el = items.find((i) => i.slug?.includes('elephant') || i.title?.toLowerCase().includes('elephant'));
      if (el) return el;
    }
    if (q.includes('pendulum')) {
      const pen = items.find((i) => i.slug?.includes('pendulum') || i.title?.toLowerCase().includes('pendulum'));
      if (pen) return pen;
    }

    return null;
  }

  /**
   * Create or update experiment
   */
  public static async saveExperiment(record: Partial<ExperimentRecord>): Promise<ExperimentRecord> {
    const items = this.loadLocalExperiments();
    const id = record.id || `exp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const completeRecord: ExperimentRecord = {
      id,
      slug:
        record.slug ||
        record.title
          ?.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/[\s_-]+/g, '-') ||
        id,
      title: record.title || 'Untitled Experiment',
      subtitle: record.subtitle || '',
      subjectSlug: record.subjectSlug || 'science',
      subjectName: record.subjectName || 'Science',
      category: record.category || 'General Science',
      gradeLevel: record.gradeLevel || 'Middle (6-8)',
      difficulty: record.difficulty || 'Beginner',
      duration: record.duration || '30 Mins',
      safetyLevel: record.safetyLevel || 'Safe for Home',
      status: record.status || 'published',
      tags: record.tags || ['STEM', 'Virtual Lab'],
      heroImage: record.heroImage || '',
      sections: record.sections || [],
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      items[idx] = completeRecord;
    } else {
      items.unshift(completeRecord);
    }

    this.saveLocalExperiments(items);
    return completeRecord;
  }

  /**
   * Delete experiment
   */
  public static async deleteExperiment(id: string): Promise<boolean> {
    const items = this.loadLocalExperiments();
    const filtered = items.filter((i) => i.id !== id && i.slug !== id);
    if (filtered.length === items.length) return false;
    this.saveLocalExperiments(filtered);
    return true;
  }
}
