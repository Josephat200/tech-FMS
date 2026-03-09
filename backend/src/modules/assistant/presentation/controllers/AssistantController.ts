import { Request, Response } from 'express';
import { AiAssistantService } from '../../application/services/AiAssistantService';

export class AssistantController {
  constructor(private readonly service: AiAssistantService) {}

  ask = async (req: Request, res: Response): Promise<void> => {
    const { prompt, route } = req.body as { prompt: string; route?: string };

    const data = await this.service.ask({
      userId: req.user!.sub,
      prompt,
      route,
      userRoles: req.user?.roles ?? [],
    });

    res.status(200).json({ success: true, data });
  };

  history = async (req: Request, res: Response): Promise<void> => {
    const limit = Number(req.query.limit ?? 25);
    const data = await this.service.getHistory(req.user!.sub, limit);
    res.status(200).json({ success: true, data });
  };

  getConfig = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.getConfig();
    res.status(200).json({ success: true, data });
  };

  updateConfig = async (req: Request, res: Response): Promise<void> => {
    const { systemPrompt, temperature, maxTokens } = req.body as {
      systemPrompt: string;
      temperature: number;
      maxTokens: number;
    };

    const data = await this.service.updateConfig({
      systemPrompt,
      temperature,
      maxTokens,
      updatedByUserId: req.user!.sub,
    });

    res.status(200).json({ success: true, data });
  };

  metrics = async (req: Request, res: Response): Promise<void> => {
    const days = Number(req.query.days ?? 30);
    const data = await this.service.getMetrics(days);
    res.status(200).json({ success: true, data });
  };

  health = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.getHealth();
    res.status(200).json({ success: true, data });
  };
}
