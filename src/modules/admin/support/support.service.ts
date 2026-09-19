import { Injectable } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, SupportStatus } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async getAllSupportRequests() {
    try {
      const requests = await this.prisma.supportRequest.findMany({
        orderBy: { created_at: 'desc' },
      });
      return {
        success: true,
        statusCode: 200,
        data: requests,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async getSupportRequestById(id: string) {
    try {
      const request = await this.prisma.supportRequest.findUnique({
        where: { id },
      });
      if (!request) {
        return {
          success: false,
          statusCode: 404,
          message: 'Support request not found',
        };
      }

      return {
        success: true,
        statusCode: 200,
        data: request,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async deleteSupportRequest(id: string) {
    try {
      await this.prisma.supportRequest.delete({
        where: { id },
      });
      return {
        success: true,
        statusCode: 200,
        message: 'Support request deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  async updateSupportRequestStatus(id: string, status: string) {
    try {
      const normalizedStatus = this.normalizeSupportStatus(status);

      if (!normalizedStatus) {
        return {
          success: false,
          statusCode: 400,
          message:
            'Invalid status value: status must be OPEN, IN_PROGRESS, RESOLVED, or CLOSED',
        };
      }

      const updatedRequest = await this.prisma.supportRequest.update({
        where: { id },
        data: { status: normalizedStatus },
      });
      return {
        success: true,
        statusCode: 200,
        data: updatedRequest,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return {
          success: false,
          statusCode: 404,
          message: 'Support request not found',
        };
      }

      return {
        success: false,
        statusCode: 500,
        message: error.message,
      };
    }
  }

  private normalizeSupportStatus(input: unknown): SupportStatus | null {
    if (typeof input !== 'string') return null;
    const cleaned = input.trim().toUpperCase().replace(/\s+/g, '_');

    // accept a couple of common variants (e.g. "Resolved" / "in progress")
    const mapped = cleaned.replace(/-/g, '_');

    if (Object.values(SupportStatus).includes(mapped as SupportStatus)) {
      return mapped as SupportStatus;
    }

    return null;
  }
}
