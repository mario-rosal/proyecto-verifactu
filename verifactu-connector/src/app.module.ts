import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AeatService } from './aeat/aeat.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, AeatService],
})
export class AppModule {}
