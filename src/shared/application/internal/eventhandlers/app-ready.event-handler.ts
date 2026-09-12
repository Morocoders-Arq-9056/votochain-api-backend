import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';

@Injectable()
export class AppReadyEventHandler implements OnApplicationBootstrap {
  onApplicationBootstrap(): void {
    // Seed runners go here in Sprint-01 (behind app.seeding flags).
  }
}