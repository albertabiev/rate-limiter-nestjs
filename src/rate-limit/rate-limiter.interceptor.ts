import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Response } from 'express';
import { RateLimitService } from './rate-limiter.service';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly rateLimterService: RateLimitService,
    private readonly logger: Logger,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const response = context.switchToHttp().getResponse<Response>();

    const userId = 1;
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }

    const { currentCount, ttl } =
      await this.rateLimterService.incrementRequestCount(userId);
    this.logger.debug(
      `Current rate limit request count for user ${userId} is ${currentCount}`,
    );

    const isLimited = await this.rateLimterService.isRateLimited(currentCount);
    if (ttl === -1) {
      await this.rateLimterService.setExpirationTime(userId);
    }

    if (isLimited) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: this.rateLimterService.generateRateLimitExceededMessage(ttl),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const remainingRequests =
      this.rateLimterService.calculateRemainingRequests(currentCount);
    response.setHeader('X-RateLimit-Remaining', remainingRequests);
    response.setHeader('X-Count', currentCount);

    return next.handle();
  }
}
