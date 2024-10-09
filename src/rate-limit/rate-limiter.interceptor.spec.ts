import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';

import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { RateLimitService } from './rate-limiter.service';
import { RateLimitInterceptor } from './rate-limiter.interceptor';
import RedisMock from 'ioredis-mock';

describe('RateLimitInterceptor', () => {
  let rateLimitInterceptor: RateLimitInterceptor;
  let rateLimitService: RateLimitService;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  beforeEach(async () => {
    const redisMock = new RedisMock();
    rateLimitService = new RateLimitService();
    (rateLimitService as any).redisClient = redisMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RateLimitInterceptor,
          useFactory: (logger: Logger) =>
            new RateLimitInterceptor(rateLimitService, logger),
          inject: [Logger],
        },
        Logger,
      ],
    }).compile();

    rateLimitInterceptor =
      module.get<RateLimitInterceptor>(RateLimitInterceptor);

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue({
          setHeader: jest.fn(),
        }),
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({})),
    };
  });

  it('should increment request count and allow the request when rate limit is not exceeded', async () => {
    await rateLimitInterceptor.intercept(mockContext, mockCallHandler);

    expect(
      mockContext.switchToHttp().getResponse().setHeader,
    ).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
    expect(
      mockContext.switchToHttp().getResponse().setHeader,
    ).toHaveBeenCalledWith('X-Count', 1);
  });

  it('should throw a TOO_MANY_REQUESTS exception when rate limit is exceeded', async () => {
    for (let i = 1; i < 100; i++) {
      await rateLimitInterceptor.intercept(mockContext, mockCallHandler);
    }

    try {
      await rateLimitInterceptor.intercept(mockContext, mockCallHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: expect.stringContaining('Rate limit exceeded'),
        }),
      );
    }
  });
});
