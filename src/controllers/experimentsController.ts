import { Request, Response } from 'express';
import { DatabaseAdapter } from '../db/databaseAdapter';
import { sendSuccess, sendError } from '../utils/response';

export class ExperimentsController {
  public static async list(req: Request, res: Response) {
    try {
      const subject = req.query.subject as string;
      const query = (req.query.q || req.query.search) as string;
      const grade = (req.query.grade || req.query.gradeLevel) as string;
      const difficulty = req.query.difficulty as string;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const summary = req.query.summary === 'true';

      const result = await DatabaseAdapter.getExperiments({
        subject,
        query,
        grade,
        difficulty,
        page,
        limit,
        summary,
      });

      return sendSuccess(res, result.items, { pagination: result.pagination });
    } catch (err: any) {
      console.error('Error listing experiments:', err);
      return sendError(res, 'Internal server error while retrieving experiments.', 500);
    }
  }

  public static async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const experiment = await DatabaseAdapter.getExperimentBySlug(slug);

      if (!experiment) {
        return sendError(res, `Experiment with identifier '${slug}' not found.`, 404);
      }

      return sendSuccess(res, experiment);
    } catch (err: any) {
      console.error('Error fetching experiment:', err);
      return sendError(res, 'Internal server error while fetching experiment details.', 500);
    }
  }

  public static async create(req: Request, res: Response) {
    try {
      const body = req.body;
      if (!body || !body.title) {
        return sendError(res, 'Field "title" is required.', 400);
      }

      const created = await DatabaseAdapter.saveExperiment(body);
      return sendSuccess(res, created, { message: 'Experiment created successfully' }, 201);
    } catch (err: any) {
      console.error('Error creating experiment:', err);
      return sendError(res, 'Failed to create experiment.', 500);
    }
  }

  public static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const body = req.body;

      const existing = await DatabaseAdapter.getExperimentBySlug(id);
      if (!existing) {
        return sendError(res, `Experiment with ID '${id}' not found.`, 404);
      }

      const updated = await DatabaseAdapter.saveExperiment({
        ...existing,
        ...body,
        id: existing.id,
      });

      return sendSuccess(res, updated, { message: 'Experiment updated successfully' });
    } catch (err: any) {
      console.error('Error updating experiment:', err);
      return sendError(res, 'Failed to update experiment.', 500);
    }
  }

  public static async remove(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await DatabaseAdapter.deleteExperiment(id);

      if (!success) {
        return sendError(res, `Experiment with ID '${id}' not found.`, 404);
      }

      return sendSuccess(res, { id }, { message: 'Experiment deleted successfully' });
    } catch (err: any) {
      console.error('Error deleting experiment:', err);
      return sendError(res, 'Failed to delete experiment.', 500);
    }
  }
}
