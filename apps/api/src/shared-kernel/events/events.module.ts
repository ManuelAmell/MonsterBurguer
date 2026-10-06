import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus';
import { OutboxDispatcher } from './outbox.dispatcher';

@Global()
@Module({
  providers: [EventBus, OutboxDispatcher],
  exports: [EventBus, OutboxDispatcher],
})
export class EventsModule {}
