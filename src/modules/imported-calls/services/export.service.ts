import { Injectable } from '@nestjs/common';
// Note: Install pdfkit with: npm install pdfkit @types/pdfkit
// For now, using dynamic import to handle optional dependency
let PDFDocument: any;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  // PDFKit not installed - will throw error when used
}

@Injectable()
export class ExportService {
  generateEvaluationPDF(call: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        if (!PDFDocument) {
          reject(
            new Error(
              'PDFKit is not installed. Please run: npm install pdfkit @types/pdfkit',
            ),
          );
          return;
        }
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('Call Evaluation Report', { align: 'center' });
        doc.moveDown();

        // Call Information
        doc.fontSize(14).text('Call Information', { underline: true });
        doc.fontSize(10);
        doc.text(`File Name: ${call.fileName || 'N/A'}`);
        doc.text(`Call ID: ${call.callId || 'N/A'}`);
        doc.text(
          `Duration: ${call.duration ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}`,
        );
        doc.text(`Status: ${call.status || 'N/A'}`);
        doc.text(
          `Uploaded At: ${call.uploadedAt ? new Date(call.uploadedAt).toLocaleString() : 'N/A'}`,
        );
        doc.moveDown();

        // Evaluation Summary
        if (call.evaluation) {
          doc.fontSize(14).text('Evaluation Summary', { underline: true });
          doc.fontSize(10);
          doc.text(`Overall Score: ${call.evaluation.overallScore || 0}/100`);
          doc.text(`Grade: ${call.evaluation.grade || 'N/A'}`);
          doc.moveDown();

          // Core Metrics
          doc.fontSize(14).text('Core Metrics', { underline: true });
          doc.fontSize(10);

          if (call.evaluation.latency) {
            doc.text(`Latency: ${call.evaluation.latency.score || 0}/100`);
            if (call.evaluation.latency.averageResponseTime) {
              doc.text(
                `  Average Response Time: ${call.evaluation.latency.averageResponseTime}ms`,
              );
            }
            if (call.evaluation.latency.p95ResponseTime) {
              doc.text(
                `  P95 Response Time: ${call.evaluation.latency.p95ResponseTime}ms`,
              );
            }
            doc.moveDown(0.5);
          }

          if (call.evaluation.pronunciation) {
            doc.text(
              `Pronunciation: ${call.evaluation.pronunciation.score || 0}/100`,
            );
            if (call.evaluation.pronunciation.wordsPerMinute) {
              doc.text(
                `  Words Per Minute: ${call.evaluation.pronunciation.wordsPerMinute}`,
              );
            }
            if (call.evaluation.pronunciation.overallClarityScore) {
              doc.text(
                `  Clarity Score: ${call.evaluation.pronunciation.overallClarityScore}`,
              );
            }
            doc.moveDown(0.5);
          }

          if (call.evaluation.jobsToBeDone) {
            doc.text(
              `Jobs-to-be-Done: ${call.evaluation.jobsToBeDone.score || 0}/100`,
            );
            doc.text(
              `  Task Completed: ${call.evaluation.jobsToBeDone.wasTaskCompleted ? 'Yes' : 'No'}`,
            );
            if (call.evaluation.jobsToBeDone.attemptedJobs?.length > 0) {
              doc.text(
                `  Attempted Jobs: ${call.evaluation.jobsToBeDone.attemptedJobs.join(', ')}`,
              );
            }
            if (call.evaluation.jobsToBeDone.completedJobs?.length > 0) {
              doc.text(
                `  Completed Jobs: ${call.evaluation.jobsToBeDone.completedJobs.join(', ')}`,
              );
            }
            if (call.evaluation.jobsToBeDone.missingSteps?.length > 0) {
              doc.text(
                `  Missing Steps: ${call.evaluation.jobsToBeDone.missingSteps.join(', ')}`,
              );
            }
            if (call.evaluation.jobsToBeDone.reason) {
              doc.text(`  Analysis: ${call.evaluation.jobsToBeDone.reason}`);
            }
            doc.moveDown(0.5);
          }

          // Critical Issues
          if (
            call.evaluation.criticalIssues &&
            call.evaluation.criticalIssues.length > 0
          ) {
            doc.moveDown();
            doc.fontSize(14).text('Critical Issues', { underline: true });
            doc.fontSize(10);
            call.evaluation.criticalIssues.forEach(
              (issue: any, idx: number) => {
                doc.text(`${idx + 1}. ${issue.description || 'N/A'}`);
              },
            );
            doc.moveDown();
          }

          // Recommendations
          if (
            call.evaluation.recommendations &&
            call.evaluation.recommendations.length > 0
          ) {
            doc.fontSize(14).text('Recommendations', { underline: true });
            doc.fontSize(10);
            call.evaluation.recommendations.forEach((rec: any, idx: number) => {
              doc.text(`${idx + 1}. ${rec.title || 'N/A'}`);
              if (rec.description) {
                doc.text(`   ${rec.description}`, { indent: 20 });
              }
            });
          }
        }

        // Footer
        doc
          .fontSize(8)
          .text(
            `Generated on ${new Date().toLocaleString()}`,
            50,
            doc.page.height - 50,
            { align: 'center' },
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  generateBulkEvaluationPDF(calls: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        if (!PDFDocument) {
          reject(
            new Error(
              'PDFKit is not installed. Please run: npm install pdfkit @types/pdfkit',
            ),
          );
          return;
        }
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Header
        doc
          .fontSize(20)
          .text('Bulk Call Evaluation Report', { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Calls: ${calls.length}`);
        const avgScore =
          calls
            .filter((c) => c.evaluation?.overallScore)
            .reduce((sum, c) => sum + (c.evaluation?.overallScore || 0), 0) /
          calls.filter((c) => c.evaluation?.overallScore).length;
        doc.text(
          `Average Score: ${avgScore ? Math.round(avgScore) : 'N/A'}/100`,
        );
        doc.moveDown();

        // Table Header
        doc.fontSize(12).text('Call Evaluations', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9);

        // Table
        let y = doc.y;
        const rowHeight = 20;
        const colWidths = [100, 200, 80, 80, 80, 80];
        const headers = [
          'File Name',
          'Status',
          'Overall',
          'Latency',
          'Pron.',
          'Jobs',
        ];

        // Header row
        doc.font('Helvetica-Bold');
        doc.text(headers[0], 50, y);
        doc.text(headers[1], 50 + colWidths[0], y);
        doc.text(headers[2], 50 + colWidths[0] + colWidths[1], y);
        doc.text(
          headers[3],
          50 + colWidths[0] + colWidths[1] + colWidths[2],
          y,
        );
        doc.text(
          headers[4],
          50 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          y,
        );
        doc.text(
          headers[5],
          50 +
            colWidths[0] +
            colWidths[1] +
            colWidths[2] +
            colWidths[3] +
            colWidths[4],
          y,
        );
        y += rowHeight;

        // Data rows
        doc.font('Helvetica');
        calls.forEach((call) => {
          if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;
          }

          const fileName = (call.fileName || 'N/A').substring(0, 25);
          const status = call.status || 'N/A';
          const overall = call.evaluation?.overallScore || 'N/A';
          const latency = call.evaluation?.latency?.score || 'N/A';
          const pronunciation = call.evaluation?.pronunciation?.score || 'N/A';
          const jobs = call.evaluation?.jobsToBeDone?.score || 'N/A';

          doc.text(fileName, 50, y);
          doc.text(status, 50 + colWidths[0], y);
          doc.text(String(overall), 50 + colWidths[0] + colWidths[1], y);
          doc.text(
            String(latency),
            50 + colWidths[0] + colWidths[1] + colWidths[2],
            y,
          );
          doc.text(
            String(pronunciation),
            50 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
            y,
          );
          doc.text(
            String(jobs),
            50 +
              colWidths[0] +
              colWidths[1] +
              colWidths[2] +
              colWidths[3] +
              colWidths[4],
            y,
          );
          y += rowHeight;
        });

        // Footer
        doc
          .fontSize(8)
          .text(
            `Generated on ${new Date().toLocaleString()}`,
            50,
            doc.page.height - 50,
            { align: 'center' },
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
