import { ApiProperty } from '@nestjs/swagger';

export class UserResource {
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  readonly userId: string;

  @ApiProperty({ example: 'ada@votachain.dev' })
  readonly email: string;

  @ApiProperty({ example: false })
  readonly emailVerified: boolean;

  @ApiProperty({ example: 'REGISTERED', enum: ['REGISTERED', 'ACTIVE', 'SUSPENDED'] })
  readonly standing: string;

  @ApiProperty({ example: 'SESSION_CLOSED', enum: ['SESSION_CLOSED', 'SESSION_OPEN'] })
  readonly session: string;

  @ApiProperty({ example: ['USER'], isArray: true })
  readonly roles: string[];

  @ApiProperty({ example: 'auth0', nullable: true, required: false })
  readonly outsideProver: string | null;

  constructor(
    userId: string,
    email: string,
    emailVerified: boolean,
    standing: string,
    session: string,
    roles: string[],
    outsideProver: string | null,
  ) {
    this.userId = userId;
    this.email = email;
    this.emailVerified = emailVerified;
    this.standing = standing;
    this.session = session;
    this.roles = roles;
    this.outsideProver = outsideProver;
  }
}
