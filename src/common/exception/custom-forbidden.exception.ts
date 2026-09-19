import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomForbiddenException extends HttpException {
  constructor(message: string) {
    super(
      {
        success: false,
        statusCode: HttpStatus.FORBIDDEN,
        message: message || 'Forbidden access',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
