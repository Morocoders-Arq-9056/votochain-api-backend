import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Liveness answer: whether a live person was observed. */
export class CompleteLivenessResource {
  @ApiProperty({ example: true })
  @IsBoolean() present: boolean;
}
