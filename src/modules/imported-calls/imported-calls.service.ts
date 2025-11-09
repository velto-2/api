import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ImportedCall, ImportedCallDocument } from './schemas';

@Injectable()
export class ImportedCallsService {
  constructor(
    @InjectModel(ImportedCall.name)
    private importedCallModel: Model<ImportedCallDocument>,
  ) {}

  async create(data: Partial<ImportedCall>): Promise<ImportedCallDocument> {
    const call = new this.importedCallModel(data);
    return call.save();
  }

  async findById(id: string, customerId?: string): Promise<ImportedCallDocument> {
    if (!id || id === 'undefined') {
      throw new NotFoundException('Call ID is required');
    }
    
    const query: any = { _id: id, deletedAt: null };
    if (customerId) query.customerId = customerId;
    
    const call = await this.importedCallModel.findOne(query);
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async findAll(filters: {
    customerId: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    campaignId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ calls: ImportedCallDocument[]; total: number }> {
    const query: any = {
      customerId: filters.customerId,
      deletedAt: null,
    };

    if (filters.status) query.status = filters.status;
    if (filters.campaignId) query['metadata.campaignId'] = filters.campaignId;
    if (filters.dateFrom || filters.dateTo) {
      query['metadata.callDate'] = {};
      if (filters.dateFrom) query['metadata.callDate'].$gte = filters.dateFrom;
      if (filters.dateTo) query['metadata.callDate'].$lte = filters.dateTo;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Optimized query with select to reduce data transfer
    const [calls, total] = await Promise.all([
      this.importedCallModel
        .find(query)
        .select('_id customerId fileName fileSize duration status processingStage progressPercentage metadata evaluation createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.importedCallModel.countDocuments(query),
    ]);

    return { calls, total };
  }

  async update(id: string, data: Partial<ImportedCall>, customerId?: string): Promise<ImportedCallDocument> {
    const query: any = { _id: id, deletedAt: null };
    if (customerId) query.customerId = customerId;

    const call = await this.importedCallModel.findOneAndUpdate(query, data, { new: true });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async softDelete(id: string, customerId?: string): Promise<void> {
    await this.update(id, { deletedAt: new Date() }, customerId);
  }

  async delete(id: string, customerId?: string): Promise<void> {
    const query: any = { _id: id };
    if (customerId) query.customerId = customerId;
    
    const result = await this.importedCallModel.deleteOne(query);
    if (result.deletedCount === 0) {
      throw new NotFoundException('Call not found');
    }
  }

  async getAnalytics(filters: {
    customerId: string;
    dateFrom?: Date;
    dateTo?: Date;
    campaignId?: string;
  }): Promise<any> {
    const query: any = {
      customerId: filters.customerId,
      deletedAt: null,
      status: 'completed',
    };

    if (filters.campaignId) query['metadata.campaignId'] = filters.campaignId;
    if (filters.dateFrom || filters.dateTo) {
      query['metadata.callDate'] = {};
      if (filters.dateFrom) query['metadata.callDate'].$gte = filters.dateFrom;
      if (filters.dateTo) query['metadata.callDate'].$lte = filters.dateTo;
    }

    const calls = await this.importedCallModel.find(query);

    const totalCalls = calls.length;
    const totalDuration = calls.reduce((sum, call) => sum + (call.duration || 0), 0);
    const averageCallDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

    // Calculate average scores
    const scores = calls
      .map((call) => call.evaluation?.overallScore)
      .filter((s) => s !== undefined && s !== null) as number[];
    const averageOverallScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    // Score distribution
    const scoreDistribution = {
      A: calls.filter((c) => c.evaluation?.grade === 'A').length,
      B: calls.filter((c) => c.evaluation?.grade === 'B').length,
      C: calls.filter((c) => c.evaluation?.grade === 'C').length,
      D: calls.filter((c) => c.evaluation?.grade === 'D').length,
      F: calls.filter((c) => c.evaluation?.grade === 'F').length,
    };

    // Metric averages
    const metricAverages: any = {};
    const metrics = ['latency', 'interruption', 'pronunciation', 'repetition', 'disconnection', 'jobsToBeDone'];
    
    for (const metric of metrics) {
      const metricScores = calls
        .map((call) => call.evaluation?.[metric]?.score)
        .filter((s) => s !== undefined && s !== null) as number[];
      if (metricScores.length > 0) {
        metricAverages[metric] =
          metricScores.reduce((a, b) => a + b, 0) / metricScores.length;
      }
    }

    return {
      period: {
        from: filters.dateFrom || null,
        to: filters.dateTo || null,
      },
      summary: {
        totalCalls,
        totalDuration,
        averageCallDuration: Math.round(averageCallDuration),
        averageOverallScore: Math.round(averageOverallScore * 100) / 100,
        scoreDistribution,
      },
      metricAverages,
    };
  }
}

