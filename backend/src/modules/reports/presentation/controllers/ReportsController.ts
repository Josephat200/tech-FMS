import { Request, Response } from 'express';
import { FinancialReportService } from '../../application/services/FinancialReportService';

export class ReportsController {
  constructor(private readonly reportService: FinancialReportService) {}

  getTrialBalance = async (req: Request, res: Response): Promise<void> => {
    const asOf = req.query.asOf as string;
    const report = await this.reportService.getTrialBalance({ asOf });
    res.status(200).json({ success: true, data: report });
  };

  getIncomeStatement = async (req: Request, res: Response): Promise<void> => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const report = await this.reportService.getIncomeStatement({ from, to });
    res.status(200).json({ success: true, data: report });
  };

  getBalanceSheet = async (req: Request, res: Response): Promise<void> => {
    const asOf = req.query.asOf as string;
    const report = await this.reportService.getBalanceSheet({ asOf });
    res.status(200).json({ success: true, data: report });
  };

  getCashFlowStatement = async (req: Request, res: Response): Promise<void> => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const report = await this.reportService.getCashFlowStatement({ from, to });
    res.status(200).json({ success: true, data: report });
  };
}
