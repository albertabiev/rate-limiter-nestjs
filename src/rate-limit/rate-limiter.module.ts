import { Logger, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limiter.service';
import { RateLimitInterceptor } from './rate-limiter.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  providers: [
    RateLimitService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
    Logger,
  ],
  exports: [],
})
export class RateLimitModule {}
