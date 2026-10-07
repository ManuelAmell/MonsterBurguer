import { Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeHub } from './realtime.hub';
import { RealtimeService } from './realtime.service';

@Module({
  controllers: [RealtimeController],
  providers: [RealtimeHub, RealtimeService],
  exports: [RealtimeHub, RealtimeService],
})
export class RealtimeModule {}
