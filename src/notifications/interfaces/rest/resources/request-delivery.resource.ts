import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Delivery intent carrying only template + address + reason + key.
 * No requester rule leaks in: when/why stays with the requester.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RequestDeliveryResource {
  /** Requester-supplied idempotency key naming the intent. */
  @ApiProperty({ example: 'vote-cast-9f3a-0001' })
  @IsString() @IsNotEmpty() key: string;

  /** Destination address (email shape). */
  @ApiProperty({ example: 'member@example.com' })
  @IsString() @IsNotEmpty() address: string;

  /** Known template key: vote-cast | welcome | security | challenge-code. */
  @ApiProperty({ example: 'vote-cast' })
  @IsString() @IsNotEmpty() templateKey: string;

  /** Raw render values for the template. */
  @ApiProperty({ example: { proposal: 'Q3 budget' }, required: false })
  @IsOptional() @IsObject() templateValues?: Record<string, string>;

  /** Reason supplied by the requester. */
  @ApiProperty({ example: 'vote receipt' })
  @IsString() @IsNotEmpty() reason: string;
}
